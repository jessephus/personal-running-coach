import { NextResponse } from "next/server";
import { generateCoachingWorkflowForAthlete } from "@coachinclaw/db";

export async function GET() {
  const generated = await generateCoachingWorkflowForAthlete({
    workflow: "next-workout-suggestion",
  });

  return NextResponse.json(generated.result);
}
