import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // pnpm monorepo: trace server files from the workspace root.
  outputFileTracingRoot: path.join(__dirname, "../.."),
};

export default nextConfig;
