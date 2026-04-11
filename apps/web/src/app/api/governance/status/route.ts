// ---------------------------------------------------------------------------
// GET /api/governance/status
//
// Returns the governance posture summary: retention policies, audit coverage,
// prompt privacy flag count, and available deletion scopes.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";

import { buildGovernanceSummary } from "@coachinclaw/coach-core";

export function GET() {
  return NextResponse.json(buildGovernanceSummary());
}
