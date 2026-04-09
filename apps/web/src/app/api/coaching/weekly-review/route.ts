import { NextResponse } from "next/server";
import {
  buildAthleteStateSummary,
  demoAthleteProfile,
  demoCompletedWorkouts,
  demoGoals,
  demoMemories,
  generateWeeklyReview,
} from "@personal-running-coach/coach-core";

export function GET() {
  const stateSummary = buildAthleteStateSummary({
    profile: demoAthleteProfile,
    goals: demoGoals,
    memories: demoMemories,
    recentWorkouts: demoCompletedWorkouts,
  });

  const result = generateWeeklyReview({
    recentWorkouts: demoCompletedWorkouts,
    stateSummary,
    profile: demoAthleteProfile,
  });

  return NextResponse.json(result);
}
