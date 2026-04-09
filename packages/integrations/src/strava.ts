export type StravaAuthorizationInput = {
  clientId: string;
  redirectUri: string;
  state: string;
};

export function buildStravaAuthorizationUrl({
  clientId,
  redirectUri,
  state,
}: StravaAuthorizationInput) {
  const search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    approval_prompt: "auto",
    scope: "read,activity:read",
    state,
  });

  return `https://www.strava.com/oauth/authorize?${search.toString()}`;
}

export const stravaEnvironmentKeys = [
  "STRAVA_CLIENT_ID",
  "STRAVA_CLIENT_SECRET",
  "STRAVA_REDIRECT_URI",
] as const;
