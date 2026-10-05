import { NextResponse } from "next/server";
import { and, desc, eq, notInArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { schedules, scheduleSnapshots, users } from "@/db/schema";
import { getOrgContextOrNull } from "@/lib/org";

// The scheduler document for the signed-in user's org, loaded and saved by
// the storage section of scheduler/index.html.

const DAILY_KEEP = 30;
const REPLACED_KEEP = 20;

// CILI runs on Central time (the scheduler pins it too), so "the first save of
// the day" means the day in Chicago, not UTC.
const centralDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Chicago",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function unauthorized() {
  return NextResponse.json({ ok: false, error: "you are signed out — sign in again to save" }, { status: 401 });
}

async function currentRow(orgId: string) {
  const [row] = await db
    .select({
      data: schedules.data,
      version: schedules.version,
      updatedAt: schedules.updatedAt,
      updatedBy: users.name,
    })
    .from(schedules)
    .leftJoin(users, eq(schedules.updatedById, users.id))
    .where(eq(schedules.orgId, orgId))
    .limit(1);
  return row ?? null;
}

export async function GET(request: Request) {
  const ctx = await getOrgContextOrNull();
  if (!ctx) return unauthorized();

  const row = await currentRow(ctx.org.id);
  const peek = new URL(request.url).searchParams.has("peek");
  return NextResponse.json(
    {
      ok: true,
      // `peek` is the cheap poll the page makes to notice someone else's save.
      data: peek ? undefined : (row?.data ?? null),
      version: row?.version ?? 0,
      updatedAt: row?.updatedAt ?? null,
      updatedBy: row?.updatedBy ?? null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

// Mirrors storeDataProblem() in the scheduler: anything that doesn't hold the
// lists is refused rather than stored, so a bad save can't replace real data.
const listOrMissing = z.array(z.record(z.unknown())).optional();
const saveSchema = z.object({
  baseVersion: z.number().int().min(0),
  force: z.boolean().optional(),
  keepOld: z.boolean().optional(),
  data: z
    .object({
      projects: z.array(z.record(z.unknown())),
      tools: listOrMissing,
      personnel: listOrMissing,
      equipment: listOrMissing,
    })
    .passthrough(),
});

type SaveResult =
  | { ok: true; version: number }
  | { ok: false; conflict: true; error: string; version: number };

export async function PUT(request: Request) {
  const ctx = await getOrgContextOrNull();
  if (!ctx) return unauthorized();

  const body = await request.json().catch(() => null);
  const parsed = saveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "the server could not read what was sent (" + (parsed.error.issues[0]?.message ?? "invalid") + ")" },
      { status: 400 },
    );
  }
  const { data, baseVersion, force, keepOld } = parsed.data;
  const orgId = ctx.org.id;
  const userId = ctx.user.id;

  const result = await db.transaction(async (tx): Promise<SaveResult> => {
    // Row lock: two saves for the same org queue here, so the version check
    // below can't be raced.
    const [row] = await tx
      .select({ data: schedules.data, version: schedules.version, updatedById: schedules.updatedById })
      .from(schedules)
      .where(eq(schedules.orgId, orgId))
      .for("update");

    if (!row) {
      // First save for this org. Two first-time windows racing both send
      // baseVersion 0; the loser's insert does nothing and gets a conflict.
      const inserted = await tx
        .insert(schedules)
        .values({ orgId, data, version: 1, updatedById: userId })
        .onConflictDoNothing()
        .returning({ version: schedules.version });
      if (inserted.length) return { ok: true, version: 1 };
      return { ok: false, conflict: true, error: "someone else saved the schedule first", version: 0 };
    }

    if (row.version !== baseVersion && !force) {
      const [by] = row.updatedById
        ? await tx.select({ name: users.name }).from(users).where(eq(users.id, row.updatedById))
        : [];
      return {
        ok: false,
        conflict: true,
        error: "the schedule was changed" + (by ? " by " + by.name : "") + " since this window loaded it",
        version: row.version,
      };
    }

    // Writing over a version this window never saw: keep that version first.
    if ((force && row.version !== baseVersion) || keepOld) {
      await tx.insert(scheduleSnapshots).values({
        orgId,
        kind: "replaced",
        data: row.data,
        version: row.version,
        createdById: userId,
      });
      await prune(tx, orgId, "replaced", REPLACED_KEEP);
    }

    // The document as it stood at the start of the day, taken by the first save of it.
    const day = centralDay.format(new Date());
    const daily = await tx
      .insert(scheduleSnapshots)
      .values({ orgId, kind: "daily", day, data: row.data, version: row.version, createdById: userId })
      .onConflictDoNothing()
      .returning({ id: scheduleSnapshots.id });
    if (daily.length) await prune(tx, orgId, "daily", DAILY_KEEP);

    const next = row.version + 1;
    await tx
      .update(schedules)
      .set({ data, version: next, updatedById: userId, updatedAt: new Date() })
      .where(eq(schedules.orgId, orgId));
    return { ok: true, version: next };
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 409 });
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function prune(tx: Tx, orgId: string, kind: "daily" | "replaced", keep: number) {
  const newest = await tx
    .select({ id: scheduleSnapshots.id })
    .from(scheduleSnapshots)
    .where(and(eq(scheduleSnapshots.orgId, orgId), eq(scheduleSnapshots.kind, kind)))
    .orderBy(desc(scheduleSnapshots.createdAt))
    .limit(keep);
  if (newest.length < keep) return;
  await tx.delete(scheduleSnapshots).where(
    and(
      eq(scheduleSnapshots.orgId, orgId),
      eq(scheduleSnapshots.kind, kind),
      notInArray(
        scheduleSnapshots.id,
        newest.map((r) => r.id),
      ),
    ),
  );
}
