# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

CILI Scheduler: in-line inspection job scheduling (projects with prep / mobilization /
onsite / demob / refurb phases, milestones, personnel, tools, equipment) for Cypress
In-Line Inspection. It started as one self-contained HTML file and is being moved,
in phases, onto the same stack as the sibling Project-Manager app: Next.js 15 (App
Router) + TypeScript, PostgreSQL (Neon) via Drizzle ORM, Auth.js v5 (Credentials, JWT
sessions), Tailwind, deployed on Vercel. Organizations are multi-tenant, as in
Project-Manager. It is cloud-only: there is no desktop or offline build.

## Commands

```bash
npm install
npm run dev               # dev server
npm run build             # production build (also type-checks); on Vercel production it migrates first
npx tsc --noEmit          # type-check only
npm run db:generate       # generate a migration from db/schema.ts changes
npm run db:migrate        # run pending migrations by hand
npm run db:seed           # sample org + admin (admin@example.com / password123)
```

`DATABASE_URL` and `AUTH_SECRET` must be set (see `.env.example`). Lint isn't configured.

Migrations deploy themselves. The `build` script runs `tsx db/migrate.ts --deploy`
before `next build`, which applies pending migrations only when
`VERCEL_ENV=production` (a merge to `main`), and is skipped for local and preview
builds. So a schema change ships by committing its generated migration
(`npm run db:generate`) with the code that needs it. Migrations must stay safe to
apply while the previous deploy is still serving traffic, so make additive changes
and only remove columns in a later deploy.

There is no automated test suite. Verify each change the way Project-Manager does:
typecheck → build → smoke-test with a throwaway Playwright script against a real local
Postgres in both `next dev` and `next build && next start` → delete the script → commit.
For anything touching storage, test with **two signed-in users in the same org**:
saving, picking up the other user's save, and both sides of a conflict.

## Phase 1 architecture: the scheduler page inside the web app

- `scheduler/index.html` is the scheduler: one self-contained file, about 8,500 lines
  of HTML, CSS and plain JS, with no build step. `app/scheduler/route.ts` serves it to
  signed-in org members (with `frame-ancestors 'self'`), and `/dashboard` frames it
  under the app header. It only works when served by the app, because it loads and saves
  through `/api/schedule`. Opened as a file it shows a "could not be loaded" banner and
  saves nothing.
- **Storage** is the `// ---------- storage ----------` section of the HTML:
  `loadState()` (GET), `saveKey()`, which marks a change and debounces it into
  `flushSave()` (PUT of the whole document), `reloadFromServer()`, and `watchServer()`.
  The rest of the HTML only calls `saveKey(listName, state[listName])` after changing
  `state`. What loading does by itself (older records brought to the current shape,
  jobs tied to their library rows) is saved through `autoSave()`. Such a save gives way
  on a 409: the window takes the other version with a quiet reload instead of showing
  the conflict banner, because nobody's work is in it.
- **Data model.** One jsonb document per org in `schedules` (`db/schema.ts`). Its shape
  is the scheduler's backup-file format (`format`, `version`, `savedAt`, `config`,
  `tools`, `personnel`, `equipment`, `projects`), so **Backup** downloads exactly what
  the row holds and **Backup → Replace** writes a file straight back to it. Unknown
  top-level keys are carried through untouched (`docExtras`).
- **Library references.** A job names each tool, person and piece of equipment by the
  library row's `key` (`toolKeys`, `personnelKeys`, `equipmentKeys`), beside the name
  lists (`tools`, `fieldPersonnel`, `equipment`). The key says which row; the name is
  what is shown, kept in step with the row while it is in the library and kept as the
  record once it has left. Jobs from before keys are tied to rows by name once, on
  load (`linkJobRefs()`); `refNames` records the names as this version last set them.
  See the `how a job refers to the library` section of the HTML.
- **Concurrency.** `schedules.version` is optimistic locking. A save sends the
  `baseVersion` it was built on (`serverVersion` in the HTML). `PUT /api/schedule`
  takes a row lock and refuses a stale base with 409 `{conflict: true}`. The banner then
  offers "Load the latest version" (`reloadFromServer`) or "Keep what is here"
  (`force`). Never make saves last-write-wins.
- **Snapshots.** `schedule_snapshots`: one `daily` per org per Central-time day (the
  document before that day's first save, last 30 kept), plus `replaced` whenever a
  forced save writes over a version the saver hadn't seen (last 20 kept).
- **Picking up others' saves.** `watchServer()` polls `GET /api/schedule?peek=1` every
  15s and on focus. It reloads quietly only when `quietReloadSafe()` holds: nothing
  unsaved, no save in flight, no conflict, no drag in progress, and no editor or confirm
  dialog open. A quiet reload keeps the window's own `config` (zoom and view).
- **Never write over a schedule that failed to load.** If the GET fails or the
  document can't all be read, `saveBlocked` is set, and only **Backup → Replace** clears
  it. An org with no row yet (first visit) gets an empty schedule created.
- `next.config.js` `outputFileTracingIncludes` puts `scheduler/index.html` into the
  `/scheduler` route's serverless bundle. Without it, Vercel deployments 500 on that
  route.

Later phases replace parts of the HTML with React pages and move lists out of the
jsonb document into relational tables, one at a time. Until a list has moved, the
document stays the source of truth for it.

## Shared with Project-Manager

Auth, orgs, members and invites were copied from Project-Manager and follow its rules:

- `lib/org.ts`: `requireOrgContext()` is the guard for pages and server actions
  (redirects). `getOrgContextOrNull()` is the route-handler variant (answer 401 JSON).
  `requireAdmin(ctx)` is only for member/invite management.
  Every query is scoped to `ctx.org.id`. Never trust an org id from the client.
- Split Auth.js config: `lib/auth.config.ts` is edge-safe (used by `middleware.ts`) and
  must keep `trustHost: true`. `lib/auth.ts` holds the Credentials provider.
- Client `signIn()` calls pass an explicit `callbackUrl`.
- Never render two native `<form action={serverAction}>` in one page tree (a
  Next.js/React FormData bug). Use the function-call pattern for the second mutation.
- Server actions return `{ ok: false, error }` for user-facing failures instead of
  throwing, because Next.js redacts thrown messages in production.
- All `postgres()` clients pass `prepare: false`, which Neon's pooled endpoint requires.
- `app/dashboard/(settings)/` is a route group for ordinary padded pages (members,
  account). `app/dashboard/page.tsx` is the full-bleed scheduler frame.

## Security

- **Sign-up is by invitation** (`lib/registration.ts`). `/register` and `POST /api/register`
  work only while no organization exists (a brand-new deployment), or with
  `ALLOW_REGISTRATION=true` set. Everyone else joins through an admin's invite. The
  check is made again inside the sign-up transaction, under an advisory lock.
- **Sign-in is limited** (`lib/sign-in-limit.ts`, table `sign_in_attempts`).
  - Within 15 minutes it allows 10 attempts for one email from one address, 50 from one
    address, and 100 for one email from anywhere. With no address, 10 per email.
  - Every attempt is counted before its password is checked, one atomic upsert per key,
    so attempts sent all at once cannot get past a limit. The keys are counted in that
    order and counting stops at the first limit reached, so an attempt refused at one
    address adds nothing to that email's count: shutting someone out everywhere takes
    a hundred attempts from ten addresses or more. An address already at its limit is
    refused before anything is written, so new emails from it cannot fill the table.
  - A correct password clears its email's count at its address and gives back the
    attempt it was charged under the other two.
  - Past a limit, `authorize()` throws a `CredentialsSignin` with code
    `too_many_attempts`, and the sign-in page says to wait.
  - It fails closed: if the attempt cannot be counted, no password is checked. The one
    exception is a database the migration has not reached (the table is missing), where
    sign-in goes on unlimited and logs an error.
  - The current password on the change-password form is counted the same way.
  - The client address comes from `x-forwarded-for`, which Vercel overwrites, so it can
    be faked anywhere else. IPv6 addresses count by their /64 network.
  - To let someone back in before the window ends, delete their rows from
    `sign_in_attempts` (keys start `pair:<email>|`, `email:<email>`, `addr:<address>`).
  - An unknown email is checked against a placeholder hash, so the answer takes as long
    as for a wrong password.
- **The sign-in page opens only paths on this site** after signing in (`safeCallback` in
  `app/login/page.tsx`). It parses `callbackUrl` as the browser will, which drops tabs and
  newlines and reads `\` as `/`, and refuses any other origin or a path starting `//`.
- **New passwords** need at least 12 characters: sign-up, invite and password change.
- **Headers** (`next.config.js`). Every response carries X-Frame-Options,
  `frame-ancestors 'self'`, nosniff, Referrer-Policy, Permissions-Policy and HSTS.
  `/scheduler` sends a strict CSP of its own (`app/scheduler/route.ts`):
  - Only the page's inline script may run, named by its SHA-256 hash, which is worked out
    from the file as served (line endings made `\n` first, as browsers do).
  - `connect-src` is `'self'`, and objects are blocked.
  - Keep the page free of inline event handlers (`onclick=` and the like), `eval` and
    outside scripts, or the policy will block them.
