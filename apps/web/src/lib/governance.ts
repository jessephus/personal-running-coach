// ---------------------------------------------------------------------------
// Governance operations — export, delete, and prune for the single-user MVP
//
// These functions implement the data-lifecycle controls defined in the
// coach-core governance module. They operate against the live database and
// use the existing crypto module for encrypted exports.
// ---------------------------------------------------------------------------

import { eq, sql } from "drizzle-orm";

import {
  athleteProfiles,
  auditEvents,
  coachMemories,
  coachMessages,
  completedWorkouts,
  createDatabaseConnection,
  decryptString,
  encryptString,
  goals,
  rawImports,
  sha256Hex,
  sourceConnections,
  type DatabaseClient,
} from "@personal-running-coach/db";
import {
  buildDeletionPlan,
  buildExportManifest,
  getRetentionCutoffDate,
  prunableTables,
  retentionPolicies,
  type DeletionScope,
  type ExportSection,
} from "@personal-running-coach/coach-core";

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export type AthleteExportData = {
  manifest: ReturnType<typeof buildExportManifest>;
  profile: Record<string, unknown> | null;
  goals: Record<string, unknown>[];
  completedWorkouts: Record<string, unknown>[];
  coachMemories: Record<string, unknown>[];
  coachMessages: Record<string, unknown>[];
  sourceConnections: Record<string, unknown>[];
  auditEvents: Record<string, unknown>[];
};

/**
 * Export all athlete data as a structured JSON object.
 *
 * Ciphertext fields are decrypted so the export is self-contained.
 * The caller can optionally re-encrypt the entire export payload
 * using encryptExportPayload().
 */
export async function exportAthleteData(athleteId: string): Promise<AthleteExportData> {
  return withDatabase(async (db) => {
    const profile = await db.query.athleteProfiles.findFirst({
      where: (table, { eq }) => eq(table.id, athleteId),
    });

    if (!profile) {
      throw new Error(`Athlete ${athleteId} not found.`);
    }

    const [
      athleteGoals,
      workouts,
      memories,
      messages,
      connections,
      audits,
    ] = await Promise.all([
      db.query.goals.findMany({
        where: (table, { eq }) => eq(table.athleteId, athleteId),
      }),
      db.query.completedWorkouts.findMany({
        where: (table, { eq }) => eq(table.athleteId, athleteId),
      }),
      db.query.coachMemories.findMany({
        where: (table, { eq }) => eq(table.athleteId, athleteId),
      }),
      db.query.coachMessages.findMany({
        where: (table, { eq }) => eq(table.athleteId, athleteId),
      }),
      db.query.sourceConnections.findMany({
        where: (table, { eq }) => eq(table.athleteId, athleteId),
      }),
      db.query.auditEvents.findMany({
        where: (table, { eq }) => eq(table.athleteId, athleteId),
      }),
    ]);

    // Decrypt sensitive fields for the export
    const decryptedProfile = {
      ...profile,
      injuryFlagsCiphertext: profile.injuryFlagsCiphertext
        ? safeDecrypt(profile.injuryFlagsCiphertext)
        : null,
    };

    const decryptedMemories = memories.map((m) => ({
      ...m,
      detailCiphertext: safeDecrypt(m.detailCiphertext),
    }));

    const decryptedMessages = messages.map((m) => ({
      ...m,
      bodyCiphertext: safeDecrypt(m.bodyCiphertext),
    }));

    // Connections: export metadata only — tokens are NOT included in exports
    const sanitizedConnections = connections.map((c) => ({
      id: c.id,
      provider: c.provider,
      status: c.status,
      externalAthleteId: c.externalAthleteId,
      scopes: c.scopes,
      connectedAt: c.connectedAt,
      lastSyncedAt: c.lastSyncedAt,
      createdAt: c.createdAt,
      // Tokens intentionally omitted from export
    }));

    const sections: ExportSection[] = [
      { key: "profile", label: "Athlete Profile", recordCount: 1, dataClassId: "class-health-adjacent", containsSensitiveData: true },
      { key: "goals", label: "Goals", recordCount: athleteGoals.length, dataClassId: "class-coaching-context", containsSensitiveData: true },
      { key: "completedWorkouts", label: "Completed Workouts", recordCount: workouts.length, dataClassId: "class-training", containsSensitiveData: true },
      { key: "coachMemories", label: "Coach Memories", recordCount: decryptedMemories.length, dataClassId: "class-coaching-context", containsSensitiveData: true },
      { key: "coachMessages", label: "Coach Messages", recordCount: decryptedMessages.length, dataClassId: "class-messages", containsSensitiveData: true },
      { key: "sourceConnections", label: "Source Connections", recordCount: sanitizedConnections.length, dataClassId: "class-credentials", containsSensitiveData: false },
      { key: "auditEvents", label: "Audit Events", recordCount: audits.length, dataClassId: "class-audit", containsSensitiveData: false },
    ];

    await recordGovernanceAudit(db, {
      athleteId,
      action: "governance.export.completed",
      outcome: "success",
      metadata: {
        sections: sections.map((s) => ({ key: s.key, count: s.recordCount })),
      },
    });

    return {
      manifest: buildExportManifest({ athleteId, sections, encrypted: false }),
      profile: decryptedProfile as unknown as Record<string, unknown>,
      goals: athleteGoals as unknown as Record<string, unknown>[],
      completedWorkouts: workouts as unknown as Record<string, unknown>[],
      coachMemories: decryptedMemories as unknown as Record<string, unknown>[],
      coachMessages: decryptedMessages as unknown as Record<string, unknown>[],
      sourceConnections: sanitizedConnections as unknown as Record<string, unknown>[],
      auditEvents: audits as unknown as Record<string, unknown>[],
    };
  });
}

/**
 * Encrypt an entire export payload for secure storage or transfer.
 * Returns the ciphertext and a SHA-256 integrity hash.
 */
export function encryptExportPayload(data: AthleteExportData): {
  ciphertext: string;
  sha256: string;
} {
  const serialized = JSON.stringify(data);
  return {
    ciphertext: encryptString(serialized),
    sha256: sha256Hex(serialized),
  };
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

export type DeletionResult = {
  scope: DeletionScope;
  athleteId: string;
  deletedTables: string[];
  success: boolean;
};

/**
 * Delete athlete data according to the specified scope.
 *
 * Uses the DeletionPlan from coach-core governance to determine which
 * tables to clear. An audit event is recorded before and after deletion
 * (audit events themselves are preserved unless scope is "full").
 */
export async function deleteAthleteData(
  athleteId: string,
  scope: DeletionScope,
): Promise<DeletionResult> {
  const plan = buildDeletionPlan(athleteId, scope);

  return withDatabase(async (db) => {
    // Record the intent before deletion
    await recordGovernanceAudit(db, {
      athleteId,
      action: "governance.delete.requested",
      outcome: "success",
      metadata: { scope, tables: plan.tables.map((t) => t.tableName) },
    });

    const deletedTables: string[] = [];

    for (const target of plan.tables) {
      await deleteFromTable(db, target.tableName, athleteId, target.cascadeFromAthlete);
      deletedTables.push(target.tableName);
    }

    // Record completion (if athlete_profiles wasn't deleted, we can still audit)
    if (scope !== "full") {
      await recordGovernanceAudit(db, {
        athleteId,
        action: "governance.delete.completed",
        outcome: "success",
        metadata: { scope, deletedTables },
      });
    }

    return { scope, athleteId, deletedTables, success: true };
  });
}

async function deleteFromTable(
  db: DatabaseClient,
  tableName: string,
  athleteId: string,
  cascadeFromAthlete: boolean,
) {
  const tableMap: Record<string, typeof coachMessages | typeof coachMemories | typeof completedWorkouts | typeof rawImports | typeof goals | typeof sourceConnections | typeof athleteProfiles> = {
    coach_messages: coachMessages,
    coach_memories: coachMemories,
    completed_workouts: completedWorkouts,
    raw_imports: rawImports,
    goals: goals,
    source_connections: sourceConnections,
    athlete_profiles: athleteProfiles,
  };

  const table = tableMap[tableName];
  if (!table) return;

  if (tableName === "athlete_profiles") {
    await db.delete(table).where(eq(athleteProfiles.id, athleteId));
  } else if (cascadeFromAthlete && "athleteId" in table) {
    await db.delete(table).where(
      eq((table as typeof coachMessages).athleteId, athleteId),
    );
  }
}

// ---------------------------------------------------------------------------
// Prune
// ---------------------------------------------------------------------------

export type PruneResult = {
  executedAt: string;
  tablesProcessed: PruneTableResult[];
  totalPruned: number;
};

export type PruneTableResult = {
  tableName: string;
  cutoffDate: string;
  strategy: string;
  rowsPruned: number;
};

/**
 * Execute retention-based pruning across all prunable tables.
 *
 * For each table in the pruning plan, deletes rows older than the
 * retention cutoff. Respects the pruneStrategy:
 * - hard-delete: removes rows permanently
 * - soft-delete / archive: still deletes in MVP (a future version could
 *   move rows to an archive table instead)
 */
export async function pruneExpiredData(
  athleteId: string,
  asOf: Date = new Date(),
): Promise<PruneResult> {
  return withDatabase(async (db) => {
    const results: PruneTableResult[] = [];
    let totalPruned = 0;

    for (const entry of prunableTables) {
      const policy = retentionPolicies.find((p) => p.dataClassId === entry.dataClassId);
      if (!policy) continue;

      const cutoff = getRetentionCutoffDate(policy, asOf);

      const rowsPruned = await pruneTable(db, entry.tableName, athleteId, entry.timestampColumn, cutoff);
      totalPruned += rowsPruned;

      results.push({
        tableName: entry.tableName,
        cutoffDate: cutoff.toISOString(),
        strategy: entry.pruneStrategy,
        rowsPruned,
      });
    }

    await recordGovernanceAudit(db, {
      athleteId,
      action: "governance.prune.executed",
      outcome: "success",
      metadata: {
        asOf: asOf.toISOString(),
        totalPruned,
        tables: results.map((r) => ({ table: r.tableName, pruned: r.rowsPruned })),
      },
    });

    return {
      executedAt: asOf.toISOString(),
      tablesProcessed: results,
      totalPruned,
    };
  });
}

async function pruneTable(
  db: DatabaseClient,
  tableName: string,
  athleteId: string,
  timestampColumn: string,
  cutoff: Date,
): Promise<number> {
  // Use raw SQL for the timestamp comparison since the column name is dynamic.
  // The athlete_id filter scopes this to the single-user MVP.
  const result = await db.execute(
    sql`DELETE FROM ${sql.identifier(tableName)}
        WHERE athlete_id = ${athleteId}
          AND ${sql.identifier(timestampColumn)} < ${cutoff}`,
  );

  return Number(result.count ?? 0);
}

// ---------------------------------------------------------------------------
// Audit helpers
// ---------------------------------------------------------------------------

export type AuditSummary = {
  athleteId: string;
  totalEvents: number;
  eventsByAction: Record<string, number>;
  recentEvents: {
    action: string;
    outcome: string;
    occurredAt: string;
    metadata: Record<string, unknown>;
  }[];
};

/**
 * Build an audit summary for the given athlete.
 * Returns aggregate counts and the most recent events.
 */
export async function buildAuditSummary(
  athleteId: string,
  recentLimit: number = 25,
): Promise<AuditSummary> {
  return withDatabase(async (db) => {
    const allEvents = await db.query.auditEvents.findMany({
      where: (table, { eq }) => eq(table.athleteId, athleteId),
      orderBy: (table, { desc }) => desc(table.occurredAt),
    });

    const eventsByAction: Record<string, number> = {};
    for (const event of allEvents) {
      eventsByAction[event.action] = (eventsByAction[event.action] ?? 0) + 1;
    }

    const recentEvents = allEvents.slice(0, recentLimit).map((e) => ({
      action: e.action,
      outcome: e.outcome,
      occurredAt: e.occurredAt.toISOString(),
      metadata: e.metadata,
    }));

    return {
      athleteId,
      totalEvents: allEvents.length,
      eventsByAction,
      recentEvents,
    };
  });
}

async function recordGovernanceAudit(
  db: DatabaseClient,
  input: {
    athleteId: string;
    action: string;
    outcome: "success" | "failure" | "blocked";
    metadata: Record<string, unknown>;
  },
) {
  await db.insert(auditEvents).values({
    athleteId: input.athleteId,
    actorType: "system",
    actorId: "governance",
    action: input.action,
    resourceType: "athlete_data",
    resourceId: input.athleteId,
    outcome: input.outcome,
    metadata: input.metadata,
  });
}

function safeDecrypt(ciphertext: string): string {
  try {
    return decryptString(ciphertext);
  } catch {
    return "[decryption-unavailable]";
  }
}

async function withDatabase<T>(operation: (db: DatabaseClient) => Promise<T>): Promise<T> {
  const connection = createDatabaseConnection();
  try {
    return await operation(connection.db);
  } finally {
    await connection.close();
  }
}
