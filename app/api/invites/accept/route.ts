import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import { invites, orgMembers, users } from "@/db/schema";

const acceptSchema = z.object({
  token: z.string().min(1),
  name: z.string().trim().min(1).max(255),
  password: z.string().min(8),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = acceptSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }
  const { token, name, password } = parsed.data;

  const [invite] = await db.select().from(invites).where(eq(invites.token, token)).limit(1);
  if (!invite) {
    return NextResponse.json({ error: "This invite link is invalid." }, { status: 404 });
  }
  if (invite.acceptedAt) {
    return NextResponse.json({ error: "This invite has already been used. Try signing in instead." }, { status: 409 });
  }
  if (invite.expiresAt < new Date()) {
    return NextResponse.json({ error: "This invite has expired. Ask an admin to send a new one." }, { status: 410 });
  }

  // Re-checked here even though createInvite already checked at send time —
  // someone could have registered that email separately in the meantime.
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, invite.email)).limit(1);
  if (existing) {
    return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  try {
    await db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({ email: invite.email, name, passwordHash })
        .returning();
      await tx.insert(orgMembers).values({ orgId: invite.orgId, userId: user.id, role: invite.role });
      // Guard the update with isNull(acceptedAt) so two concurrent accepts of
      // the same link can't both succeed and create two accounts for it —
      // whichever loses the race hits the email unique constraint below and
      // rolls back instead.
      await tx
        .update(invites)
        .set({ acceptedAt: new Date() })
        .where(and(eq(invites.id, invite.id), isNull(invites.acceptedAt)));
    });
  } catch {
    // Almost certainly the email unique constraint from a concurrent accept
    // of this same link (or a separate signup that landed in between).
    return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
  }

  return NextResponse.json({ ok: true, email: invite.email });
}
