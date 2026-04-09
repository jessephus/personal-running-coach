import {
  buildCoachDashboardState,
  demoAthleteProfile,
  demoCompletedWorkouts,
  demoDeferredFeatures,
  demoGoals,
  demoMemories,
} from "@personal-running-coach/coach-core";
import { sensitiveFieldControls, tableCatalog } from "@personal-running-coach/db";
import { buildStravaAuthorizationUrl, integrationStatusCards, telegramWebhookGuidance } from "@personal-running-coach/integrations";

const dashboardState = buildCoachDashboardState({
  profile: demoAthleteProfile,
  goals: demoGoals,
  memories: demoMemories,
  recentWorkouts: demoCompletedWorkouts,
  deferredFeatures: demoDeferredFeatures,
});

const output = {
  startup: "personal-running-coach worker booted",
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
};

console.log(JSON.stringify(output, null, 2));
