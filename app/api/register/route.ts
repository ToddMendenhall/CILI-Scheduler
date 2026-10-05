import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import { organizations, users, orgMembers } from "@/db/schema";

const registerSchema = z.object({
  orgName: z.string().min(2).max(255),
  name: z.string().min(1).max(255),
  email: z
    .string()
    .email()
    .transform((v) => v.trim().toLowerCase()),
  password: z.string().min(8),
});

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

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { orgName, name, email, password } = parsed.data;

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) {
    return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
  }

  const slug = await uniqueSlug(slugify(orgName));
  const passwordHash = await bcrypt.hash(password, 10);

  await db.transaction(async (tx) => {
    const [org] = await tx.insert(organizations).values({ name: orgName, slug }).returning();
    const [user] = await tx.insert(users).values({ email, name, passwordHash }).returning();
    await tx.insert(orgMembers).values({ orgId: org.id, userId: user.id, role: "admin" });
  });

  return NextResponse.json({ ok: true });
}
