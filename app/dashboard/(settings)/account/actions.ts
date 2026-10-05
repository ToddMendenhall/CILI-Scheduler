"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireOrgContext } from "@/lib/org";

// Expected, user-facing validation failures (wrong current password, etc.)
// are *returned* as { ok: false, error } rather than thrown — see the same
// note in app/dashboard/members/actions.ts for why: Next.js redacts the
// message of anything thrown out of a Server Action in production.
export type ActionResult = { ok: true } | { ok: false; error: string };

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
});

/** Self-service password change — always operates on the signed-in user's own account. */
export async function changePassword(formData: FormData): Promise<ActionResult> {
  const ctx = await requireOrgContext();

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const [user] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, ctx.user.id))
    .limit(1);
  if (!user) {
    return { ok: false, error: "Account not found." };
  }

  const matches = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!matches) {
    return { ok: false, error: "Current password is incorrect." };
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
  await db.update(users).set({ passwordHash }).where(eq(users.id, ctx.user.id));

  return { ok: true };
}
