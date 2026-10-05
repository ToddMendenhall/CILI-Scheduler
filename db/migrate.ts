import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

// `npm run db:migrate` runs pending migrations against DATABASE_URL.
//
// `--deploy` is how `npm run build` calls it: there it migrates only on a
// Vercel production build (VERCEL_ENV=production, i.e. a merge to main), and
// skips everywhere else — local builds, and Vercel preview builds for
// branches and PRs, which would otherwise apply an unmerged branch's schema
// changes to the live database. A failed migration fails the build, so a
// deploy never goes live against a schema it doesn't match.
const deployMode = process.argv.includes("--deploy");

async function main() {
  if (deployMode && process.env.VERCEL_ENV !== "production") {
    console.log("Skipping migrations: not a Vercel production build.");
    return;
  }

  // Vercel's Neon integration also sets DATABASE_URL_UNPOOLED, a direct
  // (non-pooler) connection, which Neon recommends for schema changes.
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }

  // onnotice: Postgres's "already exists, skipping" notices on every rerun
  // would otherwise clutter each deploy's build log.
  const migrationClient = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
  const db = drizzle(migrationClient);

  console.log("Running migrations...");
  await migrate(db, { migrationsFolder: "./db/migrations" });
  console.log("Migrations complete.");

  await migrationClient.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
