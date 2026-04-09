// ---------------------------------------------------------------------------
// Shared environment variable definitions and validation helpers.
//
// Design principles aligned with the threat model:
//   - Secret values are NEVER returned from any function in this module.
//   - validateEnv() is for startup — throws on missing required vars.
//   - getEnvMeta() returns presence-only metadata safe for APIs and the dashboard.
//   - requireEnvVar() / readEnvVar() are the only entry points for actual values,
//     and must only be used in server-side code, never passed to the client.
// ---------------------------------------------------------------------------

/** Mirrors the threat-model sensitivity levels without a cross-package import. */
export type EnvClassification = "critical" | "high" | "medium" | "low";

export type EnvVarSpec = {
  /** The exact process.env key. */
  key: string;
  /** Whether absence should be treated as a startup failure. */
  required: boolean;
  /** Human-readable purpose shown in the dashboard and health endpoint. */
  description: string;
  /**
   * Data classification matching the threat model.
   * critical → credentials / secrets
   * high     → routing IDs (chat ID, client ID)
   * medium   → operational config
   * low      → public values (NEXT_PUBLIC_*)
   */
  classification: EnvClassification;
};

/** Safe metadata returned from getEnvMeta(). Never includes the actual value. */
export type EnvVarMeta = {
  key: string;
  configured: boolean;
  required: boolean;
  description: string;
  classification: EnvClassification;
};

export class EnvValidationError extends Error {
  readonly missingKeys: string[];

  constructor(missingKeys: string[]) {
    super(`Missing required environment variable(s): ${missingKeys.join(", ")}`);
    this.name = "EnvValidationError";
    this.missingKeys = missingKeys;
  }
}

// ---------------------------------------------------------------------------
// Canonical env var definitions
// ---------------------------------------------------------------------------

/**
 * All env vars required or used by the web app.
 * Shared with the health and integrations API routes and the dashboard.
 */
export const webEnvSpecs: EnvVarSpec[] = [
  {
    key: "NEXT_PUBLIC_APP_URL",
    required: false,
    description:
      "Base URL of the web application. Public — safe to expose in the browser.",
    classification: "low",
  },
  {
    key: "DATABASE_URL",
    required: true,
    description:
      "Primary Postgres connection string for canonical athlete, integration, and import state.",
    classification: "critical",
  },
  {
    key: "APP_ENCRYPTION_KEY",
    required: true,
    description:
      "Application-layer encryption key used for OAuth tokens, raw import payloads, and signed Strava state.",
    classification: "critical",
  },
  {
    key: "STRAVA_CLIENT_ID",
    required: true,
    description:
      "Strava OAuth client ID. Needed to start the authorization flow.",
    classification: "high",
  },
  {
    key: "STRAVA_CLIENT_SECRET",
    required: true,
    description:
      "Strava OAuth client secret. Exchanged server-side only; never exposed to the browser.",
    classification: "critical",
  },
  {
    key: "STRAVA_WEBHOOK_VERIFY_TOKEN",
    required: false,
    description:
      "Optional Strava webhook verification token for subscription setup and inbound webhook validation.",
    classification: "critical",
  },
  {
    key: "TELEGRAM_BOT_TOKEN",
    required: true,
    description:
      "Telegram bot token. High-risk credential — rotate on any suspected exposure.",
    classification: "critical",
  },
  {
    key: "TELEGRAM_CHAT_ID",
    required: true,
    description:
      "Constrains the MVP to the intended athlete chat. Required for inbound message filtering.",
    classification: "high",
  },
  {
    key: "TELEGRAM_WEBHOOK_SECRET",
    required: true,
    description:
      "Verifies the authenticity of inbound Telegram webhook calls.",
    classification: "critical",
  },
  {
    key: "MODEL_PROVIDER_API_KEY",
    required: true,
    description:
      "API key for the frontier model provider. Used only with privacy controls; never included in prompt logs.",
    classification: "critical",
  },
];

/**
 * Env vars required or used by the background worker.
 * The worker does not serve HTTP, so Strava OAuth vars are not needed at startup.
 */
export const workerEnvSpecs: EnvVarSpec[] = [
  {
    key: "DATABASE_URL",
    required: true,
    description:
      "Primary Postgres connection string for canonical athlete and integration state.",
    classification: "critical",
  },
  {
    key: "APP_ENCRYPTION_KEY",
    required: true,
    description:
      "Application-layer encryption key used when the worker reads or writes sensitive integration data.",
    classification: "critical",
  },
  {
    key: "TELEGRAM_BOT_TOKEN",
    required: true,
    description:
      "Telegram bot token. Required for outbound nudges and inbound webhook processing.",
    classification: "critical",
  },
  {
    key: "TELEGRAM_CHAT_ID",
    required: true,
    description:
      "Constrains inbound processing to the intended athlete chat.",
    classification: "high",
  },
  {
    key: "TELEGRAM_WEBHOOK_SECRET",
    required: true,
    description:
      "Verifies the authenticity of inbound Telegram webhook calls.",
    classification: "critical",
  },
  {
    key: "MODEL_PROVIDER_API_KEY",
    required: true,
    description:
      "API key for the frontier model provider. Used only with privacy controls.",
    classification: "critical",
  },
];

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

/**
 * Validates that all required vars in the spec are present.
 *
 * Call this at application startup. Throws EnvValidationError listing every
 * missing key so that all problems surface in a single error, not one at a
 * time. Never logs or returns secret values.
 */
export function validateEnv(
  specs: EnvVarSpec[],
  env: Record<string, string | undefined> = process.env,
): void {
  const missing = specs
    .filter((spec) => spec.required && !env[spec.key])
    .map((spec) => spec.key);

  if (missing.length > 0) {
    throw new EnvValidationError(missing);
  }
}

/**
 * Returns presence-only metadata for every var in the spec.
 *
 * Safe to include in API responses and the dashboard. Never returns values.
 */
export function getEnvMeta(
  specs: EnvVarSpec[],
  env: Record<string, string | undefined> = process.env,
): EnvVarMeta[] {
  return specs.map((spec) => ({
    key: spec.key,
    configured: Boolean(env[spec.key]),
    required: spec.required,
    description: spec.description,
    classification: spec.classification,
  }));
}

/**
 * Reads a single required env var and returns its value.
 *
 * For use in server-side route handlers and workers that need the actual
 * credential. Never pass the return value to the client.
 *
 * @throws EnvValidationError if the variable is not set.
 */
export function requireEnvVar(
  key: string,
  env: Record<string, string | undefined> = process.env,
): string {
  const value = env[key];
  if (!value) {
    throw new EnvValidationError([key]);
  }
  return value;
}

/**
 * Reads a single optional env var. Returns null if not configured.
 *
 * For use in server-side code only. Never pass the return value to the client.
 */
export function readEnvVar(
  key: string,
  env: Record<string, string | undefined> = process.env,
): string | null {
  return env[key] ?? null;
}
