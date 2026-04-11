import { NextResponse } from "next/server";
import { createDatabaseConnection, generateCoachingWorkflowForAthlete, loadAthleteRuntimeContext } from "@coachinclaw/db";

export async function GET() {
  const connection = createDatabaseConnection();

  try {
    const context = await loadAthleteRuntimeContext(connection.db);
    if (!context?.recentWorkouts.length) {
      return NextResponse.json(
        { error: "No workouts available for debrief." },
        { status: 404 },
      );
    }

    const generated = await generateCoachingWorkflowForAthlete({
      athleteId: context.athleteId,
      workflow: "post-workout-debrief",
    });

    return NextResponse.json(generated.result);
  } finally {
    await connection.close();
  }
}
