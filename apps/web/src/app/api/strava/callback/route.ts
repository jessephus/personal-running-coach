import { NextRequest, NextResponse } from "next/server";

import {
  verifySignedStravaOAuthState,
  type EnvValidationError,
  StravaApiError,
} from "@coachinclaw/integrations";

import { handleStravaOAuthCallback } from "@/lib/strava-ingestion";

const STRAVA_STATE_COOKIE = "strava_oauth_state";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");
  const state = request.nextUrl.searchParams.get("state");
  const cookieState = request.cookies.get(STRAVA_STATE_COOKIE)?.value;

  if (error) {
    return clearStateCookie(
      NextResponse.json(
        {
          status: "error",
          message: "Strava returned an OAuth error.",
          error,
        },
        { status: 400 },
      ),
    );
  }

  if (!code || !state || !cookieState || state !== cookieState) {
    return clearStateCookie(
      NextResponse.json(
        {
          status: "error",
          message: "Missing or invalid Strava OAuth state.",
        },
        { status: 400 },
      ),
    );
  }

  try {
    verifySignedStravaOAuthState(state, process.env.APP_ENCRYPTION_KEY ?? "");
    const result = await handleStravaOAuthCallback({
      code,
      scope: request.nextUrl.searchParams.get("scope"),
    });

    return clearStateCookie(
      NextResponse.json({
        status: "connected",
        message: "Strava tokens stored and initial activity sync completed.",
        ...result,
      }),
    );
  } catch (error) {
    if (error instanceof StravaApiError) {
      return clearStateCookie(
        NextResponse.json(
          {
            status: "error",
            message:
              error.status === 429
                ? "Strava rate-limited the request. Retry once the rate window resets."
                : "Strava OAuth callback failed.",
            details: error.details,
            rateLimit: error.rateLimit,
          },
          { status: error.status >= 400 && error.status < 600 ? error.status : 502 },
        ),
      );
    }

    const envError = error as EnvValidationError;
    if (envError?.name === "EnvValidationError") {
      return clearStateCookie(
        NextResponse.json(
          {
            status: "error",
            message: envError.message,
            missingKeys: envError.missingKeys,
          },
          { status: 500 },
        ),
      );
    }

    return clearStateCookie(
      NextResponse.json(
        {
          status: "error",
          message: error instanceof Error ? error.message : "Unexpected Strava callback failure.",
        },
        { status: 500 },
      ),
    );
  }
}

function clearStateCookie(response: NextResponse) {
  response.cookies.set({
    name: STRAVA_STATE_COOKIE,
    value: "",
    maxAge: 0,
    path: "/api/strava",
  });

  return response;
}
