import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  cacheComponents: true,
  // forbidden() answers a CEO's write with 403 (ADR-0006).
  experimental: { authInterrupts: true },
};

export default nextConfig;
