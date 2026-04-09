import {
  buildCoachDashboardState,
  buildThreatModelSummary,
  demoAthleteProfile,
  demoCompletedWorkouts,
  demoDeferredFeatures,
  demoGoals,
  demoMemories,
} from "@personal-running-coach/coach-core";
import { sensitiveFieldControls, tableCatalog } from "@personal-running-coach/db";
import {
  buildStravaAuthorizationUrl,
  getEnvMeta,
  integrationStatusCards,
  telegramWebhookGuidance,
  validateEnv,
  workerEnvSpecs,
} from "@personal-running-coach/integrations";

// ---------------------------------------------------------------------------
// Startup env validation — surfaces all missing vars at once.
// In production this should be a hard crash; in demo mode we warn and continue.
// ---------------------------------------------------------------------------
try {
  validateEnv(workerEnvSpecs);
} catch (err) {
  const error = err as { missingKeys?: string[]; message?: string };
  console.warn(
    "[worker] Env validation warning (demo mode — continuing without real secrets):",
    error.missingKeys ?? error.message,
  );
}

const dashboardState = buildCoachDashboardState({
  profile: demoAthleteProfile,
  goals: demoGoals,
  memories: demoMemories,
  recentWorkouts: demoCompletedWorkouts,
  deferredFeatures: demoDeferredFeatures,
});

const threatModel = buildThreatModelSummary();

const output = {
  startup: "personal-running-coach worker booted",
  envStatus: getEnvMeta(workerEnvSpecs),
  dashboardState,
  integrations: integrationStatusCards,
  stravaAuthPreview: buildStravaAuthorizationUrl({
    clientId: "demo-client-id",
    redirectUri: "https://example.com/api/strava/callback",
    state: "demo-state",
  }),
  telegramWebhookGuidance,
  tableCatalog,
  sensitiveFieldControls,
  threatModel: {
    version: threatModel.version,
    activeRiskCount: threatModel.activeRiskCount,
    activeMitigationCount: threatModel.activeMitigationCount,
  },
};

console.log(JSON.stringify(output, null, 2));
