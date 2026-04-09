import { relations, sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export type TableSpec = {
  tableName: string;
  purpose: string;
  containsSensitiveData: boolean;
  mvpRequired: boolean;
};

export type SensitiveFieldControl = {
  fieldPath: string;
  protection: string;
};

export const databaseExtensions = ["pgcrypto"] as const;

export const coachingStyleEnum = pgEnum("coaching_style", ["direct", "supportive"]);
export const goalPriorityEnum = pgEnum("goal_priority", ["A", "B", "C"]);
export const workoutTypeEnum = pgEnum("workout_type", ["easy", "tempo", "interval", "long", "recovery"]);
export const coachMemoryCategoryEnum = pgEnum("coach_memory_category", [
  "goal",
  "injury",
  "preference",
  "pattern",
]);
export const sourceProviderEnum = pgEnum("source_provider", ["strava", "telegram", "manual"]);
export const sourceConnectionStatusEnum = pgEnum("source_connection_status", [
  "pending",
  "connected",
  "paused",
  "error",
]);
export const rawImportStatusEnum = pgEnum("raw_import_status", ["pending", "processed", "failed", "discarded"]);
export const messageChannelEnum = pgEnum("message_channel", ["telegram", "dashboard", "system"]);
export const messageDirectionEnum = pgEnum("message_direction", ["inbound", "outbound", "system"]);
export const auditActorTypeEnum = pgEnum("audit_actor_type", ["athlete", "coach", "system", "integration"]);
export const auditOutcomeEnum = pgEnum("audit_outcome", ["success", "failure", "blocked"]);

export type CoachingStyle = (typeof coachingStyleEnum.enumValues)[number];
export type GoalPriority = (typeof goalPriorityEnum.enumValues)[number];
export type WorkoutType = (typeof workoutTypeEnum.enumValues)[number];
export type CoachMemoryCategory = (typeof coachMemoryCategoryEnum.enumValues)[number];
export type SourceProvider = (typeof sourceProviderEnum.enumValues)[number];
export type SourceConnectionStatus = (typeof sourceConnectionStatusEnum.enumValues)[number];
export type RawImportStatus = (typeof rawImportStatusEnum.enumValues)[number];
export type MessageChannel = (typeof messageChannelEnum.enumValues)[number];
export type MessageDirection = (typeof messageDirectionEnum.enumValues)[number];
export type AuditActorType = (typeof auditActorTypeEnum.enumValues)[number];
export type AuditOutcome = (typeof auditOutcomeEnum.enumValues)[number];

export const athleteProfiles = pgTable(
  "athlete_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    externalKey: text("external_key").notNull(),
    displayName: text("display_name").notNull(),
    timezone: text("timezone").notNull(),
    preferredLongRunDay: text("preferred_long_run_day").notNull(),
    coachingStyle: coachingStyleEnum("coaching_style").notNull(),
    constraints: jsonb("constraints").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    injuryFlagsCiphertext: text("injury_flags_ciphertext"),
    injuryFlagsPreview: jsonb("injury_flags_preview").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("athlete_profiles_external_key_idx").on(table.externalKey),
  ],
);

export const goals = pgTable(
  "goals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    athleteId: uuid("athlete_id")
      .notNull()
      .references(() => athleteProfiles.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    targetDate: date("target_date", { mode: "string" }).notNull(),
    priority: goalPriorityEnum("priority").notNull(),
    notes: text("notes").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("goals_athlete_target_date_idx").on(table.athleteId, table.targetDate),
  ],
);

export const sourceConnections = pgTable(
  "source_connections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    athleteId: uuid("athlete_id")
      .notNull()
      .references(() => athleteProfiles.id, { onDelete: "cascade" }),
    provider: sourceProviderEnum("provider").notNull(),
    status: sourceConnectionStatusEnum("status").notNull().default("pending"),
    externalAthleteId: text("external_athlete_id"),
    scopes: jsonb("scopes").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    accessTokenCiphertext: text("access_token_ciphertext"),
    refreshTokenCiphertext: text("refresh_token_ciphertext"),
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
    webhookSecretCiphertext: text("webhook_secret_ciphertext"),
    connectedAt: timestamp("connected_at", { withTimezone: true }),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("source_connections_athlete_provider_idx").on(table.athleteId, table.provider),
    index("source_connections_status_idx").on(table.status, table.provider),
  ],
);

export const rawImports = pgTable(
  "raw_imports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    athleteId: uuid("athlete_id")
      .notNull()
      .references(() => athleteProfiles.id, { onDelete: "cascade" }),
    sourceConnectionId: uuid("source_connection_id").references(() => sourceConnections.id, {
      onDelete: "set null",
    }),
    provider: sourceProviderEnum("provider").notNull(),
    importType: text("import_type").notNull(),
    sourceObjectId: text("source_object_id"),
    status: rawImportStatusEnum("status").notNull().default("pending"),
    rawPayloadCiphertext: text("raw_payload_ciphertext").notNull(),
    rawPayloadSha256: text("raw_payload_sha256").notNull(),
    failureReason: text("failure_reason"),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("raw_imports_athlete_provider_source_object_idx").on(
      table.athleteId,
      table.provider,
      table.sourceObjectId,
    ),
    index("raw_imports_athlete_status_idx").on(table.athleteId, table.status, table.receivedAt),
  ],
);

export const completedWorkouts = pgTable(
  "completed_workouts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    athleteId: uuid("athlete_id")
      .notNull()
      .references(() => athleteProfiles.id, { onDelete: "cascade" }),
    rawImportId: uuid("raw_import_id").references(() => rawImports.id, {
      onDelete: "set null",
    }),
    source: sourceProviderEnum("source").notNull().default("strava"),
    sourceWorkoutId: text("source_workout_id"),
    date: date("date", { mode: "string" }).notNull(),
    type: workoutTypeEnum("type").notNull(),
    distanceKm: numeric("distance_km", { precision: 6, scale: 2, mode: "number" }).notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    perceivedEffort: integer("perceived_effort").notNull(),
    summary: text("summary").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("completed_workouts_raw_import_idx").on(table.rawImportId),
    uniqueIndex("completed_workouts_athlete_source_identity_idx").on(
      table.athleteId,
      table.source,
      table.sourceWorkoutId,
    ),
    index("completed_workouts_athlete_date_idx").on(table.athleteId, table.date),
    check("completed_workouts_distance_non_negative", sql`${table.distanceKm} >= 0`),
    check("completed_workouts_duration_positive", sql`${table.durationMinutes} > 0`),
    check("completed_workouts_perceived_effort_range", sql`${table.perceivedEffort} BETWEEN 1 AND 10`),
  ],
);

export const coachMemories = pgTable(
  "coach_memories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    athleteId: uuid("athlete_id")
      .notNull()
      .references(() => athleteProfiles.id, { onDelete: "cascade" }),
    category: coachMemoryCategoryEnum("category").notNull(),
    title: text("title").notNull(),
    detailCiphertext: text("detail_ciphertext").notNull(),
    detailSummary: text("detail_summary").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("coach_memories_athlete_category_idx").on(table.athleteId, table.category),
  ],
);

export const coachMessages = pgTable(
  "coach_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    athleteId: uuid("athlete_id")
      .notNull()
      .references(() => athleteProfiles.id, { onDelete: "cascade" }),
    sourceConnectionId: uuid("source_connection_id").references(() => sourceConnections.id, {
      onDelete: "set null",
    }),
    channel: messageChannelEnum("channel").notNull(),
    direction: messageDirectionEnum("direction").notNull(),
    externalMessageId: text("external_message_id"),
    bodyCiphertext: text("body_ciphertext").notNull(),
    bodyPreview: text("body_preview").notNull(),
    messageMetadata: jsonb("message_metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("coach_messages_athlete_channel_external_id_idx").on(
      table.athleteId,
      table.channel,
      table.externalMessageId,
    ),
    index("coach_messages_athlete_sent_at_idx").on(table.athleteId, table.sentAt),
  ],
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    athleteId: uuid("athlete_id").references(() => athleteProfiles.id, { onDelete: "set null" }),
    actorType: auditActorTypeEnum("actor_type").notNull(),
    actorId: text("actor_id"),
    action: text("action").notNull(),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id"),
    outcome: auditOutcomeEnum("outcome").notNull(),
    ipAddressHash: text("ip_address_hash"),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("audit_events_actor_idx").on(table.actorType, table.actorId),
    index("audit_events_resource_idx").on(table.resourceType, table.resourceId),
    index("audit_events_occurred_at_idx").on(table.occurredAt),
  ],
);

export const athleteProfilesRelations = relations(athleteProfiles, ({ many }) => ({
  goals: many(goals),
  completedWorkouts: many(completedWorkouts),
  coachMemories: many(coachMemories),
  coachMessages: many(coachMessages),
  sourceConnections: many(sourceConnections),
  rawImports: many(rawImports),
  auditEvents: many(auditEvents),
}));

export const goalsRelations = relations(goals, ({ one }) => ({
  athlete: one(athleteProfiles, {
    fields: [goals.athleteId],
    references: [athleteProfiles.id],
  }),
}));

export const sourceConnectionsRelations = relations(sourceConnections, ({ one, many }) => ({
  athlete: one(athleteProfiles, {
    fields: [sourceConnections.athleteId],
    references: [athleteProfiles.id],
  }),
  rawImports: many(rawImports),
  coachMessages: many(coachMessages),
}));

export const rawImportsRelations = relations(rawImports, ({ one }) => ({
  athlete: one(athleteProfiles, {
    fields: [rawImports.athleteId],
    references: [athleteProfiles.id],
  }),
  sourceConnection: one(sourceConnections, {
    fields: [rawImports.sourceConnectionId],
    references: [sourceConnections.id],
  }),
  completedWorkout: one(completedWorkouts, {
    fields: [rawImports.id],
    references: [completedWorkouts.rawImportId],
  }),
}));

export const completedWorkoutsRelations = relations(completedWorkouts, ({ one }) => ({
  athlete: one(athleteProfiles, {
    fields: [completedWorkouts.athleteId],
    references: [athleteProfiles.id],
  }),
  rawImport: one(rawImports, {
    fields: [completedWorkouts.rawImportId],
    references: [rawImports.id],
  }),
}));

export const coachMemoriesRelations = relations(coachMemories, ({ one }) => ({
  athlete: one(athleteProfiles, {
    fields: [coachMemories.athleteId],
    references: [athleteProfiles.id],
  }),
}));

export const coachMessagesRelations = relations(coachMessages, ({ one }) => ({
  athlete: one(athleteProfiles, {
    fields: [coachMessages.athleteId],
    references: [athleteProfiles.id],
  }),
  sourceConnection: one(sourceConnections, {
    fields: [coachMessages.sourceConnectionId],
    references: [sourceConnections.id],
  }),
}));

export const auditEventsRelations = relations(auditEvents, ({ one }) => ({
  athlete: one(athleteProfiles, {
    fields: [auditEvents.athleteId],
    references: [athleteProfiles.id],
  }),
}));

export const dbSchema = {
  athleteProfiles,
  goals,
  completedWorkouts,
  coachMemories,
  coachMessages,
  sourceConnections,
  rawImports,
  auditEvents,
};

export const tableCatalog: TableSpec[] = [
  {
    tableName: "athlete_profiles",
    purpose: "Canonical athlete identity, timezone, coaching preferences, and encrypted injury context.",
    containsSensitiveData: true,
    mvpRequired: true,
  },
  {
    tableName: "goals",
    purpose: "Goal targets and priority ordering that guide current coaching decisions.",
    containsSensitiveData: true,
    mvpRequired: true,
  },
  {
    tableName: "completed_workouts",
    purpose: "Normalized completed workout history with durable source linkage back to imports.",
    containsSensitiveData: true,
    mvpRequired: true,
  },
  {
    tableName: "coach_memories",
    purpose: "Long-lived coaching memory with encrypted detail storage and redacted summaries.",
    containsSensitiveData: true,
    mvpRequired: true,
  },
  {
    tableName: "coach_messages",
    purpose: "Inbound and outbound coaching messages across Telegram, dashboard, and system channels.",
    containsSensitiveData: true,
    mvpRequired: true,
  },
  {
    tableName: "source_connections",
    purpose: "OAuth/webhook connection state for Strava, Telegram, and manual source adapters.",
    containsSensitiveData: true,
    mvpRequired: true,
  },
  {
    tableName: "raw_imports",
    purpose: "Encrypted raw ingestion payloads and processing status before canonical normalization.",
    containsSensitiveData: true,
    mvpRequired: true,
  },
  {
    tableName: "audit_events",
    purpose: "Operational and security trail for actor actions without storing full sensitive payload bodies.",
    containsSensitiveData: false,
    mvpRequired: true,
  },
];

export const sensitiveFieldControls: SensitiveFieldControl[] = [
  {
    fieldPath: "athlete_profiles.injury_flags_ciphertext",
    protection: "Application-layer encryption with privacy-minimized previews for product surfaces.",
  },
  {
    fieldPath: "source_connections.access_token_ciphertext",
    protection: "Application-layer encryption, secrets rotation, and restricted service access.",
  },
  {
    fieldPath: "source_connections.refresh_token_ciphertext",
    protection: "Application-layer encryption and least-privilege access controls.",
  },
  {
    fieldPath: "source_connections.webhook_secret_ciphertext",
    protection: "Application-layer encryption and webhook-specific secret rotation.",
  },
  {
    fieldPath: "coach_memories.detail_ciphertext",
    protection: "Application-layer encryption for injury and health-adjacent details.",
  },
  {
    fieldPath: "coach_messages.body_ciphertext",
    protection: "Encryption at rest plus redaction from logs and low-trust message surfaces.",
  },
  {
    fieldPath: "raw_imports.raw_payload_ciphertext",
    protection: "Application-layer encryption with SHA-256 integrity tracking for replay-safe processing.",
  },
];

export function getSensitiveFieldControl(fieldPath: string) {
  return sensitiveFieldControls.find((control) => control.fieldPath === fieldPath);
}

export function isSensitiveField(fieldPath: string) {
  return getSensitiveFieldControl(fieldPath) !== undefined;
}

export type AthleteProfileRow = typeof athleteProfiles.$inferSelect;
export type NewAthleteProfile = typeof athleteProfiles.$inferInsert;
export type GoalRow = typeof goals.$inferSelect;
export type NewGoal = typeof goals.$inferInsert;
export type CompletedWorkoutRow = typeof completedWorkouts.$inferSelect;
export type NewCompletedWorkout = typeof completedWorkouts.$inferInsert;
export type CoachMemoryRow = typeof coachMemories.$inferSelect;
export type NewCoachMemory = typeof coachMemories.$inferInsert;
export type CoachMessageRow = typeof coachMessages.$inferSelect;
export type NewCoachMessage = typeof coachMessages.$inferInsert;
export type SourceConnectionRow = typeof sourceConnections.$inferSelect;
export type NewSourceConnection = typeof sourceConnections.$inferInsert;
export type RawImportRow = typeof rawImports.$inferSelect;
export type NewRawImport = typeof rawImports.$inferInsert;
export type AuditEventRow = typeof auditEvents.$inferSelect;
export type NewAuditEvent = typeof auditEvents.$inferInsert;
