import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import prettier from "eslint-plugin-prettier/recommended";

const eslintConfig = defineConfig([
  ...nextVitals,
  prettier,
  // Override default ignores of eslint-config-next
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "node_modules/**",
    "convex/_generated/**",
  ]),
  {
    rules: {
      "no-console": ["error", { allow: ["warn", "error", "info"] }],
    },
  },
  {
    files: ["shared/lib/logger.ts"],
    rules: {
      "no-console": "off",
    },
  },
  {
    files: ["convex/**/*.ts"],
    ignores: ["convex/lib/functionBuilders.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "./_generated/server",
              importNames: [
                "query",
                "mutation",
                "internalQuery",
                "internalMutation",
                "action",
                "internalAction",
              ],
              message:
                "Import shared Convex builders from `./lib/functionBuilders` instead.",
            },
            {
              name: "../_generated/server",
              importNames: [
                "query",
                "mutation",
                "internalQuery",
                "internalMutation",
                "action",
                "internalAction",
              ],
              message:
                "Import shared Convex builders from `../lib/functionBuilders` instead.",
            },
            {
              name: "../../_generated/server",
              importNames: [
                "query",
                "mutation",
                "internalQuery",
                "internalMutation",
                "action",
                "internalAction",
              ],
              message:
                "Import shared Convex builders from `../../lib/functionBuilders` instead.",
            },
            {
              name: "../../../_generated/server",
              importNames: [
                "query",
                "mutation",
                "internalQuery",
                "internalMutation",
                "action",
                "internalAction",
              ],
              message:
                "Import shared Convex builders from the nearest `lib/functionBuilders` module instead.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
