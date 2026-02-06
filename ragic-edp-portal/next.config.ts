import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Workaround for Next.js 15 + pnpm vendored chunks occasionally missing for certain packages.
  // See error: Cannot find module './vendor-chunks/next-themes@...js'
  transpilePackages: ["next-themes"],
};

export default nextConfig;
