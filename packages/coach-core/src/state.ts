import type {
  AthleteGoal,
  AthleteProfile,
  CoachMemory,
  CompletedWorkout,
  DashboardState,
  DeferredFeatureSpec,
} from "./types";

type BuildCoachDashboardStateInput = {
  profile: AthleteProfile;
  goals: AthleteGoal[];
  memories: CoachMemory[];
  recentWorkouts: CompletedWorkout[];
  deferredFeatures: DeferredFeatureSpec[];
};

export function buildCoachDashboardState({
  profile,
  goals,
  memories,
  recentWorkouts,
  deferredFeatures,
}: BuildCoachDashboardStateInput): DashboardState {
  const weeklyDistanceKm = round(
    recentWorkouts.reduce((total, workout) => total + workout.distanceKm, 0),
  );
  const weeklyDurationMinutes = recentWorkouts.reduce(
    (total, workout) => total + workout.durationMinutes,
    0,
  );

  const coachPriorities = [
    goals[0]?.name ?? "Confirm the next priority race.",
    recentWorkouts.at(-1)?.summary ?? "Review the last workout.",
    "Keep proactive check-ins concise and context-aware.",
  ];

  const riskFlags = [
    ...profile.injuryFlags,
    ...(recentWorkouts.some((workout) => workout.perceivedEffort >= 7)
      ? ["Recent intensity was high enough to justify a recovery check-in."]
      : []),
  ];

  return {
    athleteName: profile.displayName,
    weeklyDistanceKm,
    weeklyDurationMinutes,
    currentFocus:
      goals[0]?.notes ??
      "Build enough recent training context to deliver useful coaching suggestions.",
    coachPriorities,
    riskFlags,
    memoryHighlights: memories.map((memory) => `${memory.title}: ${memory.detail}`),
    deferredFeatureTitles: deferredFeatures.map((feature) => feature.title),
  };
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}
