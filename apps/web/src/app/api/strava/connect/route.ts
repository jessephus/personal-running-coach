import { NextResponse } from "next/server";

import {
  buildStravaAuthorizationUrl,
  createSignedStravaOAuthState,
  createStravaOAuthNonce,
  requireEnvVar,
} from "@coachinclaw/integrations";
import { getResolvedStravaIntegrationConfig } from "@coachinclaw/db";

import { getServerConfig } from "@/lib/server-config";

const STRAVA_STATE_COOKIE = "strava_oauth_state";

export const runtime = "nodejs";

export async function GET() {
  const config = getServerConfig();
  const strava = await getResolvedStravaIntegrationConfig();

  if (!strava.config) {
    return NextResponse.json(
      {
        error: "Missing Strava configuration",
        message:
          "Configure Strava from the Tech Config page before trying the Strava connect flow.",
      },
      { status: 400 },
    );
  }

  const state = createSignedStravaOAuthState(
    {
      issuedAt: Math.floor(Date.now() / 1000),
      nonce: createStravaOAuthNonce(),
    },
    requireEnvVar("APP_ENCRYPTION_KEY"),
  );
  const redirectUri = `${config.appUrl}/api/strava/callback`;
  const authorizationUrl = buildStravaAuthorizationUrl({
    clientId: strava.config.clientId,
    redirectUri,
    state,
  });

  const response = NextResponse.redirect(authorizationUrl);
  response.cookies.set({
    name: STRAVA_STATE_COOKIE,
    value: state,
    httpOnly: true,
    sameSite: "lax",
    secure: redirectUri.startsWith("https://"),
    maxAge: 10 * 60,
    path: "/api/strava",
  });

  return response;
}
