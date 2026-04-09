import { NextRequest, NextResponse } from "next/server";

export function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    return NextResponse.json(
      {
        status: "error",
        message: "Strava returned an OAuth error.",
        error,
      },
      { status: 400 },
    );
  }

  return NextResponse.json({
    status: code ? "received_code" : "missing_code",
    message:
      "The callback route is wired. The next implementation step is exchanging and storing tokens in the secure server-side data layer.",
    codeReceived: Boolean(code),
  });
}
