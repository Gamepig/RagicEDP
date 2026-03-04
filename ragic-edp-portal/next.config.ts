import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  // Workaround for Next.js 15 + pnpm vendored chunks occasionally missing for certain packages.
  // See error: Cannot find module './vendor-chunks/next-themes@...js'
  transpilePackages: ["next-themes"],
  env: {
    NEXT_PUBLIC_APP_VERSION: `v0.2.2-${(process.env.SHORT_SHA ?? process.env.COMMIT_SHA?.slice(0, 7) ?? "dev")}`,
  },
};

export default nextConfig;
