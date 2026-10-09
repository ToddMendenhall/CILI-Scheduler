import "server-only";
import { and, eq, gt, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { signInAttempts } from "@/db/schema";

// Sign-in attempts allowed in a window before sign-in is refused for the rest of it:
// - one email from one address: 10. Guessing one person's password is stopped here.
// - one address, any emails: 50. Stops one machine trying many accounts; set well
//   above 10 because everyone in one office can share an address.
// - one email from anywhere: 100. Stops guessing spread over many addresses.
// With no address to go by, one email is allowed 10.
//
// Every attempt is counted BEFORE its password is checked, in one atomic step per key,
// so attempts sent all at once cannot slip past a limit while the first are still being
// checked. The keys are counted in the order above and counting stops at the first limit
// reached: an attempt refused for its email and address adds nothing to that email's
// count, so hammering one email from one address shuts out only that email at that
// address, and shutting its owner out everywhere takes a hundred attempts spread over
// ten addresses or more. An address already at its limit is turned away before anything
// is written, so trying ever-new emails from one address cannot fill the table.
// A correct password clears its email's count at its address and gives back the attempt
// it was charged under the other two.
//
// Guessing the current password on the change-password form counts the same way.
export const WINDOW_MINUTES = 15;
const PAIR_LIMIT = 10;
const ADDRESS_LIMIT = 50;
const EMAIL_LIMIT = 100;
const EMAIL_ALONE_LIMIT = 10;

/** No account's email is longer (users.email), so a longer one is turned away without being counted. */
export const MAX_EMAIL_LENGTH = 255;

const windowOpen = sql.raw(`now() - interval '${WINDOW_MINUTES} minutes'`);

/** The keys an attempt is counted under, in the order they are counted, each with its limit. */
function limitsFor(email: string, address: string | null): [string, number][] {
  if (!address) return [["solo:" + email, EMAIL_ALONE_LIMIT]];
  return [
    ["pair:" + email + "|" + address, PAIR_LIMIT],
    ["addr:" + address, ADDRESS_LIMIT],
    ["email:" + email, EMAIL_LIMIT],
  ];
}

/**
 * The address attempts are counted under: an IPv4 address as it is, and an IPv6 address by
 * its /64 network. One connection is usually given a whole /64, so counting its addresses
 * one by one would let a single machine spread its attempts over billions of them.
 */
function network(raw: string): string {
  // without a port, if a proxy added one: 203.0.113.7:5123, [2001:db8::1]:5123
  const address = raw.replace(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/, "$1").replace(/^\[([^\]]+)\](?::\d+)?$/, "$1");
  if (!address.includes(":")) return address;
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(address); // IPv4 written as IPv6
  if (mapped) return mapped[1];
  const parts = address.toLowerCase().split("::");
  if (parts.length > 2) return address;
  const front = parts[0] ? parts[0].split(":") : [];
  const back = parts.length === 2 && parts[1] ? parts[1].split(":") : [];
  const groups =
    parts.length === 2 ? [...front, ...Array(Math.max(0, 8 - front.length - back.length)).fill("0"), ...back] : front;
  if (groups.length !== 8 || !groups.every((g) => /^[0-9a-f]{1,4}$/.test(g))) return address;
  const n = groups.map((g) => parseInt(g, 16));
  if (n.slice(0, 5).every((x) => x === 0) && n[5] === 0xffff) {
    return [n[6] >> 8, n[6] & 255, n[7] >> 8, n[7] & 255].join("."); // the same, written in hex
  }
  return n.slice(0, 4).map((x) => x.toString(16)).join(":") + "::/64";
}

/** The client's address as Vercel reports it (it overwrites x-forwarded-for), or null when there is none. */
export function clientAddress(headers: { get(name: string): string | null } | undefined): string | null {
  const forwarded = headers?.get("x-forwarded-for")?.split(",")[0]?.trim();
  const real = headers?.get("x-real-ip")?.trim();
  const address = forwarded || real || "";
  return address ? network(address).slice(0, 64) : null;
}

/** The error a database gives when the migration that adds sign_in_attempts has not reached it yet. */
function missingTable(err: unknown) {
  return typeof err === "object" && err !== null && (err as { code?: unknown }).code === "42P01";
}

/**
 * Counts this attempt and says whether its password may be checked: "allowed", "refused"
 * (a limit is reached), or "unavailable" when the count could not be kept. Then nothing is
 * checked either: a guesser gains nothing from a database that cannot record attempts.
 * The one exception is a database the migration has not reached yet (a preview built
 * before this table was added to it), where sign-in goes on, unlimited, as it did before.
 */
export async function takeSignInAttempt(
  email: string,
  address: string | null,
): Promise<"allowed" | "refused" | "unavailable"> {
  let verdict: "allowed" | "refused";
  try {
    verdict = (await count(email, address)) ? "allowed" : "refused";
  } catch (err) {
    if (missingTable(err)) {
      console.error("[auth] sign_in_attempts does not exist in this database, so sign-in is not limited here. Run the migrations.");
      return "allowed";
    }
    console.error("[auth] could not count the sign-in attempt:", err);
    return "unavailable";
  }
  try {
    await forgetOldAttempts();
  } catch (err) {
    console.error("[auth] could not clear old sign-in attempts:", err);
  }
  return verdict;
}

async function count(email: string, address: string | null): Promise<boolean> {
  if (address) {
    const [row] = await db
      .select({ attempts: signInAttempts.attempts })
      .from(signInAttempts)
      .where(and(eq(signInAttempts.key, "addr:" + address), gt(signInAttempts.windowStart, windowOpen)));
    if (row && row.attempts >= ADDRESS_LIMIT) return false;
  }
  for (const [key, limit] of limitsFor(email, address)) {
    const [row] = await db
      .insert(signInAttempts)
      .values({ key, attempts: 1 })
      .onConflictDoUpdate({
        target: signInAttempts.key,
        set: {
          // a window that has run out starts again at one
          attempts: sql`case when ${signInAttempts.windowStart} > ${windowOpen} then ${signInAttempts.attempts} + 1 else 1 end`,
          windowStart: sql`case when ${signInAttempts.windowStart} > ${windowOpen} then ${signInAttempts.windowStart} else now() end`,
        },
      })
      .returning({ attempts: signInAttempts.attempts });
    if (row && row.attempts > limit) return false;
  }
  return true;
}

/** Rows from windows that began over a day ago: a few hundred at a time, skipping any another sign-in is deleting. */
async function forgetOldAttempts() {
  await db.execute(sql`
    delete from sign_in_attempts where "key" in (
      select "key" from sign_in_attempts
      where window_start < now() - interval '1 day'
      order by window_start limit 500
      for update skip locked)`);
}

/** A correct password: its email starts again at its address, and the other counts get back the attempt it was charged. */
export async function signInSucceeded(email: string, address: string | null) {
  const [[narrowest], ...wider] = limitsFor(email, address);
  try {
    await db.delete(signInAttempts).where(eq(signInAttempts.key, narrowest));
    if (wider.length) {
      await db
        .update(signInAttempts)
        .set({ attempts: sql`greatest(${signInAttempts.attempts} - 1, 0)` })
        .where(inArray(signInAttempts.key, wider.map(([key]) => key)));
    }
  } catch (err) {
    console.error("[auth] could not clear the sign-in count:", err);
  }
}
