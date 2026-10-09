import "server-only";
import { eq, inArray, lt, sql } from "drizzle-orm";
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
// ten addresses or more. A correct password clears its email's count at its address
// and gives back the attempt it was charged under the other two.
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
  if (!address) return [["email:" + email, EMAIL_ALONE_LIMIT]];
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
function network(address: string): string {
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
  return groups.slice(0, 4).map((g) => parseInt(g, 16).toString(16)).join(":") + "::/64";
}

/** The client's address as Vercel reports it (it overwrites x-forwarded-for), or null when there is none. */
export function clientAddress(request: Request | undefined): string | null {
  const forwarded = request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const real = request?.headers.get("x-real-ip")?.trim();
  const address = forwarded || real || "";
  return address ? network(address).slice(0, 64) : null;
}

/**
 * Counts this sign-in attempt against its limits and says whether it may go on to the
 * password check. A window that has run out starts again at one.
 */
export async function takeSignInAttempt(email: string, address: string | null): Promise<boolean> {
  let allowed = true;
  for (const [key, limit] of limitsFor(email, address)) {
    const [row] = await db
      .insert(signInAttempts)
      .values({ key, attempts: 1 })
      .onConflictDoUpdate({
        target: signInAttempts.key,
        set: {
          attempts: sql`case when ${signInAttempts.windowStart} > ${windowOpen} then ${signInAttempts.attempts} + 1 else 1 end`,
          windowStart: sql`case when ${signInAttempts.windowStart} > ${windowOpen} then ${signInAttempts.windowStart} else now() end`,
        },
      })
      .returning({ attempts: signInAttempts.attempts });
    if (row && row.attempts > limit) {
      allowed = false;
      break;
    }
  }
  // rows whose window ran out long ago are of no further use (window_start is indexed)
  await db.delete(signInAttempts).where(lt(signInAttempts.windowStart, sql`now() - interval '1 day'`));
  return allowed;
}

/** A correct password: its email starts again at its address, and the other counts get back the attempt it was charged. */
export async function signInSucceeded(email: string, address: string | null) {
  const [[narrowest], ...wider] = limitsFor(email, address);
  await db.delete(signInAttempts).where(eq(signInAttempts.key, narrowest));
  if (wider.length) {
    await db
      .update(signInAttempts)
      .set({ attempts: sql`greatest(${signInAttempts.attempts} - 1, 0)` })
      .where(inArray(signInAttempts.key, wider.map(([key]) => key)));
  }
}
