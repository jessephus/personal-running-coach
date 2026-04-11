import {
  buildAthleteStateSummary,
  buildCoachDashboardState,
  buildGovernanceSummary,
  coachPersona,
  deterministicGuardrails,
  evaluateFatigueCheck,
  generateCoachingWorkflowWithLlm,
  type WorkflowResult,
} from "@coachinclaw/coach-core";
import {
  completedWorkouts,
  coachMessages,
  sourceConnections,
  auditEvents,
  createDatabaseConnection,
  loadAthleteRuntimeContext,
  type DatabaseConnection,
} from "@coachinclaw/db";
import {
  createModelProviderClient,
  integrationStatusCards,
  readEnvVar,
  requireEnvVar,
} from "@coachinclaw/integrations";
import { desc, eq } from "drizzle-orm";

import { getEnvironmentStatus } from "./server-config";

// ---- Shared helpers --------------------------------------------------------

function hasLiveConfig() {
  return Boolean(
    readEnvVar("DATABASE_URL") &&
      readEnvVar("APP_ENCRYPTION_KEY") &&
      readEnvVar("MODEL_PROVIDER_API_KEY"),
  );
}

function hasDatabaseConfig() {
  return Boolean(readEnvVar("DATABASE_URL"));
}

async function withConnection<T>(fn: (conn: DatabaseConnection) => Promise<T>): Promise<T> {
  const conn = createDatabaseConnection();
  try {
    return await fn(conn);
  } finally {
    await conn.close();
  }
}

// ---- Home ------------------------------------------------------------------

export async function getHomeData() {
  if (!hasDatabaseConfig()) return null;

  return withConnection(async (conn) => {
    const context = await loadAthleteRuntimeContext(conn.db);
    if (!context) return null;

    const dashboard = buildCoachDashboardState({
      profile: context.profile,
      goals: context.goals,
      memories: context.memories,
      recentWorkouts: context.recentWorkouts,
      deferredFeatures: [],
    });

    const connections = await conn.db
      .select({
        provider: sourceConnections.provider,
        status: sourceConnections.status,
      })
      .from(sourceConnections)
      .where(eq(sourceConnections.athleteId, context.athleteId));

    return { dashboard, connections };
  });
}

// ---- Coaching --------------------------------------------------------------

export async function getCoachingData() {
  if (!hasLiveConfig()) return null;

  return withConnection(async (conn) => {
    const context = await loadAthleteRuntimeContext(conn.db);
    if (!context) return null;

    const stateSummary = buildAthleteStateSummary({
      profile: context.profile,
      goals: context.goals,
      memories: context.memories,
      recentWorkouts: context.recentWorkouts,
    });

    const model = createModelProviderClient(requireEnvVar("MODEL_PROVIDER_API_KEY"), {
      baseUrl: readEnvVar("MODEL_PROVIDER_BASE_URL") ?? undefined,
      model: readEnvVar("MODEL_PROVIDER_MODEL") ?? undefined,
    });

    const promises: Array<Promise<WorkflowResult | null>> = [];

    if (context.recentWorkouts.length > 0) {
      promises.push(
        generateCoachingWorkflowWithLlm(
          { profile: context.profile, stateSummary, memories: context.memories, recentWorkouts: context.recentWorkouts, recentThread: context.recentThread, workflow: "post-workout-debrief" },
          model,
        ).then((g) => g.result),
      );
    }

    promises.push(
      generateCoachingWorkflowWithLlm(
        { profile: context.profile, stateSummary, memories: context.memories, recentWorkouts: context.recentWorkouts, recentThread: context.recentThread, workflow: "weekly-review" },
        model,
      ).then((g) => g.result),
    );

    const fatigueTrigger = evaluateFatigueCheck({
      recentWorkouts: context.recentWorkouts,
      stateSummary,
      profile: context.profile,
    });
    if (fatigueTrigger) {
      promises.push(
        generateCoachingWorkflowWithLlm(
          { profile: context.profile, stateSummary, memories: context.memories, recentWorkouts: context.recentWorkouts, recentThread: context.recentThread, workflow: "fatigue-check" },
          model,
        ).then((g) => g.result),
      );
    }

    promises.push(
      generateCoachingWorkflowWithLlm(
        { profile: context.profile, stateSummary, memories: context.memories, recentWorkouts: context.recentWorkouts, recentThread: context.recentThread, workflow: "next-workout-suggestion" },
        model,
      ).then((g) => g.result),
    );

    const workflows = (await Promise.all(promises)).filter(
      (w): w is WorkflowResult => w !== null,
    );

    return { workflows };
  });
}

// ---- Chat ------------------------------------------------------------------

export type ChatRow = {
  id: string;
  direction: string;
  channel: string;
  bodyPreview: string;
  sentAt: string;
};

export async function getChatData(): Promise<ChatRow[] | null> {
  if (!hasDatabaseConfig()) return null;

  return withConnection(async (conn) => {
    const rows = await conn.db
      .select({
        id: coachMessages.id,
        direction: coachMessages.direction,
        channel: coachMessages.channel,
        bodyPreview: coachMessages.bodyPreview,
        sentAt: coachMessages.sentAt,
      })
      .from(coachMessages)
      .orderBy(desc(coachMessages.sentAt))
      .limit(200);

    return rows.map((r) => ({
      ...r,
      sentAt: r.sentAt.toISOString(),
    }));
  });
}

// ---- Training --------------------------------------------------------------

export type TrainingRow = {
  id: string;
  date: string;
  type: string;
  distanceKm: number;
  durationMinutes: number;
  perceivedEffort: number;
  summary: string;
};

export async function getTrainingData(): Promise<TrainingRow[] | null> {
  if (!hasDatabaseConfig()) return null;

  return withConnection(async (conn) => {
    const rows = await conn.db
      .select({
        id: completedWorkouts.id,
        date: completedWorkouts.date,
        type: completedWorkouts.type,
        distanceKm: completedWorkouts.distanceKm,
        durationMinutes: completedWorkouts.durationMinutes,
        perceivedEffort: completedWorkouts.perceivedEffort,
        summary: completedWorkouts.summary,
      })
      .from(completedWorkouts)
      .orderBy(desc(completedWorkouts.date))
      .limit(500);

    return rows;
  });
}

// ---- Coach Config ----------------------------------------------------------

export async function getCoachConfigData() {
  const persona = coachPersona;

  if (!hasDatabaseConfig()) {
    return { persona, profile: null, goals: null };
  }

  return withConnection(async (conn) => {
    const context = await loadAthleteRuntimeContext(conn.db);
    if (!context) return { persona, profile: null, goals: null };

    return {
      persona,
      profile: context.profile,
      goals: context.goals,
    };
  });
}

// ---- Tech Config -----------------------------------------------------------

export function getTechConfigData() {
  return {
    environmentStatus: getEnvironmentStatus(),
    integrations: integrationStatusCards,
  };
}

// ---- Governance ------------------------------------------------------------

export type AuditRow = {
  id: string;
  actorType: string;
  action: string;
  resourceType: string;
  outcome: string;
  occurredAt: string;
};

export async function getGovernanceData() {
  const summary = buildGovernanceSummary();

  if (!hasDatabaseConfig()) {
    return { summary, recentAuditEvents: null };
  }

  return withConnection(async (conn) => {
    const rows = await conn.db
      .select({
        id: auditEvents.id,
        actorType: auditEvents.actorType,
        action: auditEvents.action,
        resourceType: auditEvents.resourceType,
        outcome: auditEvents.outcome,
        occurredAt: auditEvents.occurredAt,
      })
      .from(auditEvents)
      .orderBy(desc(auditEvents.occurredAt))
      .limit(50);

    return {
      summary,
      recentAuditEvents: rows.map((r) => ({
        ...r,
        occurredAt: r.occurredAt.toISOString(),
      })),
    };
  });
}

// ---- Status ----------------------------------------------------------------

export async function getStatusData() {
  const envStatus = getEnvironmentStatus();
  const integrations = integrationStatusCards;

  if (!hasDatabaseConfig()) {
    return { envStatus, integrations, connections: null };
  }

  return withConnection(async (conn) => {
    const connections = await conn.db
      .select({
        provider: sourceConnections.provider,
        status: sourceConnections.status,
        lastSyncedAt: sourceConnections.lastSyncedAt,
        connectedAt: sourceConnections.connectedAt,
      })
      .from(sourceConnections);

    return {
      envStatus,
      integrations,
      connections: connections.map((c) => ({
        ...c,
        lastSyncedAt: c.lastSyncedAt?.toISOString() ?? null,
        connectedAt: c.connectedAt?.toISOString() ?? null,
      })),
    };
  });
}

// ---- Guardrails (used by help page) ----------------------------------------

export function getGuardrailsData() {
  return deterministicGuardrails.map((g) => ({
    id: g.id,
    title: g.title,
    scope: g.scope,
    condition: g.condition,
    effect: g.effect,
  }));
}
