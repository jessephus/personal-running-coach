import { NextResponse } from "next/server";
import { generateCoachingWorkflowForAthlete } from "@personal-running-coach/db";

export async function GET() {
  const generated = await generateCoachingWorkflowForAthlete({
    workflow: "weekly-review",
  });

  return NextResponse.json(generated.result);
}
