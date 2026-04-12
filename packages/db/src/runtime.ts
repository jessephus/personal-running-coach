import { eq } from "drizzle-orm";

import {
  buildAthleteStateSummary,
  buildThreadFromRawMessages,
  extractCoachMemoriesWithLlm,
  generateCoachingWorkflowWithLlm,
  type AthleteGoal,
  type AthleteProfile,
  type CoachMemory,
  type CompletedWorkout,
  type ConversationThread,
  type MemoryCandidateDraft,
  type GenerateCoachingWorkflowInput,
  type WorkflowResult,
  type GenerateCoachingWorkflowOutput,
  type ExtractCoachMemoriesOutput,
  PromptPrivacyError,
} from "@coachinclaw/coach-core";
import {
  buildMessagePreview,
  createModelProviderClient,
  requireEnvVar,
  type ModelProviderClient,
} from "@coachinclaw/integrations";

import { createDatabaseConnection, type DatabaseClient } from "./client";
import { getResolvedModelProviderIntegrationConfig } from "./integration-config";
import {
  athleteProfiles,
  auditEvents,
  coachMemories,
  coachMessages,
  completedWorkouts,
  type MessageChannel,
  type MessageDirection,
  type NewAuditEvent,
  type NewCoachMemory,
  type NewCoachMessage,
} from "./schema";
import { decryptString, encryptString } from "./crypto";

export type AthleteRuntimeContext = {
  athleteId: string;
  profile: AthleteProfile;
  goals: AthleteGoal[];
  recentWorkouts: CompletedWorkout[];
  memories: CoachMemory[];
  recentThread: ConversationThread | null;
};

export type GenerateAthleteWorkflowResult = GenerateCoachingWorkflowOutput & {
  athleteId: string;
};

export type ExtractMemoriesFromMessageResult = ExtractCoachMemoriesOutput & {
  athleteId: string;
  storedMessageId: string;
  storedMemories: CoachMemory[];
};

export type PersistOutboundMessageInput = {
  athleteId?: string;
  channel?: Extract<MessageChannel, "telegram" | "dashboard" | "system">;
  externalMessageId?: string | null;
  body: string;
  metadata?: Record<string, unknown>;
};

const DEFAULT_WORKOUT_LIMIT = 10;
const DEFAULT_MEMORY_LIMIT = 8;
const DEFAULT_MESSAGE_LIMIT = 12;

export async function generateCoachingWorkflowForAthlete(input: {
  athleteId?: string;
  workflow?: GenerateCoachingWorkflowInput["workflow"];
} = {}): Promise<GenerateAthleteWorkflowResult> {
  return withRuntime(async ({ db, model }) => {
    const context = await loadAthleteRuntimeContext(db, input.athleteId);
    if (!context) {
      throw new Error("No athlete profile is available for coaching.");
    }

    const stateSummary = buildAthleteStateSummary({
      profile: context.profile,
      goals: context.goals,
      memories: context.memories,
      recentWorkouts: context.recentWorkouts,
    });

    try {
      const generated = await generateCoachingWorkflowWithLlm(
        {
          profile: context.profile,
          stateSummary,
          memories: context.memories,
          recentWorkouts: context.recentWorkouts,
          recentThread: context.recentThread,
          workflow: input.workflow,
        },
        model,
      );

      await recordAuditEvent(db, {
        athleteId: context.athleteId,
        actorType: "system",
        actorId: "model-provider",
        action: "prompt.assembled",
        resourceType: "workflow",
        resourceId: generated.result.workflow,
        outcome: "success",
        metadata: {
          requestedWorkflow: input.workflow ?? "auto",
          promptLengthChars: generated.promptReview.promptLengthChars,
          promptViolations: generated.promptReview.violations.length,
        },
      });

      return {
        athleteId: context.athleteId,
        ...generated,
      };
    } catch (error) {
      await maybeRecordPromptBlockAudit(db, context.athleteId, input.workflow ?? "auto", error);
      throw error;
    }
  });
}

export async function extractMemoriesFromInboundMessage(input: {
  athleteId?: string;
  externalMessageId: string;
  body: string;
  channel?: Extract<MessageChannel, "telegram" | "dashboard">;
  metadata?: Record<string, unknown>;
}): Promise<ExtractMemoriesFromMessageResult> {
  return withRuntime(async ({ db, model }) => {
    const initialContext = await loadAthleteRuntimeContext(db, input.athleteId);
    if (!initialContext) {
      throw new Error("No athlete profile is available for inbound message processing.");
    }

    const storedMessage = await upsertCoachMessage(db, {
      athleteId: initialContext.athleteId,
      channel: input.channel ?? "telegram",
      direction: "inbound",
      externalMessageId: input.externalMessageId,
      body: input.body,
      metadata: input.metadata ?? {},
    });

    const context = await loadAthleteRuntimeContext(db, initialContext.athleteId);
    if (!context?.recentThread) {
      return {
        athleteId: initialContext.athleteId,
        memories: [],
        promptReview: {
          passed: true,
          violations: [],
          reviewedAt: new Date().toISOString(),
          promptLengthChars: 0,
        },
        storedMessageId: storedMessage.id,
        storedMemories: [],
      };
    }

    const stateSummary = buildAthleteStateSummary({
      profile: context.profile,
      goals: context.goals,
      memories: context.memories,
      recentWorkouts: context.recentWorkouts,
    });

    try {
      const extracted = await extractCoachMemoriesWithLlm(
        {
          profile: context.profile,
          stateSummary,
          existingMemories: context.memories,
          recentWorkouts: context.recentWorkouts,
          recentThread: context.recentThread,
        },
        model,
      );
      const storedMemories = await upsertCoachMemoryDrafts(
        db,
        context.athleteId,
        extracted.memories,
      );

      await recordAuditEvent(db, {
        athleteId: context.athleteId,
        actorType: "integration",
        actorId: input.channel ?? "telegram",
        action: "telegram.webhook.received",
        resourceType: "coach_message",
        resourceId: storedMessage.id,
        outcome: "success",
        metadata: {
          storedMemoryCount: storedMemories.length,
          promptLengthChars: extracted.promptReview.promptLengthChars,
        },
      });

      await recordAuditEvent(db, {
        athleteId: context.athleteId,
        actorType: "system",
        actorId: "model-provider",
        action: "prompt.assembled",
        resourceType: "coach_message",
        resourceId: storedMessage.id,
        outcome: "success",
        metadata: {
          promptLengthChars: extracted.promptReview.promptLengthChars,
          promptViolations: extracted.promptReview.violations.length,
        },
      });

      return {
        athleteId: context.athleteId,
        storedMessageId: storedMessage.id,
        storedMemories,
        ...extracted,
      };
    } catch (error) {
      await maybeRecordPromptBlockAudit(db, context.athleteId, storedMessage.id, error);
      throw error;
    }
  });
}

export async function persistOutboundCoachMessage(
  input: PersistOutboundMessageInput,
): Promise<{ athleteId: string; messageId: string }> {
  return withDatabase(async (db) => {
    const context = await loadAthleteRuntimeContext(db, input.athleteId);
    if (!context) {
      throw new Error("No athlete profile is available for outbound message persistence.");
    }

    const message = await upsertCoachMessage(db, {
      athleteId: context.athleteId,
      channel: input.channel ?? "telegram",
      direction: "outbound",
      externalMessageId: input.externalMessageId ?? null,
      body: input.body,
      metadata: input.metadata ?? {},
    });

    await recordAuditEvent(db, {
      athleteId: context.athleteId,
      actorType: "system",
      actorId: input.channel ?? "telegram",
      action: input.channel === "telegram" || !input.channel ? "telegram.message.sent" : "coach.message.sent",
      resourceType: "coach_message",
      resourceId: message.id,
      outcome: "success",
      metadata: input.metadata ?? {},
    });

    return { athleteId: context.athleteId, messageId: message.id };
  });
}

export async function loadAthleteRuntimeContext(
  db: DatabaseClient,
  athleteId?: string,
): Promise<AthleteRuntimeContext | null> {
  const athlete = athleteId
    ? await db.query.athleteProfiles.findFirst({
        where: (table, { eq }) => eq(table.id, athleteId),
      })
    : await db.query.athleteProfiles.findFirst({
        orderBy: (table, { desc }) => desc(table.updatedAt),
      });

  if (!athlete) {
    return null;
  }

  const [athleteGoals, workouts, memories, messages] = await Promise.all([
    db.query.goals.findMany({
      where: (table, { eq }) => eq(table.athleteId, athlete.id),
      orderBy: (table, { desc }) => desc(table.targetDate),
    }),
    db.query.completedWorkouts.findMany({
      where: (table, { eq }) => eq(table.athleteId, athlete.id),
      orderBy: (table, { desc }) => desc(table.date),
      limit: DEFAULT_WORKOUT_LIMIT,
    }),
    db.query.coachMemories.findMany({
      where: (table, { eq }) => eq(table.athleteId, athlete.id),
      orderBy: (table, { desc }) => desc(table.updatedAt),
      limit: DEFAULT_MEMORY_LIMIT,
    }),
    db.query.coachMessages.findMany({
      where: (table, { eq }) => eq(table.athleteId, athlete.id),
      orderBy: (table, { desc }) => desc(table.sentAt),
      limit: DEFAULT_MESSAGE_LIMIT,
    }),
  ]);

  return {
    athleteId: athlete.id,
    profile: {
      id: athlete.id,
      displayName: athlete.displayName,
      timezone: athlete.timezone,
      preferredLongRunDay: athlete.preferredLongRunDay,
      coachingStyle: athlete.coachingStyle,
      constraints: athlete.constraints,
      injuryFlags: readInjuryFlags(athlete.injuryFlagsPreview, athlete.injuryFlagsCiphertext),
    },
    goals: athleteGoals.map((goal) => ({
      id: goal.id,
      name: goal.name,
      targetDate: goal.targetDate,
      priority: goal.priority,
      notes: goal.notes,
    })),
    recentWorkouts: workouts.map((workout) => ({
      id: workout.id,
      date: workout.date,
      type: workout.type,
      distanceKm: workout.distanceKm,
      durationMinutes: workout.durationMinutes,
      perceivedEffort: workout.perceivedEffort,
      summary: workout.summary,
      source: "strava",
    })),
    memories: memories.map((memory) => ({
      id: memory.id,
      category: memory.category,
      title: memory.title,
      detail: memory.detailSummary,
    })),
    recentThread:
      messages.length > 0
        ? buildThreadFromRawMessages(
            athlete.id,
            messages.map((message) => ({
              id: message.id,
              direction: message.direction,
              channel: message.channel,
              bodyPreview: message.bodyPreview,
              sentAt: message.sentAt,
            })),
          )
        : null,
  };
}

async function withRuntime<T>(
  operation: (input: { db: DatabaseClient; model: ModelProviderClient }) => Promise<T>,
): Promise<T> {
  return withDatabase(async (db) => {
    const resolved = await getResolvedModelProviderIntegrationConfig(db);
    if (!resolved.config) {
      throw new Error("Model provider is not configured. Add it from the Tech Config page.");
    }

    const model = createModelProviderClient(resolved.config.apiKey, {
      baseUrl: resolved.config.baseUrl ?? undefined,
      model: resolved.config.model ?? undefined,
    });

    return operation({ db, model });
  });
}

async function withDatabase<T>(operation: (db: DatabaseClient) => Promise<T>): Promise<T> {
  requireEnvVar("DATABASE_URL");
  requireEnvVar("APP_ENCRYPTION_KEY");

  const connection = createDatabaseConnection();
  try {
    return await operation(connection.db);
  } finally {
    await connection.close();
  }
}

async function upsertCoachMessage(
  db: DatabaseClient,
  input: {
    athleteId: string;
    channel: Extract<MessageChannel, "telegram" | "dashboard" | "system">;
    direction: MessageDirection;
    externalMessageId: string | null;
    body: string;
    metadata: Record<string, unknown>;
  },
) {
  const now = new Date();
  const messageValues: NewCoachMessage = {
    athleteId: input.athleteId,
    channel: input.channel,
    direction: input.direction,
    externalMessageId: input.externalMessageId,
    bodyCiphertext: encryptString(input.body),
    bodyPreview: buildMessagePreview(input.body),
    messageMetadata: input.metadata,
    sentAt: now,
  };

  if (!input.externalMessageId) {
    const [inserted] = await db.insert(coachMessages).values(messageValues).returning();
    return inserted;
  }

  const [upserted] = await db
    .insert(coachMessages)
    .values(messageValues)
    .onConflictDoUpdate({
      target: [
        coachMessages.athleteId,
        coachMessages.channel,
        coachMessages.externalMessageId,
      ],
      set: {
        bodyCiphertext: messageValues.bodyCiphertext,
        bodyPreview: messageValues.bodyPreview,
        messageMetadata: messageValues.messageMetadata,
        sentAt: now,
      },
    })
    .returning();

  return upserted;
}

async function upsertCoachMemoryDrafts(
  db: DatabaseClient,
  athleteId: string,
  drafts: MemoryCandidateDraft[],
): Promise<CoachMemory[]> {
  const stored: CoachMemory[] = [];

  for (const draft of drafts) {
    const values: NewCoachMemory = {
      athleteId,
      category: draft.category,
      title: draft.title,
      detailCiphertext: encryptString(draft.detail),
      detailSummary: draft.detailSummary,
    };

    const existing = await db.query.coachMemories.findFirst({
      where: (table, helpers) =>
        helpers.and(
          helpers.eq(table.athleteId, athleteId),
          helpers.eq(table.category, draft.category),
          helpers.eq(table.title, draft.title),
        ),
    });

    if (existing) {
      const [updated] = await db
        .update(coachMemories)
        .set({
          detailCiphertext: values.detailCiphertext,
          detailSummary: values.detailSummary,
          updatedAt: new Date(),
        })
        .where(eq(coachMemories.id, existing.id))
        .returning();

      stored.push({
        id: updated.id,
        category: updated.category,
        title: updated.title,
        detail: updated.detailSummary,
      });
      continue;
    }

    const [created] = await db.insert(coachMemories).values(values).returning();
    stored.push({
      id: created.id,
      category: created.category,
      title: created.title,
      detail: created.detailSummary,
    });
  }

  return stored;
}

function readInjuryFlags(preview: string[], ciphertext: string | null): string[] {
  if (preview.length > 0) {
    return preview;
  }

  if (!ciphertext) {
    return [];
  }

  const decrypted = decryptString(ciphertext);
  const parsed = JSON.parse(decrypted) as unknown;
  return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
}

async function maybeRecordPromptBlockAudit(
  db: DatabaseClient,
  athleteId: string,
  resourceId: string,
  error: unknown,
) {
  if (!(error instanceof PromptPrivacyError)) {
    return;
  }

  await recordAuditEvent(db, {
    athleteId,
    actorType: "system",
    actorId: "model-provider",
    action: "prompt.assembled",
    resourceType: "prompt",
    resourceId,
    outcome: "blocked",
    metadata: {
      promptLengthChars: error.review.promptLengthChars,
      violations: error.review.violations,
    },
  });
}

async function recordAuditEvent(
  db: DatabaseClient,
  input: Omit<NewAuditEvent, "occurredAt">,
) {
  await db.insert(auditEvents).values(input);
}
