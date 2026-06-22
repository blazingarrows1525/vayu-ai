import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Transpile the shared TS source packages from the monorepo.
  transpilePackages: ["@vayu/db", "@vayu/editor"],
  // Typed links/routes (promoted out of `experimental` in Next 16).
  typedRoutes: true,
  // Standalone output for a small Docker runtime image; trace deps from repo root.
  output: "standalone",
  outputFileTracingRoot: path.join(import.meta.dirname, "../../"),
};

export default nextConfig;
