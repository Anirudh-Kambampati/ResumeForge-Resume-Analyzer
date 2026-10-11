import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emits a self-contained server in .next/standalone for the Docker image.
  // Vercel ignores this and deploys as usual.
  output: "standalone",
};

export default nextConfig;
