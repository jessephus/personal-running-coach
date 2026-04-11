import { NextResponse } from "next/server";
import { generateCoachingWorkflowForAthlete } from "@personal-running-coach/db";

export async function GET() {
  const generated = await generateCoachingWorkflowForAthlete({
    workflow: "next-workout-suggestion",
  });

  return NextResponse.json(generated.result);
}
