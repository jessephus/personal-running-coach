import {
  buildCoachDashboardState,
  demoAthleteProfile,
  demoCompletedWorkouts,
  demoDeferredFeatures,
  demoGoals,
  demoMemories,
} from "@personal-running-coach/coach-core";
import { sensitiveFieldControls, tableCatalog } from "@personal-running-coach/db";
import { integrationStatusCards } from "@personal-running-coach/integrations";

import { getEnvironmentStatus } from "./server-config";

export function getDashboardData() {
  return {
    dashboard: buildCoachDashboardState({
      profile: demoAthleteProfile,
      goals: demoGoals,
      memories: demoMemories,
      recentWorkouts: demoCompletedWorkouts,
      deferredFeatures: demoDeferredFeatures,
    }),
    deferredFeatures: demoDeferredFeatures,
    environmentStatus: getEnvironmentStatus(),
    integrations: integrationStatusCards,
    sensitiveFieldControls,
    tableCatalog,
  };
}
