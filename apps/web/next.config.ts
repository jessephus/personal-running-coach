import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@personal-running-coach/coach-core",
    "@personal-running-coach/db",
    "@personal-running-coach/integrations",
  ],
};

export default nextConfig;
