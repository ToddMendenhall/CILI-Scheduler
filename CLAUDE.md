# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

CILI Scheduler: in-line inspection job scheduling (projects with prep / mobilization /
onsite / demob / refurb phases, milestones, personnel, tools, equipment) for Cypress
In-Line Inspection. It started as one self-contained HTML file and is being moved,
in phases, onto the same stack as the sibling Project-Manager app: Next.js 15 (App
Router) + TypeScript, PostgreSQL (Neon) via Drizzle ORM, Auth.js v5 (Credentials, JWT
sessions), Tailwind, deployed on Vercel. Organizations are multi-tenant, as in
Project-Manager.

## Commands

```bash
npm install
npm run dev               # dev server
npm run build             # production build (also type-checks)
npx tsc --noEmit          # type-check only
npm run db:generate       # generate a migration from db/schema.ts changes
npm run db:migrate        # run pending migrations
npm run db:seed           # sample org + admin (admin@example.com / password123)
```

`DATABASE_URL` and `AUTH_SECRET` must be set (see `.env.example`). Lint isn't configured.

There is no automated test suite. Verify each change the way Project-Manager does:
typecheck → build → smoke-test with a throwaway Playwright script against a real local
Postgres in both `next dev` and `next build && next start` → delete the script → commit.
For anything touching storage, test with **two signed-in users in the same org**:
saving, picking up the other user's save, and both sides of a conflict.

## Phase 1 architecture: the scheduler runs unchanged inside the web app

- `desktop/app/index.html` is **the** scheduler: one file, about 8,000 lines, with no
  build step. It is shared by three runtimes and must keep working in all of them:
  - **Web app:** `app/scheduler/route.ts` serves it with
    `<script src="/scheduler/server-store.js">` injected before `</head>`. `/dashboard`
    frames it under the app header.
  - **Desktop (Electron):** `desktop/`. Its preload sets `window.ciliStore` to a bridge
    to a JSON file.
  - **Plain browser:** opened as a file with no bridge, it uses `localStorage`.
- **Storage seam.** `detectStore()` in the HTML picks the mode: when a
  `window.ciliStore` bridge exists, `storeMode` is `'desktop'`. The web app's bridge
  (`public/scheduler/server-store.js`) implements the same `load()` / `save(payload, how)`
  contract as the desktop preload, plus `kind: 'server'` and `peek()`. `serverMode` in
  the HTML is set from `kind`, and only changes wording (`storeText()` / `recordName()`)
  and turns on `watchServer()`.
  When adding a storage feature, extend the bridge contract rather than branching the
  HTML on something else, and keep desktop and plain-browser behaviour identical.
- **Data model.** One jsonb document per org in `schedules` (`db/schema.ts`). Its shape
  is the scheduler's backup-file format (`format`, `version`, `savedAt`, `config`,
  `tools`, `personnel`, `equipment`, `projects`), the same as the desktop data file, so
  a backup, the desktop file and the DB row all hold the same JSON.
- **Concurrency.** `schedules.version` is optimistic locking. A save sends the
  `baseVersion` it was built on. `PUT /api/schedule` takes a row lock and refuses a
  stale base with a 409 `{conflict: true}`, and the HTML's existing conflict banner
  offers "Load the latest version" or "Keep what is here" (`force`). Never make saves
  last-write-wins.
- **Snapshots.** `schedule_snapshots`: one `daily` per org per Central-time day (the
  document before that day's first save, last 30 kept), plus `replaced` whenever a
  forced save writes over a version the saver hadn't seen (last 20 kept). These mirror
  the desktop app's `daily-*` / `replaced-*` backups.
- **Picking up others' saves.** `watchServer()` polls `GET /api/schedule?peek=1` every
  15s and on focus. It reloads quietly only when `quietReloadSafe()` holds: nothing
  unsaved, no save in flight, no conflict, and no editor or confirm dialog open. A
  quiet reload keeps the window's own `config` (zoom and view), as browser tabs do.
- `next.config.js` `outputFileTracingIncludes` puts the HTML into the `/scheduler`
  route's serverless bundle. Without it, Vercel deployments 500 on that route.

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
