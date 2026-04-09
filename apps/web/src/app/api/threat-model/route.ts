import { NextResponse } from "next/server";

import { buildThreatModelSummary } from "@personal-running-coach/coach-core";

export function GET() {
  return NextResponse.json(buildThreatModelSummary());
}
