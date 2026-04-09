import { NextResponse } from "next/server";

import { getEnvironmentStatus, getServerConfig } from "@/lib/server-config";

export function GET() {
  const config = getServerConfig();

  return NextResponse.json({
    status: "ok",
    appUrl: config.appUrl,
    integrationsConfigured: getEnvironmentStatus().filter((item) => item.configured).length,
    timestamp: new Date().toISOString(),
  });
}
