import { NextResponse } from "next/server";
import {
  buildAthleteStateSummary,
  demoAthleteProfile,
  demoCompletedWorkouts,
  demoGoals,
  demoMemories,
  evaluateFatigueCheck,
} from "@personal-running-coach/coach-core";

export function GET() {
  const stateSummary = buildAthleteStateSummary({
    profile: demoAthleteProfile,
    goals: demoGoals,
    memories: demoMemories,
    recentWorkouts: demoCompletedWorkouts,
  });

  const result = evaluateFatigueCheck({
    recentWorkouts: demoCompletedWorkouts,
    stateSummary,
    profile: demoAthleteProfile,
  });

  if (!result) {
    return NextResponse.json({
      workflow: "fatigue-check",
      status: "not-triggered",
      message: "No fatigue or injury check-in is needed based on current signals.",
    });
  }

  return NextResponse.json(result);
}
