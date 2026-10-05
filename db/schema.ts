import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  pgEnum,
  jsonb,
  integer,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

/**
 * Accounts and org scoping follow the Project-Manager app: every row hangs
 * off an `organizations` row, and authorization reduces to "does this row's
 * org match the signed-in user's org".
 *
 * The scheduler's own data is not split into tables yet. Phase 1 serves the
 * existing single-file scheduler (scheduler/index.html) and stores its whole
 * document — the same JSON as its backup file — in one jsonb row per org
 * (`schedules`). Later phases move lists out of that document into
 * relational tables one at a time.
 */

export const memberRoleEnum = pgEnum("member_role", ["admin", "member"]);
export const snapshotKindEnum = pgEnum("snapshot_kind", ["daily", "replaced"]);

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const orgMembers = pgTable(
  "org_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: memberRoleEnum("role").notNull().default("member"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orgUserUnique: uniqueIndex("org_members_org_user_unique").on(table.orgId, table.userId),
  }),
);

/**
 * A pending invitation to join an org by email. `token` is the secret in the
 * accept-invite link (/invite/[token]); `acceptedAt` is set once, at which
 * point the invite is spent. An expired-but-unaccepted invite is left in
 * place so "already used" and "expired" can be told apart.
 */
export const invites = pgTable(
  "invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 255 }).notNull(),
    role: memberRoleEnum("role").notNull().default("member"),
    token: varchar("token", { length: 64 }).notNull(),
    invitedById: uuid("invited_by_id").references(() => users.id, { onDelete: "set null" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tokenUnique: uniqueIndex("invites_token_unique").on(table.token),
    orgIdx: index("invites_org_idx").on(table.orgId),
  }),
);

/**
 * The org's scheduler document. `version` goes up by one on every save and
 * is how two people editing at once are kept from overwriting each other:
 * a save names the version it was based on, and is refused as a conflict
 * if the row has moved on since (see app/api/schedule/route.ts).
 */
export const schedules = pgTable("schedules", {
  orgId: uuid("org_id")
    .primaryKey()
    .references(() => organizations.id, { onDelete: "cascade" }),
  data: jsonb("data").notNull(),
  version: integer("version").notNull().default(1),
  updatedById: uuid("updated_by_id").references(() => users.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Automatic snapshots of the schedule: `daily` is the document as it stood before the first save of each day
 * (Central time), `replaced` is a version someone chose to write over after
 * a conflict. Pruned to the newest few of each kind per org.
 */
export const scheduleSnapshots = pgTable(
  "schedule_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    kind: snapshotKindEnum("kind").notNull(),
    // The Central-time calendar day a `daily` snapshot belongs to; null for `replaced`.
    day: varchar("day", { length: 10 }),
    data: jsonb("data").notNull(),
    version: integer("version").notNull(),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orgKindIdx: index("schedule_snapshots_org_kind_idx").on(table.orgId, table.kind, table.createdAt),
    orgDayUnique: uniqueIndex("schedule_snapshots_org_daily_unique").on(table.orgId, table.kind, table.day),
  }),
);
