// ---------------------------------------------------------------------------
// GET /api/governance/audit-summary?athleteId=...
//
// Returns an audit event summary for the given athlete: total counts,
// breakdown by action, and the most recent events.
// ---------------------------------------------------------------------------

import { NextResponse, type NextRequest } from "next/server";

import { buildAuditSummary } from "@/lib/governance";

export async function GET(request: NextRequest) {
  const athleteId = request.nextUrl.searchParams.get("athleteId");

  if (!athleteId) {
    return NextResponse.json(
      { error: "athleteId query parameter is required." },
      { status: 400 },
    );
  }

  try {
    const summary = await buildAuditSummary(athleteId);
    return NextResponse.json(summary);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Audit summary failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
