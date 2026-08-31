import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    environment: "edge-runtime",
    setupFiles: ["./test/convex.setup.ts"],
    include: [
      "convex/**/*.test.ts",
      "features/**/*.test.ts",
      "features/**/*.test.tsx",
      "shared/**/*.test.ts",
    ],
  },
});
