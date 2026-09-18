import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      // More specific aliases must precede the "@" prefix alias.
      "@/lib/utils": fileURLToPath(
        new URL("./shared/lib/utils/core/utils.ts", import.meta.url)
      ),
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
