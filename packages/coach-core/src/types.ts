export type GoalPriority = "A" | "B" | "C";

export type AthleteGoal = {
  id: string;
  name: string;
  targetDate: string;
  priority: GoalPriority;
  notes: string;
};

export type AthleteProfile = {
  id: string;
  displayName: string;
  timezone: string;
  preferredLongRunDay: string;
  coachingStyle: "direct" | "supportive";
  constraints: string[];
  injuryFlags: string[];
};

export type CompletedWorkoutType = "easy" | "tempo" | "interval" | "long" | "recovery";

export type CompletedWorkout = {
  id: string;
  date: string;
  type: CompletedWorkoutType;
  distanceKm: number;
  durationMinutes: number;
  perceivedEffort: number;
  summary: string;
  source: "strava";
};

export type CoachMemoryCategory = "goal" | "injury" | "preference" | "pattern";

export type CoachMemory = {
  id: string;
  category: CoachMemoryCategory;
  title: string;
  detail: string;
};

export type DeferredFeatureSpec = {
  slug: string;
  title: string;
  whyDeferred: string;
  futureApproach: string;
  securityNotes: string[];
  acceptanceCriteria: string[];
  openQuestions: string[];
};

export type DashboardState = {
  athleteName: string;
  weeklyDistanceKm: number;
  weeklyDurationMinutes: number;
  currentFocus: string;
  coachPriorities: string[];
  riskFlags: string[];
  memoryHighlights: string[];
  deferredFeatureTitles: string[];
};
