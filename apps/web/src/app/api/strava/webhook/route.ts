import { NextRequest, NextResponse } from "next/server";

import { StravaApiError, type StravaWebhookEvent } from "@personal-running-coach/integrations";

import {
  getStravaWebhookVerifyToken,
  processStravaWebhookEvent,
} from "@/lib/strava-ingestion";

export const runtime = "nodejs";

export function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("hub.mode");
  const challenge = request.nextUrl.searchParams.get("hub.challenge");
  const verifyToken = request.nextUrl.searchParams.get("hub.verify_token");
  const expectedToken = getStravaWebhookVerifyToken();

  if (mode !== "subscribe" || !challenge) {
    return NextResponse.json({ error: "Invalid Strava webhook challenge." }, { status: 400 });
  }

  if (!expectedToken || verifyToken !== expectedToken) {
    return NextResponse.json({ error: "Invalid Strava webhook verification token." }, { status: 403 });
  }

  return NextResponse.json({ "hub.challenge": challenge });
}

export async function POST(request: NextRequest) {
  try {
    const event = (await request.json()) as StravaWebhookEvent;
    const result = await processStravaWebhookEvent(event);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof StravaApiError) {
      return NextResponse.json(
        {
          error:
            error.status === 429
              ? "Strava rate-limited webhook processing. Retry via sync after reset."
              : "Failed to fetch Strava activity for webhook processing.",
          details: error.details,
          rateLimit: error.rateLimit,
        },
        { status: error.status >= 400 && error.status < 600 ? error.status : 502 },
      );
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unexpected Strava webhook failure.",
      },
      { status: 500 },
    );
  }
}
