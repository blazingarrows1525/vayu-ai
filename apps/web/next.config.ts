import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Transpile the shared TS source packages from the monorepo.
  transpilePackages: ["@vayu/db"],
  // Typed links/routes (promoted out of `experimental` in Next 16).
  typedRoutes: true,
};

export default nextConfig;
