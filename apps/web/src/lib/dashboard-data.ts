import {
  buildAthleteStateSummary,
  buildCoachDashboardState,
  buildGovernanceSummary,
  generateCoachingWorkflowWithLlm,
  buildThreatModelSummary,
  coachPersona,
  demoAthleteProfile,
  demoCompletedWorkouts,
  demoDeferredFeatures,
  deterministicGuardrails,
  demoGoals,
  demoMemories,
  evaluateFatigueCheck,
  generateNextWorkoutSuggestion,
  generatePostWorkoutDebrief,
  generateWeeklyReview,
  type WorkflowResult,
} from "@personal-running-coach/coach-core";
import {
  createDatabaseConnection,
  loadAthleteRuntimeContext,
  sensitiveFieldControls,
  tableCatalog,
} from "@personal-running-coach/db";
import {
  createModelProviderClient,
  integrationStatusCards,
  readEnvVar,
  requireEnvVar,
} from "@personal-running-coach/integrations";

import { getEnvironmentStatus } from "./server-config";

export type CoachingWorkflowPreview = {
  workflow: string;
  headline: string;
  bodyParagraphs: string[];
  risk: string;
  requiresApproval: boolean;
  approvalReason: string | null;
};

export type GuardrailPreview = {
  id: string;
  title: string;
  scope: string;
  condition: string;
  effect: string;
};

export async function getDashboardData() {
  const threatModel = buildThreatModelSummary();
  const liveData = hasLiveCoachingRuntimeConfig() ? await getLiveDashboardSnapshot() : null;

  return {
    coachPersona,
    dashboard:
      liveData?.dashboard ??
      buildCoachDashboardState({
        profile: demoAthleteProfile,
        goals: demoGoals,
        memories: demoMemories,
        recentWorkouts: demoCompletedWorkouts,
        deferredFeatures: demoDeferredFeatures,
      }),
    coachingWorkflows: liveData?.coachingWorkflows ?? getDemoCoachingWorkflowPreviews(),
    deterministicGuardrails: deterministicGuardrails.map(toGuardrailPreview),
    deferredFeatures: demoDeferredFeatures,
    environmentStatus: getEnvironmentStatus(),
    governance: buildGovernanceSummary(),
    integrations: integrationStatusCards,
    sensitiveFieldControls,
    tableCatalog,
    threatModel,
  };
}

function getDemoCoachingWorkflowPreviews(): CoachingWorkflowPreview[] {
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

async function getLiveDashboardSnapshot(): Promise<{
  dashboard: ReturnType<typeof buildCoachDashboardState>;
  coachingWorkflows: CoachingWorkflowPreview[];
} | null> {
  const connection = createDatabaseConnection();

  try {
    const context = await loadAthleteRuntimeContext(connection.db);
    if (!context) {
      return null;
    }

    const stateSummary = buildAthleteStateSummary({
      profile: context.profile,
      goals: context.goals,
      memories: context.memories,
      recentWorkouts: context.recentWorkouts,
    });

    const dashboard = buildCoachDashboardState({
      profile: context.profile,
      goals: context.goals,
      memories: context.memories,
      recentWorkouts: context.recentWorkouts,
      deferredFeatures: demoDeferredFeatures,
    });

    const model = createModelProviderClient(requireEnvVar("MODEL_PROVIDER_API_KEY"), {
      baseUrl: readEnvVar("MODEL_PROVIDER_BASE_URL") ?? undefined,
      model: readEnvVar("MODEL_PROVIDER_MODEL") ?? undefined,
    });

    const workflowPromises: Array<Promise<CoachingWorkflowPreview | null>> = [];

    if (context.recentWorkouts.length > 0) {
      workflowPromises.push(
        generateCoachingWorkflowWithLlm(
          {
            profile: context.profile,
            stateSummary,
            memories: context.memories,
            recentWorkouts: context.recentWorkouts,
            recentThread: context.recentThread,
            workflow: "post-workout-debrief",
          },
          model,
        ).then((generated) => toPreview(generated.result)),
      );
    }

    workflowPromises.push(
      generateCoachingWorkflowWithLlm(
        {
          profile: context.profile,
          stateSummary,
          memories: context.memories,
          recentWorkouts: context.recentWorkouts,
          recentThread: context.recentThread,
          workflow: "weekly-review",
        },
        model,
      ).then((generated) => toPreview(generated.result)),
    );

    const fatigueTrigger = evaluateFatigueCheck({
      recentWorkouts: context.recentWorkouts,
      stateSummary,
      profile: context.profile,
    });
    if (fatigueTrigger) {
      workflowPromises.push(
        generateCoachingWorkflowWithLlm(
          {
            profile: context.profile,
            stateSummary,
            memories: context.memories,
            recentWorkouts: context.recentWorkouts,
            recentThread: context.recentThread,
            workflow: "fatigue-check",
          },
          model,
        ).then((generated) => toPreview(generated.result)),
      );
    }

    workflowPromises.push(
      generateCoachingWorkflowWithLlm(
        {
          profile: context.profile,
          stateSummary,
          memories: context.memories,
          recentWorkouts: context.recentWorkouts,
          recentThread: context.recentThread,
          workflow: "next-workout-suggestion",
        },
        model,
      ).then((generated) => toPreview(generated.result)),
    );

    const coachingWorkflows = (await Promise.all(workflowPromises)).filter(
      (preview): preview is CoachingWorkflowPreview => preview !== null,
    );

    return {
      dashboard,
      coachingWorkflows,
    };
  } finally {
    await connection.close();
  }
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

function toGuardrailPreview(guardrail: (typeof deterministicGuardrails)[number]): GuardrailPreview {
  return {
    id: guardrail.id,
    title: guardrail.title,
    scope: guardrail.scope,
    condition: guardrail.condition,
    effect: guardrail.effect,
  };
}

function hasLiveCoachingRuntimeConfig() {
  return Boolean(
    readEnvVar("DATABASE_URL") &&
      readEnvVar("APP_ENCRYPTION_KEY") &&
      readEnvVar("MODEL_PROVIDER_API_KEY"),
  );
}
