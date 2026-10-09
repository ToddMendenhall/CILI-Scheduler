import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import { organizations, users, orgMembers } from "@/db/schema";
import { registrationForcedOpen, registrationOpen } from "@/lib/registration";

const registerSchema = z.object({
  orgName: z.string().min(2).max(255),
  name: z.string().min(1).max(255),
  email: z
    .string()
    .email()
    .transform((v) => v.trim().toLowerCase()),
  password: z.string().min(12, "Choose a password of at least 12 characters."),
});

const CLOSED = "Sign-up is by invitation. Ask an admin of your organization to invite you.";

function slugify(input: string) {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "org"
  );
}

async function uniqueSlug(base: string) {
  let slug = base;
  let suffix = 1;
  // Small orgs table, so a loop here is fine for phase 1.
  while (true) {
    const [taken] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.slug, slug))
      .limit(1);
    if (!taken) return slug;
    suffix += 1;
    slug = `${base}-${suffix}`;
  }
}

class RegistrationClosed extends Error {}

export async function POST(request: Request) {
  // Closed sign-up is refused before anything else is looked at, so it also says nothing
  // about which emails have accounts.
  if (!(await registrationOpen())) {
    return NextResponse.json({ error: CLOSED }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

  const { orgName, name, email, password } = parsed.data;

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) {
    return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
  }

  const slug = await uniqueSlug(slugify(orgName));
  const passwordHash = await bcrypt.hash(password, 10);

  try {
    await db.transaction(async (tx) => {
      // One sign-up at a time, and the check made again inside it: two people signing up on a
      // brand-new deployment at the same moment cannot both create an organization.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext('cili-scheduler:register'))`);
      if (!registrationForcedOpen()) {
        const [anyOrg] = await tx.select({ id: organizations.id }).from(organizations).limit(1);
        if (anyOrg) throw new RegistrationClosed();
      }
      const [org] = await tx.insert(organizations).values({ name: orgName, slug }).returning();
      const [user] = await tx.insert(users).values({ email, name, passwordHash }).returning();
      await tx.insert(orgMembers).values({ orgId: org.id, userId: user.id, role: "admin" });
    });
  } catch (err) {
    if (err instanceof RegistrationClosed) {
      return NextResponse.json({ error: CLOSED }, { status: 403 });
    }
    throw err;
  }

  return NextResponse.json({ ok: true });
}
