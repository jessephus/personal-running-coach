import { NextResponse } from "next/server";
import {
  buildAthleteStateSummary,
  demoAthleteProfile,
  demoCompletedWorkouts,
  demoGoals,
  demoMemories,
  generatePostWorkoutDebrief,
} from "@personal-running-coach/coach-core";

export function GET() {
  const stateSummary = buildAthleteStateSummary({
    profile: demoAthleteProfile,
    goals: demoGoals,
    memories: demoMemories,
    recentWorkouts: demoCompletedWorkouts,
  });

  const latestWorkout = [...demoCompletedWorkouts].sort((a, b) =>
    b.date.localeCompare(a.date),
  )[0];

  if (!latestWorkout) {
    return NextResponse.json(
      { error: "No workouts available for debrief." },
      { status: 404 },
    );
  }

  const result = generatePostWorkoutDebrief({
    workout: latestWorkout,
    stateSummary,
    profile: demoAthleteProfile,
  });

  return NextResponse.json(result);
}
