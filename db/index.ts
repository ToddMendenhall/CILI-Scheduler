import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

// prepare: false — required for Neon's (and most poolers') pooled connection
// endpoints, which run in transaction mode and don't support prepared
// statements across queries.
const client = postgres(process.env.DATABASE_URL, { max: 10, prepare: false });

export const db = drizzle(client, { schema });
