import {
  buildAthleteStateSummary,
  buildCoachDashboardState,
  buildThreatModelSummary,
  demoAthleteProfile,
  demoCompletedWorkouts,
  demoDeferredFeatures,
  demoGoals,
  demoMemories,
  evaluateFatigueCheck,
  generateNextWorkoutSuggestion,
  generatePostWorkoutDebrief,
  generateWeeklyReview,
  type WorkflowResult,
} from "@personal-running-coach/coach-core";
import { sensitiveFieldControls, tableCatalog } from "@personal-running-coach/db";
import { integrationStatusCards } from "@personal-running-coach/integrations";

import { getEnvironmentStatus } from "./server-config";

export type CoachingWorkflowPreview = {
  workflow: string;
  headline: string;
  bodyParagraphs: string[];
  risk: string;
  requiresApproval: boolean;
  approvalReason: string | null;
};

export function getDashboardData() {
  const threatModel = buildThreatModelSummary();

  return {
    dashboard: buildCoachDashboardState({
      profile: demoAthleteProfile,
      goals: demoGoals,
      memories: demoMemories,
      recentWorkouts: demoCompletedWorkouts,
      deferredFeatures: demoDeferredFeatures,
    }),
    coachingWorkflows: getCoachingWorkflowPreviews(),
    deferredFeatures: demoDeferredFeatures,
    environmentStatus: getEnvironmentStatus(),
    integrations: integrationStatusCards,
    sensitiveFieldControls,
    tableCatalog,
    threatModel,
  };
}

function getCoachingWorkflowPreviews(): CoachingWorkflowPreview[] {
  const stateSummary = buildAthleteStateSummary({
    profile: demoAthleteProfile,
    goals: demoGoals,
    memories: demoMemories,
    recentWorkouts: demoCompletedWorkouts,
  });

  const previews: CoachingWorkflowPreview[] = [];

  // Post-workout debrief
  const latestWorkout = [...demoCompletedWorkouts].sort((a, b) =>
    b.date.localeCompare(a.date),
  )[0];
  if (latestWorkout) {
    const debrief = generatePostWorkoutDebrief({
      workout: latestWorkout,
      stateSummary,
      profile: demoAthleteProfile,
    });
    previews.push(toPreview(debrief));
  }

  // Weekly review
  const review = generateWeeklyReview({
    recentWorkouts: demoCompletedWorkouts,
    stateSummary,
    profile: demoAthleteProfile,
  });
  previews.push(toPreview(review));

  // Fatigue check (may be null)
  const fatigue = evaluateFatigueCheck({
    recentWorkouts: demoCompletedWorkouts,
    stateSummary,
    profile: demoAthleteProfile,
  });
  if (fatigue) {
    previews.push(toPreview(fatigue));
  }

  // Next-workout suggestion
  const next = generateNextWorkoutSuggestion({
    recentWorkouts: demoCompletedWorkouts,
    stateSummary,
    profile: demoAthleteProfile,
  });
  previews.push(toPreview(next));

  return previews;
}

function toPreview(result: WorkflowResult): CoachingWorkflowPreview {
  return {
    workflow: result.workflow,
    headline: result.headline,
    bodyParagraphs: result.bodyParagraphs,
    risk: result.risk,
    requiresApproval: result.requiresApproval,
    approvalReason: result.approvalReason,
  };
}
