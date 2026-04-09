// ---------------------------------------------------------------------------
// GET /api/governance/status
//
// Returns the governance posture summary: retention policies, audit coverage,
// prompt privacy flag count, and available deletion scopes.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";

import { buildGovernanceSummary } from "@personal-running-coach/coach-core";

export function GET() {
  return NextResponse.json(buildGovernanceSummary());
}
