import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import bcrypt from "bcryptjs";
import * as schema from "./schema";

// Creates a sample org with one admin, for local development. The schedule
// itself is left empty: the scheduler creates its document on first load,
// exactly as it does for an org that registered through /register.
async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }

  const client = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
  const db = drizzle(client, { schema });

  console.log("Seeding sample org and admin...");

  const [org] = await db
    .insert(schema.organizations)
    .values({ name: "Sample Organization", slug: "sample-org" })
    .returning();

  const passwordHash = await bcrypt.hash("password123", 10);
  const [user] = await db
    .insert(schema.users)
    .values({ email: "admin@example.com", name: "Sample Admin", passwordHash })
    .returning();

  await db.insert(schema.orgMembers).values({ orgId: org.id, userId: user.id, role: "admin" });

  console.log("Seed complete. Sign in as admin@example.com / password123");
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
