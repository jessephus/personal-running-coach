// ---------------------------------------------------------------------------
// POST /api/governance/delete
//
// Deletes athlete data according to the specified scope.
//
// Body: { athleteId: string, scope: DeletionScope }
//
// Scopes: "full" | "credentials-only" | "messages-only" | "training-only" | "memories-only"
// ---------------------------------------------------------------------------

import { NextResponse, type NextRequest } from "next/server";

import type { DeletionScope } from "@personal-running-coach/coach-core";

import { deleteAthleteData } from "@/lib/governance";

const VALID_SCOPES: DeletionScope[] = [
  "full",
  "credentials-only",
  "messages-only",
  "training-only",
  "memories-only",
];

export async function POST(request: NextRequest) {
  let body: { athleteId?: string; scope?: string };
  try {
    body = (await request.json()) as { athleteId?: string; scope?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.athleteId) {
    return NextResponse.json(
      { error: "athleteId is required." },
      { status: 400 },
    );
  }

  if (!body.scope || !VALID_SCOPES.includes(body.scope as DeletionScope)) {
    return NextResponse.json(
      {
        error: `scope must be one of: ${VALID_SCOPES.join(", ")}`,
      },
      { status: 400 },
    );
  }

  try {
    const result = await deleteAthleteData(
      body.athleteId,
      body.scope as DeletionScope,
    );
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Deletion failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
