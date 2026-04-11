import {
  getEnvMeta,
  readEnvVar,
  webEnvSpecs,
} from "@coachinclaw/integrations";

export type { EnvVarMeta, EnvVarSpec } from "@coachinclaw/integrations";
export { requireEnvVar, validateEnv, webEnvSpecs } from "@coachinclaw/integrations";

/** Non-secret server-side config values needed for routing and URL construction. */
export type ServerConfig = {
  appUrl: string;
  /** The Strava OAuth client ID. Not a secret, but only used server-side. */
  stravaClientId: string | null;
};

export function getServerConfig(): ServerConfig {
  return {
    appUrl: readEnvVar("NEXT_PUBLIC_APP_URL") ?? "http://localhost:3000",
    stravaClientId: readEnvVar("STRAVA_CLIENT_ID"),
  };
}

/**
 * Returns presence-only metadata for all web env vars.
 * Safe to include in API responses and the dashboard. Never includes values.
 */
export function getEnvironmentStatus() {
  return getEnvMeta(webEnvSpecs);
}
