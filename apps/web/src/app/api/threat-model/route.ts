import { NextResponse } from "next/server";

import { buildThreatModelSummary } from "@coachinclaw/coach-core";

export function GET() {
  return NextResponse.json(buildThreatModelSummary());
}
