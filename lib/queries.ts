import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { invites, orgMembers, organizations, users } from "@/db/schema";

/** An org's invites that haven't been accepted yet (expired ones included, so they can be revoked). */
export async function getPendingInvitesForOrg(orgId: string) {
  return db
    .select({
      id: invites.id,
      email: invites.email,
      role: invites.role,
      token: invites.token,
      expiresAt: invites.expiresAt,
      createdAt: invites.createdAt,
    })
    .from(invites)
    .where(and(eq(invites.orgId, orgId), isNull(invites.acceptedAt)))
    .orderBy(desc(invites.createdAt));
}

/** Fetches an invite by its link token, with the org name for display on the public accept page. */
export async function getInviteByToken(token: string) {
  const [row] = await db
    .select({
      id: invites.id,
      orgId: invites.orgId,
      orgName: organizations.name,
      email: invites.email,
      role: invites.role,
      expiresAt: invites.expiresAt,
      acceptedAt: invites.acceptedAt,
    })
    .from(invites)
    .innerJoin(organizations, eq(invites.orgId, organizations.id))
    .where(eq(invites.token, token))
    .limit(1);

  return row ?? null;
}

/** Org members with account details (role, joined date) — used by the admin Members page. */
export async function getOrgMembersDetailed(orgId: string) {
  return db
    .select({
      userId: users.id,
      name: users.name,
      email: users.email,
      role: orgMembers.role,
      createdAt: orgMembers.createdAt,
    })
    .from(orgMembers)
    .innerJoin(users, eq(orgMembers.userId, users.id))
    .where(eq(orgMembers.orgId, orgId))
    .orderBy(users.name);
}
