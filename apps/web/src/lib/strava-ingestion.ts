import { eq } from "drizzle-orm";

import {
  athleteProfiles,
  auditEvents,
  completedWorkouts,
  createDatabaseConnection,
  decryptString,
  encryptString,
  rawImports,
  sha256Hex,
  sourceConnections,
  type DatabaseClient,
  type SourceConnectionRow,
} from "@coachinclaw/db";
import {
  type StravaActivity,
  type StravaAthleteSummary,
  type StravaWebhookEvent,
  exchangeStravaAuthorizationCode,
  fetchStravaActivities,
  fetchStravaActivity,
  getStravaActivityDiscardReason,
  isImportableStravaActivity,
  isNearStravaRateLimit,
  isStravaTokenExpired,
  mapStravaActivityToCompletedWorkout,
  parseStravaScopes,
  readEnvVar,
  refreshStravaAccessToken,
  requireEnvVar,
  StravaApiError,
} from "@coachinclaw/integrations";

const STRAVA_PROVIDER = "strava" as const;
const DEFAULT_SYNC_LOOKBACK_DAYS = 30;
const DEFAULT_SYNC_PAGE_LIMIT = 2;
const DEFAULT_SYNC_PER_PAGE = 50;

type SyncOptions = {
  accessToken?: string;
  afterEpochSeconds?: number;
  pageLimit?: number;
  perPage?: number;
};

type IngestResult = {
  disposition: "imported" | "discarded";
  rawImportId: string;
  completedWorkoutId?: string;
  reason?: string;
};

type ConnectionSyncSummary = {
  connectionId: string;
  athleteId: string;
  externalAthleteId: string | null;
  pagesFetched: number;
  activitiesSeen: number;
  imported: number;
  discarded: number;
  refreshedToken: boolean;
  nearRateLimit: boolean;
};

export type StravaOAuthCallbackResult = {
  athleteId: string;
  athleteExternalKey: string;
  sourceConnectionId: string;
  imported: number;
  discarded: number;
  pagesFetched: number;
  refreshedToken: boolean;
};

export type StravaWebhookProcessingResult = {
  handled: boolean;
  disposition: "imported" | "discarded" | "ignored";
  athleteId?: string;
  reason?: string;
  rawImportId?: string;
};

export type ManualStravaSyncResult = {
  syncedConnections: number;
  imported: number;
  discarded: number;
  processedConnections: ConnectionSyncSummary[];
};

export function getStravaWebhookVerifyToken() {
  return readEnvVar("STRAVA_WEBHOOK_VERIFY_TOKEN");
}

export async function handleStravaOAuthCallback(input: {
  code: string;
  scope?: string | null;
}) {
  return withDatabase(async (db) => {
    const env = getStravaServerEnv();
    const tokenResponse = await exchangeStravaAuthorizationCode({
      clientId: env.clientId,
      clientSecret: env.clientSecret,
      code: input.code,
    });

    const athlete = await ensureAthleteProfile(db, tokenResponse.athlete);
    const connection = await upsertStravaConnection(db, {
      athleteId: athlete.id,
      externalAthleteId: String(tokenResponse.athlete.id),
      scopes: parseStravaScopes(input.scope ?? tokenResponse.scope),
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      tokenExpiresAt: new Date(tokenResponse.expires_at * 1000),
    });

    await recordAuditEvent(db, {
      athleteId: athlete.id,
      action: "strava.oauth.connected",
      outcome: "success",
      resourceId: connection.id,
      metadata: {
        externalAthleteId: tokenResponse.athlete.id,
        scopes: parseStravaScopes(input.scope ?? tokenResponse.scope),
      },
    });

    const syncSummary = await syncSingleConnection(db, connection, {
      accessToken: tokenResponse.access_token,
      afterEpochSeconds: getDefaultAfterEpochSeconds(DEFAULT_SYNC_LOOKBACK_DAYS),
    });

    return {
      athleteId: athlete.id,
      athleteExternalKey: athlete.externalKey,
      sourceConnectionId: connection.id,
      imported: syncSummary.imported,
      discarded: syncSummary.discarded,
      pagesFetched: syncSummary.pagesFetched,
      refreshedToken: syncSummary.refreshedToken,
    } satisfies StravaOAuthCallbackResult;
  });
}

export async function processStravaWebhookEvent(event: StravaWebhookEvent) {
  return withDatabase(async (db) => {
    const connection = await db.query.sourceConnections.findFirst({
      where: (table, { and, eq }) =>
        and(eq(table.provider, STRAVA_PROVIDER), eq(table.externalAthleteId, String(event.owner_id))),
    });

    if (!connection) {
      return {
        handled: false,
        disposition: "ignored",
        reason: `No Strava source connection found for owner ${event.owner_id}.`,
      } satisfies StravaWebhookProcessingResult;
    }

    if (event.object_type !== "activity") {
      await recordAuditEvent(db, {
        athleteId: connection.athleteId,
        action: "strava.webhook.ignored",
        outcome: "blocked",
        resourceId: connection.id,
        metadata: event,
      });

      return {
        handled: false,
        disposition: "ignored",
        athleteId: connection.athleteId,
        reason: `Unsupported Strava webhook object type: ${event.object_type}`,
      } satisfies StravaWebhookProcessingResult;
    }

    if (event.aspect_type === "delete") {
      const rawImport = await upsertRawImport(db, {
        athleteId: connection.athleteId,
        sourceConnectionId: connection.id,
        importType: "strava.webhook.activity.delete",
        sourceObjectId: String(event.object_id),
        payload: event,
      });

      await markRawImport(db, rawImport.id, {
        status: "discarded",
        failureReason: "Delete events are recorded but not yet applied to canonical workouts.",
      });

      return {
        handled: true,
        disposition: "discarded",
        athleteId: connection.athleteId,
        rawImportId: rawImport.id,
        reason: "Delete events are logged for replay but do not delete workouts yet.",
      } satisfies StravaWebhookProcessingResult;
    }

    const { accessToken } = await ensureActiveAccessToken(db, connection);
    const activityResponse = await fetchStravaActivity({
      accessToken,
      activityId: event.object_id,
    });
    const ingestResult = await ingestActivity(db, {
      athleteId: connection.athleteId,
      connectionId: connection.id,
      activity: activityResponse.data,
      importType: `strava.webhook.activity.${event.aspect_type}`,
      payload: {
        event,
        activity: activityResponse.data,
      },
    });

    await touchConnectionSyncTimestamp(db, connection.id);

    return {
      handled: true,
      disposition: ingestResult.disposition,
      athleteId: connection.athleteId,
      rawImportId: ingestResult.rawImportId,
      reason: ingestResult.reason,
    } satisfies StravaWebhookProcessingResult;
  });
}

export async function runManualStravaSync(input: { days?: number; pageLimit?: number } = {}) {
  return withDatabase(async (db) => {
    const connections = await db.query.sourceConnections.findMany({
      where: (table, { and, eq }) =>
        and(eq(table.provider, STRAVA_PROVIDER), eq(table.status, "connected")),
    });

    const processedConnections: ConnectionSyncSummary[] = [];
    let imported = 0;
    let discarded = 0;

    for (const connection of connections) {
      const summary = await syncSingleConnection(db, connection, {
        afterEpochSeconds:
          connection.lastSyncedAt instanceof Date
            ? Math.floor(connection.lastSyncedAt.getTime() / 1000)
            : getDefaultAfterEpochSeconds(input.days ?? DEFAULT_SYNC_LOOKBACK_DAYS),
        pageLimit: input.pageLimit,
      });

      processedConnections.push(summary);
      imported += summary.imported;
      discarded += summary.discarded;
    }

    return {
      syncedConnections: processedConnections.length,
      imported,
      discarded,
      processedConnections,
    } satisfies ManualStravaSyncResult;
  });
}

function getStravaServerEnv() {
  return {
    clientId: requireEnvVar("STRAVA_CLIENT_ID"),
    clientSecret: requireEnvVar("STRAVA_CLIENT_SECRET"),
    appEncryptionKey: requireEnvVar("APP_ENCRYPTION_KEY"),
  };
}

async function withDatabase<T>(operation: (db: DatabaseClient) => Promise<T>) {
  getStravaServerEnv();
  requireEnvVar("DATABASE_URL");

  const connection = createDatabaseConnection();
  try {
    return await operation(connection.db);
  } finally {
    await connection.close();
  }
}

async function ensureAthleteProfile(db: DatabaseClient, athlete: StravaAthleteSummary) {
  const externalKey = `strava:${athlete.id}`;
  const existing = await db.query.athleteProfiles.findFirst({
    where: (table, { eq }) => eq(table.externalKey, externalKey),
  });

  const displayName = buildAthleteDisplayName(athlete);
  if (existing) {
    if (existing.displayName !== displayName) {
      const [updated] = await db
        .update(athleteProfiles)
        .set({ displayName, updatedAt: new Date() })
        .where(eq(athleteProfiles.id, existing.id))
        .returning();
      return updated;
    }

    return existing;
  }

  const [created] = await db
    .insert(athleteProfiles)
    .values({
      externalKey,
      displayName,
      timezone: "Etc/UTC",
      preferredLongRunDay: "Sunday",
      coachingStyle: "direct",
      constraints: [],
      injuryFlagsPreview: [],
    })
    .returning();

  return created;
}

async function upsertStravaConnection(
  db: DatabaseClient,
  input: {
    athleteId: string;
    externalAthleteId: string;
    scopes: string[];
    accessToken: string;
    refreshToken: string;
    tokenExpiresAt: Date;
  },
) {
  const now = new Date();
  const [connection] = await db
    .insert(sourceConnections)
    .values({
      athleteId: input.athleteId,
      provider: STRAVA_PROVIDER,
      status: "connected",
      externalAthleteId: input.externalAthleteId,
      scopes: input.scopes,
      accessTokenCiphertext: encryptString(input.accessToken),
      refreshTokenCiphertext: encryptString(input.refreshToken),
      tokenExpiresAt: input.tokenExpiresAt,
      connectedAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [sourceConnections.athleteId, sourceConnections.provider],
      set: {
        status: "connected",
        externalAthleteId: input.externalAthleteId,
        scopes: input.scopes,
        accessTokenCiphertext: encryptString(input.accessToken),
        refreshTokenCiphertext: encryptString(input.refreshToken),
        tokenExpiresAt: input.tokenExpiresAt,
        connectedAt: now,
        updatedAt: now,
      },
    })
    .returning();

  return connection;
}

async function ensureActiveAccessToken(db: DatabaseClient, connection: SourceConnectionRow) {
  if (!connection.accessTokenCiphertext) {
    throw new Error(`Strava connection ${connection.id} is missing an access token.`);
  }

  if (!isStravaTokenExpired(connection.tokenExpiresAt)) {
    return {
      accessToken: decryptString(connection.accessTokenCiphertext),
      connection,
      refreshedToken: false,
    };
  }

  if (!connection.refreshTokenCiphertext) {
    throw new Error(`Strava connection ${connection.id} is missing a refresh token.`);
  }

  const env = getStravaServerEnv();
  const refreshed = await refreshStravaAccessToken({
    clientId: env.clientId,
    clientSecret: env.clientSecret,
    refreshToken: decryptString(connection.refreshTokenCiphertext),
  });
  const updatedConnection = await upsertStravaConnection(db, {
    athleteId: connection.athleteId,
    externalAthleteId: String(refreshed.athlete?.id ?? connection.externalAthleteId ?? ""),
    scopes: parseStravaScopes(refreshed.scope ?? connection.scopes.join(",")),
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token,
    tokenExpiresAt: new Date(refreshed.expires_at * 1000),
  });

  return {
    accessToken: refreshed.access_token,
    connection: updatedConnection,
    refreshedToken: true,
  };
}

async function syncSingleConnection(
  db: DatabaseClient,
  connection: SourceConnectionRow,
  options: SyncOptions,
) {
  const auth = options.accessToken
    ? { accessToken: options.accessToken, connection, refreshedToken: false }
    : await ensureActiveAccessToken(db, connection);
  const pageLimit = options.pageLimit ?? DEFAULT_SYNC_PAGE_LIMIT;
  const perPage = options.perPage ?? DEFAULT_SYNC_PER_PAGE;

  let pagesFetched = 0;
  let activitiesSeen = 0;
  let imported = 0;
  let discarded = 0;
  let nearRateLimit = false;

  for (let page = 1; page <= pageLimit; page += 1) {
    const response = await fetchStravaActivities({
      accessToken: auth.accessToken,
      after: options.afterEpochSeconds,
      page,
      perPage,
    });

    pagesFetched += 1;
    nearRateLimit = nearRateLimit || isNearStravaRateLimit(response.rateLimit);

    for (const activity of response.data) {
      activitiesSeen += 1;
      const result = await ingestActivity(db, {
        athleteId: auth.connection.athleteId,
        connectionId: auth.connection.id,
        activity,
        importType: "strava.sync.activity",
        payload: activity,
      });

      if (result.disposition === "imported") {
        imported += 1;
      } else {
        discarded += 1;
      }
    }

    if (response.data.length < perPage || nearRateLimit) {
      break;
    }
  }

  await touchConnectionSyncTimestamp(db, auth.connection.id);

  return {
    connectionId: auth.connection.id,
    athleteId: auth.connection.athleteId,
    externalAthleteId: auth.connection.externalAthleteId,
    pagesFetched,
    activitiesSeen,
    imported,
    discarded,
    refreshedToken: auth.refreshedToken,
    nearRateLimit,
  } satisfies ConnectionSyncSummary;
}

async function ingestActivity(
  db: DatabaseClient,
  input: {
    athleteId: string;
    connectionId: string;
    activity: StravaActivity;
    importType: string;
    payload: unknown;
  },
): Promise<IngestResult> {
  const rawImport = await upsertRawImport(db, {
    athleteId: input.athleteId,
    sourceConnectionId: input.connectionId,
    importType: input.importType,
    sourceObjectId: String(input.activity.id),
    payload: input.payload,
  });

  if (!isImportableStravaActivity(input.activity)) {
    const reason = getStravaActivityDiscardReason(input.activity);
    await markRawImport(db, rawImport.id, {
      status: "discarded",
      failureReason: reason,
    });

    return {
      disposition: "discarded",
      rawImportId: rawImport.id,
      reason,
    };
  }

  const workout = mapStravaActivityToCompletedWorkout(input.activity);
  if (!workout) {
    const reason = "Activity could not be normalized into a completed workout.";
    await markRawImport(db, rawImport.id, {
      status: "failed",
      failureReason: reason,
    });

    return {
      disposition: "discarded",
      rawImportId: rawImport.id,
      reason,
    };
  }

  const now = new Date();
  const [completedWorkout] = await db
    .insert(completedWorkouts)
    .values({
      athleteId: input.athleteId,
      rawImportId: rawImport.id,
      source: STRAVA_PROVIDER,
      sourceWorkoutId: workout.sourceWorkoutId,
      date: workout.date,
      type: workout.type,
      distanceKm: workout.distanceKm,
      durationMinutes: workout.durationMinutes,
      perceivedEffort: workout.perceivedEffort,
      summary: workout.summary,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [completedWorkouts.athleteId, completedWorkouts.source, completedWorkouts.sourceWorkoutId],
      set: {
        rawImportId: rawImport.id,
        date: workout.date,
        type: workout.type,
        distanceKm: workout.distanceKm,
        durationMinutes: workout.durationMinutes,
        perceivedEffort: workout.perceivedEffort,
        summary: workout.summary,
        updatedAt: now,
      },
    })
    .returning();

  await markRawImport(db, rawImport.id, {
    status: "processed",
  });

  return {
    disposition: "imported",
    rawImportId: rawImport.id,
    completedWorkoutId: completedWorkout.id,
  };
}

async function upsertRawImport(
  db: DatabaseClient,
  input: {
    athleteId: string;
    sourceConnectionId: string;
    importType: string;
    sourceObjectId: string;
    payload: unknown;
  },
) {
  const now = new Date();
  const serializedPayload = JSON.stringify(input.payload);
  const [rawImport] = await db
    .insert(rawImports)
    .values({
      athleteId: input.athleteId,
      sourceConnectionId: input.sourceConnectionId,
      provider: STRAVA_PROVIDER,
      importType: input.importType,
      sourceObjectId: input.sourceObjectId,
      status: "pending",
      rawPayloadCiphertext: encryptString(serializedPayload),
      rawPayloadSha256: sha256Hex(serializedPayload),
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [rawImports.athleteId, rawImports.provider, rawImports.sourceObjectId],
      set: {
        sourceConnectionId: input.sourceConnectionId,
        importType: input.importType,
        status: "pending",
        rawPayloadCiphertext: encryptString(serializedPayload),
        rawPayloadSha256: sha256Hex(serializedPayload),
        failureReason: null,
        processedAt: null,
        updatedAt: now,
      },
    })
    .returning();

  return rawImport;
}

async function markRawImport(
  db: DatabaseClient,
  rawImportId: string,
  input: { status: "processed" | "failed" | "discarded"; failureReason?: string },
) {
  const processedAt = input.status === "processed" ? new Date() : input.status === "discarded" ? new Date() : null;

  await db
    .update(rawImports)
    .set({
      status: input.status,
      failureReason: input.failureReason ?? null,
      processedAt,
      updatedAt: new Date(),
    })
    .where(eq(rawImports.id, rawImportId));
}

async function touchConnectionSyncTimestamp(db: DatabaseClient, connectionId: string) {
  await db
    .update(sourceConnections)
    .set({ lastSyncedAt: new Date(), updatedAt: new Date() })
    .where(eq(sourceConnections.id, connectionId));
}

async function recordAuditEvent(
  db: DatabaseClient,
  input: {
    athleteId: string | null;
    action: string;
    outcome: "success" | "failure" | "blocked";
    resourceId: string | null;
    metadata: Record<string, unknown>;
  },
) {
  await db.insert(auditEvents).values({
    athleteId: input.athleteId,
    actorType: "integration",
    actorId: STRAVA_PROVIDER,
    action: input.action,
    resourceType: "source_connection",
    resourceId: input.resourceId,
    outcome: input.outcome,
    metadata: input.metadata,
  });
}

function buildAthleteDisplayName(athlete: StravaAthleteSummary) {
  const fullName = [athlete.firstname, athlete.lastname].filter(Boolean).join(" ").trim();
  return fullName || athlete.username || `Strava athlete ${athlete.id}`;
}

function getDefaultAfterEpochSeconds(days: number) {
  return Math.floor(Date.now() / 1000) - days * 24 * 60 * 60;
}

export { StravaApiError };
