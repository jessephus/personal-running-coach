import { NextResponse } from "next/server";

import { demoDeferredFeatures } from "@personal-running-coach/coach-core";
import { integrationStatusCards } from "@personal-running-coach/integrations";

import { getEnvironmentStatus } from "@/lib/server-config";

export function GET() {
  return NextResponse.json({
    integrations: integrationStatusCards,
    environment: getEnvironmentStatus(),
    deferredFeatures: demoDeferredFeatures.map((feature) => ({
      slug: feature.slug,
      title: feature.title,
      whyDeferred: feature.whyDeferred,
    })),
  });
}
