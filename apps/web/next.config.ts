import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@coachinclaw/coach-core",
    "@coachinclaw/db",
    "@coachinclaw/integrations",
  ],
};

export default nextConfig;
