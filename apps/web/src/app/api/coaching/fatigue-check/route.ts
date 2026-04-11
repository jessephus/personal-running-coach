import { NextResponse } from "next/server";
import { buildAthleteStateSummary, evaluateFatigueCheck } from "@coachinclaw/coach-core";
import {
  createDatabaseConnection,
  generateCoachingWorkflowForAthlete,
  loadAthleteRuntimeContext,
} from "@coachinclaw/db";

export async function GET() {
  const connection = createDatabaseConnection();

  try {
    const context = await loadAthleteRuntimeContext(connection.db);
    if (!context) {
      return NextResponse.json(
        { error: "No athlete profile is available for fatigue review." },
        { status: 404 },
      );
    }

    const stateSummary = buildAthleteStateSummary({
      profile: context.profile,
      goals: context.goals,
      memories: context.memories,
      recentWorkouts: context.recentWorkouts,
    });

    const trigger = evaluateFatigueCheck({
      recentWorkouts: context.recentWorkouts,
      stateSummary,
      profile: context.profile,
    });

    if (!trigger) {
      return NextResponse.json({
        workflow: "fatigue-check",
        status: "not-triggered",
        message: "No fatigue or injury check-in is needed based on current signals.",
      });
    }

    const generated = await generateCoachingWorkflowForAthlete({
      athleteId: context.athleteId,
      workflow: "fatigue-check",
    });

    return NextResponse.json(generated.result);
  } finally {
    await connection.close();
  }
}
