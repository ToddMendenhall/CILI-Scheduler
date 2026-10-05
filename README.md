# CILI Scheduler

In-line inspection scheduling and milestone tracking for Cypress In-Line Inspection.

A cloud web app, like Project-Manager: everyone signs in and works on one shared schedule
for their organization, stored in Postgres.

## How it works

Next.js 15 + TypeScript, PostgreSQL via Drizzle ORM, Auth.js (email + password),
Tailwind. Built to deploy on Vercel with a Neon database, the same stack as
Project-Manager.

- **Sign-in and organizations.** Anyone can register a new organization at `/register`
  and becomes its admin. Admins invite others from **Members**. Each invite is a link
  the admin copies and sends; the invitee sets their own password.
- **One shared schedule per organization.** Everyone in the org sees and edits the same
  schedule. Saves are versioned. If two people change it at once, the second save is
  refused and a banner asks which version to keep, so nobody's work is silently
  overwritten. An open window picks up other people's saves automatically whenever it
  has nothing unsaved.
- **Automatic snapshots.** The schedule as it stood at the start of each day (last 30
  kept), and any version someone chose to write over after a conflict (last 20 kept).
  They live in the `schedule_snapshots` table. There is no restore screen for them yet;
  restore by hand, or export one and use **Backup → Replace**.

### Run it locally

You need Node.js 22+ and a Postgres database: a local one, or a Neon branch.

```bash
npm install
cp .env.example .env      # then fill in DATABASE_URL and AUTH_SECRET (npx auth secret)
npm run db:migrate        # create the tables
npm run db:seed           # optional: sample org, sign in as admin@example.com / password123
npm run dev               # http://localhost:3000
```

### Deploy (Neon + Vercel)

1. **Neon:** create a project. Open **Connect**, turn on **Connection pooling**, and copy
   the connection string; its host contains `-pooler`.
2. **Vercel:** *Add New → Project*, import this GitHub repo, and set these environment
   variables:
   - `DATABASE_URL`: the Neon pooled connection string
   - `AUTH_SECRET`: a random secret (`npx auth secret`)

   You can instead connect Neon from Vercel (**Storage → Connect Database → Neon**),
   which sets `DATABASE_URL` for you. You still add `AUTH_SECRET` yourself.
3. Deploy. The production build creates the database tables itself (see below). Then
   open the site, register your organization at `/register`, and invite your teammates
   from **Members**.

Every push to `main` redeploys production. Every other branch and pull request gets its
own preview URL.

**Database migrations run automatically on production deploys.** `npm run build` runs
`db/migrate.ts --deploy` before `next build`. It applies pending migrations only when
`VERCEL_ENV=production`, so preview builds for branches and PRs never change the live
database, and local builds don't touch any database. A migration that fails, fails the
deploy, so the site never goes live against a schema it doesn't match. If
`DATABASE_URL_UNPOOLED` is set (Vercel's Neon integration sets it), migrations use that
direct connection. To migrate a database by hand, run `npm run db:migrate`.

## Working on it

See [CLAUDE.md](CLAUDE.md) for how the code is organized and the rules it follows.
