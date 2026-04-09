// ---------------------------------------------------------------------------
// POST /api/governance/export
//
// Exports all data for the given athlete as a JSON payload.
// Optionally encrypts the entire export using the APP_ENCRYPTION_KEY.
//
// Body: { athleteId: string, encrypt?: boolean }
// ---------------------------------------------------------------------------

import { NextResponse, type NextRequest } from "next/server";

import { exportAthleteData, encryptExportPayload } from "@/lib/governance";

export async function POST(request: NextRequest) {
  let body: { athleteId?: string; encrypt?: boolean };
  try {
    body = (await request.json()) as { athleteId?: string; encrypt?: boolean };
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
    const exportData = await exportAthleteData(body.athleteId);

    if (body.encrypt) {
      const encrypted = encryptExportPayload(exportData);
      return NextResponse.json({
        encrypted: true,
        ciphertext: encrypted.ciphertext,
        sha256: encrypted.sha256,
        manifest: exportData.manifest,
      });
    }

    return NextResponse.json(exportData);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Export failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
