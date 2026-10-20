import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    include: ["**/*.test.ts"],
    exclude: ["node_modules", ".next", "e2e"],
    testTimeout: 20_000,
  },
});
