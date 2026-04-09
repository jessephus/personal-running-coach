// ---------------------------------------------------------------------------
// Athlete-state summary — richer training-load, injury-risk, and goal-progress
// assessment for coaching decisions
// ---------------------------------------------------------------------------

import type { AthleteGoal, AthleteProfile, CoachMemory, CompletedWorkout, GoalPriority } from "../types";

export type TrainingLoad = {
  weeklyDistanceKm: number;
  weeklyDurationMinutes: number;
  averagePerceivedEffort: number;
  /** Sessions with perceivedEffort >= 7 */
  hardSessionCount: number;
  /** Sessions with type === "recovery" or perceivedEffort <= 3 */
  recoverySessionCount: number;
  trend: "increasing" | "stable" | "decreasing" | "insufficient-data";
};

export type InjuryRiskLevel = "low" | "moderate" | "high";

export type InjuryRiskAssessment = {
  level: InjuryRiskLevel;
  /** All known flags: from profile.injuryFlags + injury-category memories */
  activeFlags: string[];
  /** Workout summaries that contain injury-adjacent language */
  recentTriggers: string[];
};

export type GoalReadiness = "on-track" | "needs-attention" | "at-risk";

export type GoalProgress = {
  goalId: string;
  goalName: string;
  priority: GoalPriority;
  daysUntilTarget: number | null;
  readiness: GoalReadiness;
};

export type AthleteStateSummary = {
  athleteName: string;
  asOfDate: string;
  trainingLoad: TrainingLoad;
  injuryRisk: InjuryRiskAssessment;
  goalProgress: GoalProgress[];
  coachPriorities: string[];
  memoryHighlights: string[];
};

type BuildAthleteStateSummaryInput = {
  profile: AthleteProfile;
  goals: AthleteGoal[];
  memories: CoachMemory[];
  recentWorkouts: CompletedWorkout[];
};

/** Compute weekly training load metrics from a set of workouts. */
export function assessTrainingLoad(recentWorkouts: CompletedWorkout[]): TrainingLoad {
  if (recentWorkouts.length === 0) {
    return {
      weeklyDistanceKm: 0,
      weeklyDurationMinutes: 0,
      averagePerceivedEffort: 0,
      hardSessionCount: 0,
      recoverySessionCount: 0,
      trend: "insufficient-data",
    };
  }

  const weeklyDistanceKm = round(recentWorkouts.reduce((s, w) => s + w.distanceKm, 0));
  const weeklyDurationMinutes = recentWorkouts.reduce((s, w) => s + w.durationMinutes, 0);
  const averagePerceivedEffort = round(
    recentWorkouts.reduce((s, w) => s + w.perceivedEffort, 0) / recentWorkouts.length,
  );
  const hardSessionCount = recentWorkouts.filter((w) => w.perceivedEffort >= 7).length;
  const recoverySessionCount = recentWorkouts.filter(
    (w) => w.type === "recovery" || w.perceivedEffort <= 3,
  ).length;

  return {
    weeklyDistanceKm,
    weeklyDurationMinutes,
    averagePerceivedEffort,
    hardSessionCount,
    recoverySessionCount,
    trend: deriveTrend(recentWorkouts),
  };
}

function deriveTrend(workouts: CompletedWorkout[]): TrainingLoad["trend"] {
  if (workouts.length < 2) return "insufficient-data";
  const sorted = [...workouts].sort((a, b) => a.date.localeCompare(b.date));
  const mid = Math.floor(sorted.length / 2);
  const earlyKm = sorted.slice(0, mid).reduce((s, w) => s + w.distanceKm, 0);
  const lateKm = sorted.slice(mid).reduce((s, w) => s + w.distanceKm, 0);
  if (earlyKm === 0) return "stable";
  const ratio = lateKm / earlyKm;
  if (ratio > 1.1) return "increasing";
  if (ratio < 0.9) return "decreasing";
  return "stable";
}

/** Synthesize injury risk from profile flags, injury memories, and recent workout signals. */
export function assessInjuryRisk(
  profile: AthleteProfile,
  memories: CoachMemory[],
  recentWorkouts: CompletedWorkout[],
): InjuryRiskAssessment {
  const activeFlags = [...profile.injuryFlags];

  for (const mem of memories.filter((m) => m.category === "injury")) {
    if (!activeFlags.includes(mem.title)) {
      activeFlags.push(mem.title);
    }
  }

  const injuryPattern =
    /\b(pain|ache|sore|tight|strain|twinge|hurt|calf|hamstring|knee|ankle|shin)\b/i;
  const recentTriggers = recentWorkouts
    .filter((w) => injuryPattern.test(w.summary))
    .map((w) => `${w.date}: ${w.summary.slice(0, 80)}${w.summary.length > 80 ? "..." : ""}`);

  const highEffortCount = recentWorkouts.filter((w) => w.perceivedEffort >= 8).length;

  let level: InjuryRiskLevel = "low";
  if (
    recentTriggers.length >= 2 ||
    (recentTriggers.length >= 1 && highEffortCount >= 2)
  ) {
    level = "high";
  } else if (recentTriggers.length >= 1 || activeFlags.length >= 2) {
    level = "moderate";
  }

  return { level, activeFlags, recentTriggers };
}

/** Derive readiness signals for each goal given the current training load. */
export function assessGoalProgress(
  goals: AthleteGoal[],
  trainingLoad: TrainingLoad,
  asOfDate: string = new Date().toISOString().slice(0, 10),
): GoalProgress[] {
  return goals.map((goal) => {
    const targetMs = new Date(goal.targetDate).getTime();
    const nowMs = new Date(asOfDate).getTime();
    const daysUntilTarget = Math.ceil((targetMs - nowMs) / (1000 * 60 * 60 * 24));

    return {
      goalId: goal.id,
      goalName: goal.name,
      priority: goal.priority,
      daysUntilTarget,
      readiness: deriveGoalReadiness(goal, trainingLoad, daysUntilTarget),
    };
  });
}

function deriveGoalReadiness(
  goal: AthleteGoal,
  load: TrainingLoad,
  daysUntilTarget: number,
): GoalReadiness {
  if (daysUntilTarget < 0) return "at-risk";

  if (goal.priority === "A" && daysUntilTarget <= 60) {
    if (load.weeklyDistanceKm >= 40 && load.trend !== "decreasing") return "on-track";
    return load.weeklyDistanceKm >= 25 ? "needs-attention" : "at-risk";
  }

  if (load.trend === "decreasing" && load.weeklyDistanceKm < 20) return "needs-attention";
  return "on-track";
}

/** Build a comprehensive athlete state summary for use in coaching context assembly. */
export function buildAthleteStateSummary({
  profile,
  goals,
  memories,
  recentWorkouts,
}: BuildAthleteStateSummaryInput): AthleteStateSummary {
  const asOfDate = new Date().toISOString().slice(0, 10);
  const trainingLoad = assessTrainingLoad(recentWorkouts);
  const injuryRisk = assessInjuryRisk(profile, memories, recentWorkouts);
  const goalProgress = assessGoalProgress(goals, trainingLoad, asOfDate);

  return {
    athleteName: profile.displayName,
    asOfDate,
    trainingLoad,
    injuryRisk,
    goalProgress,
    coachPriorities: deriveCoachPriorities(goalProgress, injuryRisk, trainingLoad, profile),
    memoryHighlights: memories.map((m) => `${m.title}: ${m.detail}`),
  };
}

function deriveCoachPriorities(
  goalProgress: GoalProgress[],
  injuryRisk: InjuryRiskAssessment,
  load: TrainingLoad,
  profile: AthleteProfile,
): string[] {
  const priorities: string[] = [];

  if (injuryRisk.level === "high") {
    priorities.push("Injury risk is high — address recovery before adding any load.");
  } else if (injuryRisk.level === "moderate") {
    priorities.push(
      "Moderate injury risk — review active flags before scheduling tempo or interval work.",
    );
  }

  const atRisk = goalProgress.filter((g) => g.readiness === "at-risk");
  if (atRisk.length > 0) {
    priorities.push(
      `Goal(s) at risk: ${atRisk.map((g) => g.goalName).join(", ")}. Review training direction.`,
    );
  }

  const needsAttention = goalProgress.filter((g) => g.readiness === "needs-attention");
  if (needsAttention.length > 0 && atRisk.length === 0) {
    priorities.push(`Goal(s) need attention: ${needsAttention.map((g) => g.goalName).join(", ")}.`);
  }

  if (load.hardSessionCount >= 3 && priorities.length < 3) {
    priorities.push("Multiple hard sessions this period — recovery quality matters.");
  }

  const primaryGoal = goalProgress.find((g) => g.priority === "A");
  if (primaryGoal && priorities.length < 3) {
    priorities.push(
      `Primary goal "${primaryGoal.goalName}" — ${daysLabel(primaryGoal.daysUntilTarget)}.`,
    );
  }

  if (profile.constraints.length > 0 && priorities.length < 3) {
    priorities.push(`Respect constraint: ${profile.constraints[0]}.`);
  }

  return priorities.slice(0, 3);
}

function daysLabel(days: number | null): string {
  if (days === null) return "no target date set";
  if (days < 0) return "target date has passed";
  if (days === 0) return "target date is today";
  return `${days} day(s) remaining`;
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
