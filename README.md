# CILI Scheduler

In-line inspection scheduling and milestone tracking for Cypress In-Line Inspection.

The scheduler comes in two builds of the same file, `desktop/app/index.html`:

| Build | Where the data lives | Folder |
|---|---|---|
| **Web app** (this repo's root) | Neon Postgres, shared by everyone in the organization | `app/`, `db/`, `lib/` |
| **Desktop app** (Electron) | `Documents\CILI Scheduler\cili-scheduler-data.json` | `desktop/` — see [desktop/README.md](desktop/README.md) |

Opened directly in a browser with no server, the same file falls back to browser storage.

## The web app

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
- **Server-side snapshots.** Like the desktop app's rolling backups: the schedule as it
  stood at the start of each day (last 30 kept), and any version someone chose to write
  over after a conflict (last 20 kept). They live in the `schedule_snapshots` table. There
  is no restore screen for them yet; restore by hand, or export one and use
  **Backup → Replace**.

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

1. **Neon:** create a project. Copy its **pooled** connection string; the host contains
   `-pooler`.
2. **Database tables:** from your machine, with `DATABASE_URL` set to that string, run
   `npm run db:migrate`. Re-run it whenever a change adds a migration in `db/migrations/`.
3. **Vercel:** *Add New → Project*, import this GitHub repo, and set these environment
   variables:
   - `DATABASE_URL`: the Neon pooled connection string
   - `AUTH_SECRET`: a random secret (`npx auth secret`)
4. Deploy, open the site, and register your organization at `/register`. Then invite
   your teammates from **Members**.

Every push to `main` redeploys production. Every other branch and pull request gets its
own preview URL.

## Working on it

See [CLAUDE.md](CLAUDE.md) for how the code is organized and the rules it follows.
