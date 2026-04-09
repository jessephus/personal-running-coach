// ---------------------------------------------------------------------------
// POST /api/governance/prune
//
// Executes retention-based pruning for the given athlete. Deletes rows older
// than the retention cutoff defined in each table's retention policy.
//
// Body: { athleteId: string }
// ---------------------------------------------------------------------------

import { NextResponse, type NextRequest } from "next/server";

import { pruneExpiredData } from "@/lib/governance";

export async function POST(request: NextRequest) {
  let body: { athleteId?: string };
  try {
    body = (await request.json()) as { athleteId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.athleteId) {
    return NextResponse.json(
      { error: "athleteId is required." },
      { status: 400 },
    );
  }

  try {
    const result = await pruneExpiredData(body.athleteId);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Pruning failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
