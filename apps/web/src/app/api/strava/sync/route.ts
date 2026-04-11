import { NextRequest, NextResponse } from "next/server";

import { StravaApiError } from "@coachinclaw/integrations";

import { runManualStravaSync } from "@/lib/strava-ingestion";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const days = Number(request.nextUrl.searchParams.get("days") ?? "30");
  const pageLimit = Number(request.nextUrl.searchParams.get("pageLimit") ?? "2");

  try {
    const result = await runManualStravaSync({
      days: Number.isFinite(days) ? days : 30,
      pageLimit: Number.isFinite(pageLimit) ? pageLimit : 2,
    });

    return NextResponse.json({
      status: "ok",
      ...result,
    });
  } catch (error) {
    if (error instanceof StravaApiError) {
      return NextResponse.json(
        {
          status: "error",
          message:
            error.status === 429
              ? "Strava rate-limited the sync. Retry later or reduce sync scope."
              : "Strava sync failed.",
          details: error.details,
          rateLimit: error.rateLimit,
        },
        { status: error.status >= 400 && error.status < 600 ? error.status : 502 },
      );
    }

    return NextResponse.json(
      {
        status: "error",
        message: error instanceof Error ? error.message : "Unexpected Strava sync failure.",
      },
      { status: 500 },
    );
  }
}
