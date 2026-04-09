import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const STRAVA_DEFAULT_SCOPES = ["read", "activity:read"] as const;
export const STRAVA_IMPORTABLE_SPORT_TYPES = ["Run", "TrailRun", "VirtualRun", "Walk"] as const;

export type StravaAuthorizationInput = {
  clientId: string;
  redirectUri: string;
  state: string;
  scope?: string[];
  approvalPrompt?: "auto" | "force";
};

export type StravaAthleteSummary = {
  id: number;
  username?: string | null;
  firstname?: string | null;
  lastname?: string | null;
};

export type StravaTokenExchangeResponse = {
  token_type: string;
  access_token: string;
  refresh_token: string;
  expires_at: number;
  expires_in: number;
  athlete: StravaAthleteSummary;
  scope?: string;
};

export type StravaActivity = {
  id: number;
  name: string;
  sport_type: string;
  type: string;
  start_date: string;
  start_date_local?: string;
  timezone?: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  description?: string | null;
  trainer?: boolean;
  commute?: boolean;
  workout_type?: number | null;
  average_heartrate?: number | null;
  suffer_score?: number | null;
};

export type StravaWebhookEvent = {
  object_type: string;
  object_id: number;
  aspect_type: "create" | "update" | "delete" | string;
  owner_id: number;
  subscription_id: number;
  updates?: Record<string, unknown>;
  event_time?: number;
};

export type StravaRateLimitWindow = {
  usage: number;
  limit: number;
};

export type StravaRateLimitInfo = {
  short: StravaRateLimitWindow | null;
  daily: StravaRateLimitWindow | null;
};

export type StravaApiResponse<T> = {
  data: T;
  rateLimit: StravaRateLimitInfo;
};

export type StravaOAuthStatePayload = {
  issuedAt: number;
  nonce: string;
  returnTo?: string | null;
};

export type NormalizedCompletedWorkoutDraft = {
  sourceWorkoutId: string;
  date: string;
  type: "easy" | "tempo" | "interval" | "long" | "recovery";
  distanceKm: number;
  durationMinutes: number;
  perceivedEffort: number;
  summary: string;
};

const STRAVA_OAUTH_URL = "https://www.strava.com/oauth/authorize";
const STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token";
const STRAVA_API_URL = "https://www.strava.com/api/v3";

export class StravaApiError extends Error {
  readonly status: number;
  readonly details: unknown;
  readonly rateLimit: StravaRateLimitInfo;

  constructor(message: string, status: number, details: unknown, rateLimit: StravaRateLimitInfo) {
    super(message);
    this.name = "StravaApiError";
    this.status = status;
    this.details = details;
    this.rateLimit = rateLimit;
  }

  get isRetriable() {
    return this.status === 429 || this.status >= 500;
  }
}

export function buildStravaAuthorizationUrl({
  clientId,
  redirectUri,
  state,
  scope = [...STRAVA_DEFAULT_SCOPES],
  approvalPrompt = "auto",
}: StravaAuthorizationInput) {
  const search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    approval_prompt: approvalPrompt,
    scope: scope.join(","),
    state,
  });

  return `${STRAVA_OAUTH_URL}?${search.toString()}`;
}

export function createStravaOAuthNonce() {
  return randomBytes(16).toString("hex");
}

export function createSignedStravaOAuthState(
  payload: StravaOAuthStatePayload,
  secret: string,
) {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = signStatePayload(encodedPayload, secret);

  return `${encodedPayload}.${signature}`;
}

export function verifySignedStravaOAuthState(
  state: string,
  secret: string,
  maxAgeSeconds = 10 * 60,
) {
  const [encodedPayload, providedSignature] = state.split(".");
  if (!encodedPayload || !providedSignature) {
    throw new Error("Malformed Strava OAuth state.");
  }

  const expectedSignature = signStatePayload(encodedPayload, secret);
  const expected = Buffer.from(expectedSignature, "utf8");
  const provided = Buffer.from(providedSignature, "utf8");

  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    throw new Error("Invalid Strava OAuth state signature.");
  }

  const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as
    | StravaOAuthStatePayload
    | undefined;

  if (!payload?.issuedAt || !payload?.nonce) {
    throw new Error("Incomplete Strava OAuth state payload.");
  }

  const ageSeconds = Math.floor(Date.now() / 1000) - payload.issuedAt;
  if (ageSeconds > maxAgeSeconds) {
    throw new Error("Expired Strava OAuth state.");
  }

  return payload;
}

export function parseStravaScopes(scope: string | null | undefined) {
  if (!scope) {
    return [...STRAVA_DEFAULT_SCOPES];
  }

  return [...new Set(scope.split(/[\s,]+/).map((value) => value.trim()).filter(Boolean))];
}

export function isStravaTokenExpired(expiresAt: Date | number | null | undefined, skewSeconds = 300) {
  if (!expiresAt) {
    return true;
  }

  const expiryEpoch = expiresAt instanceof Date ? Math.floor(expiresAt.getTime() / 1000) : expiresAt;
  return expiryEpoch <= Math.floor(Date.now() / 1000) + skewSeconds;
}

export async function exchangeStravaAuthorizationCode(input: {
  clientId: string;
  clientSecret: string;
  code: string;
}) {
  return requestStravaToken({
    client_id: input.clientId,
    client_secret: input.clientSecret,
    code: input.code,
    grant_type: "authorization_code",
  });
}

export async function refreshStravaAccessToken(input: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}) {
  return requestStravaToken({
    client_id: input.clientId,
    client_secret: input.clientSecret,
    refresh_token: input.refreshToken,
    grant_type: "refresh_token",
  });
}

export async function fetchStravaActivity(input: { accessToken: string; activityId: number }) {
  return requestStravaApi<StravaActivity>(`/activities/${input.activityId}`, {
    accessToken: input.accessToken,
  });
}

export async function fetchStravaActivities(input: {
  accessToken: string;
  after?: number;
  page?: number;
  perPage?: number;
}) {
  const params = new URLSearchParams();
  if (input.after) {
    params.set("after", String(input.after));
  }
  if (input.page) {
    params.set("page", String(input.page));
  }
  if (input.perPage) {
    params.set("per_page", String(input.perPage));
  }

  return requestStravaApi<StravaActivity[]>(`/athlete/activities?${params.toString()}`, {
    accessToken: input.accessToken,
  });
}

export function parseStravaRateLimit(headers: Headers): StravaRateLimitInfo {
  const limits = headers.get("x-ratelimit-limit")?.split(",").map((value) => Number(value.trim()));
  const usage = headers.get("x-ratelimit-usage")?.split(",").map((value) => Number(value.trim()));

  return {
    short: buildRateLimitWindow(limits?.[0], usage?.[0]),
    daily: buildRateLimitWindow(limits?.[1], usage?.[1]),
  };
}

export function isNearStravaRateLimit(rateLimit: StravaRateLimitInfo, threshold = 0.9) {
  return [rateLimit.short, rateLimit.daily].some(
    (window) => window !== null && window.limit > 0 && window.usage / window.limit >= threshold,
  );
}

export function isImportableStravaActivity(activity: StravaActivity) {
  return STRAVA_IMPORTABLE_SPORT_TYPES.includes(activity.sport_type as (typeof STRAVA_IMPORTABLE_SPORT_TYPES)[number])
    && Math.max(activity.moving_time, activity.elapsed_time) > 0;
}

export function mapStravaActivityToCompletedWorkout(
  activity: StravaActivity,
): NormalizedCompletedWorkoutDraft | null {
  if (!isImportableStravaActivity(activity)) {
    return null;
  }

  const distanceKm = roundTo(activity.distance / 1000, 2);
  const durationMinutes = Math.max(1, Math.round(Math.max(activity.moving_time, activity.elapsed_time) / 60));
  const normalizedType = classifyWorkoutType(activity, distanceKm, durationMinutes);
  const perceivedEffort = inferPerceivedEffort(activity, normalizedType);
  const date = (activity.start_date_local ?? activity.start_date).slice(0, 10);
  const summary = buildWorkoutSummary(activity, distanceKm, durationMinutes, normalizedType);

  return {
    sourceWorkoutId: String(activity.id),
    date,
    type: normalizedType,
    distanceKm,
    durationMinutes,
    perceivedEffort,
    summary,
  };
}

export function getStravaActivityDiscardReason(activity: StravaActivity) {
  if (!STRAVA_IMPORTABLE_SPORT_TYPES.includes(activity.sport_type as (typeof STRAVA_IMPORTABLE_SPORT_TYPES)[number])) {
    return `Unsupported Strava sport type: ${activity.sport_type}`;
  }

  return "Strava activity is missing a usable duration.";
}

export const stravaEnvironmentKeys = [
  "STRAVA_CLIENT_ID",
  "STRAVA_CLIENT_SECRET",
  "STRAVA_REDIRECT_URI",
  "STRAVA_WEBHOOK_VERIFY_TOKEN",
] as const;

async function requestStravaToken(payload: Record<string, string>) {
  const response = await fetch(STRAVA_TOKEN_URL, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(payload),
  });

  const rateLimit = parseStravaRateLimit(response.headers);
  const data = await parseResponseBody(response);

  if (!response.ok) {
    throw new StravaApiError("Strava token exchange failed.", response.status, data, rateLimit);
  }

  return data as StravaTokenExchangeResponse;
}

async function requestStravaApi<T>(path: string, input: { accessToken: string }): Promise<StravaApiResponse<T>> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const response = await fetch(`${STRAVA_API_URL}${normalizedPath}`, {
    headers: {
      authorization: `Bearer ${input.accessToken}`,
    },
    cache: "no-store",
  });

  const rateLimit = parseStravaRateLimit(response.headers);
  const data = await parseResponseBody(response);

  if (!response.ok) {
    throw new StravaApiError("Strava API request failed.", response.status, data, rateLimit);
  }

  return {
    data: data as T,
    rateLimit,
  };
}

async function parseResponseBody(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return response.json();
  }

  return response.text();
}

function signStatePayload(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function buildRateLimitWindow(limit: number | undefined, usage: number | undefined) {
  if (!Number.isFinite(limit) || !Number.isFinite(usage)) {
    return null;
  }

  return {
    limit: Number(limit),
    usage: Number(usage),
  };
}

function classifyWorkoutType(
  activity: StravaActivity,
  distanceKm: number,
  durationMinutes: number,
): NormalizedCompletedWorkoutDraft["type"] {
  const label = `${activity.name} ${activity.description ?? ""}`.toLowerCase();

  if (/(interval|repeat|repeats|track|fartlek)/.test(label) || activity.workout_type === 1) {
    return "interval";
  }

  if (/(tempo|threshold|steady|progression)/.test(label) || activity.workout_type === 3) {
    return "tempo";
  }

  if (/(long run|long)/.test(label) || distanceKm >= 16 || durationMinutes >= 90) {
    return "long";
  }

  if (activity.sport_type === "Walk" || /(recovery|shakeout|shake-out|easy walk)/.test(label)) {
    return "recovery";
  }

  if (distanceKm <= 5 && durationMinutes <= 35) {
    return "recovery";
  }

  return "easy";
}

function inferPerceivedEffort(
  activity: StravaActivity,
  type: NormalizedCompletedWorkoutDraft["type"],
) {
  const baseEffort: Record<NormalizedCompletedWorkoutDraft["type"], number> = {
    recovery: 3,
    easy: 4,
    long: 6,
    tempo: 7,
    interval: 8,
  };

  let effort = baseEffort[type];
  if ((activity.suffer_score ?? 0) >= 120) {
    effort += 1;
  }
  if ((activity.average_heartrate ?? 0) >= 170) {
    effort += 1;
  }

  return Math.max(1, Math.min(10, effort));
}

function buildWorkoutSummary(
  activity: StravaActivity,
  distanceKm: number,
  durationMinutes: number,
  type: NormalizedCompletedWorkoutDraft["type"],
) {
  const sportLabel = activity.sport_type === "TrailRun" ? "trail run" : activity.sport_type.toLowerCase();
  return `${activity.name} (${type}) • ${distanceKm.toFixed(2)} km ${sportLabel} in ${durationMinutes} min.`;
}

function roundTo(value: number, digits: number) {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}
