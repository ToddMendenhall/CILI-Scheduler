import "server-only";
import { db } from "@/db";
import { organizations } from "@/db/schema";

// Sign-up is by invitation. Anyone may create an organization only while none
// exists yet (a brand-new deployment), or while ALLOW_REGISTRATION=true is set
// in the environment (to set up another organization on purpose). Everyone else
// joins through an admin's invite (Members).

export function registrationForcedOpen() {
  return process.env.ALLOW_REGISTRATION === "true";
}

/** Whether a new organization may be created now. */
export async function registrationOpen(): Promise<boolean> {
  if (registrationForcedOpen()) return true;
  const [row] = await db.select({ id: organizations.id }).from(organizations).limit(1);
  return !row;
}
