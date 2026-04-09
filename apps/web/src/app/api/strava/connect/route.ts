import { NextResponse } from "next/server";

import { buildStravaAuthorizationUrl } from "@personal-running-coach/integrations";

import { getServerConfig } from "@/lib/server-config";

export function GET() {
  const config = getServerConfig();

  if (!config.stravaClientId) {
    return NextResponse.json(
      {
        error: "Missing STRAVA_CLIENT_ID",
        message:
          "Set STRAVA_CLIENT_ID in your environment before trying the Strava connect flow.",
      },
      { status: 400 },
    );
  }

  const redirectUri = `${config.appUrl}/api/strava/callback`;
  const authorizationUrl = buildStravaAuthorizationUrl({
    clientId: config.stravaClientId,
    redirectUri,
    state: "coach-connect-preview",
  });

  return NextResponse.redirect(authorizationUrl);
}
