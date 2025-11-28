import { defineConfig } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import eslintConfigPrettier from "eslint-config-prettier/flat";

export default defineConfig([
  ...nextCoreWebVitals,
  ...nextTypescript,
  eslintConfigPrettier,
  {
    rules: {
      "no-console": ["error", { allow: ["warn", "error"] }],
      "react-hooks/set-state-in-effect": "off",
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  {
    files: ["shared/lib/logger.ts"],
    rules: {
      "no-console": "off",
    },
  },
  {
    files: ["emails/**/*.{js,jsx,ts,tsx}"],
    rules: {
      "@next/next/no-page-custom-font": "off",
    },
  },
  {
    files: ["features/linked-accounts/hooks/useLinkedAccounts.ts"],
    rules: {
      "react-hooks/purity": "off",
    },
  },
  {
    files: ["app/(webapp)/search/page.tsx"],
    rules: {
      "react-hooks/refs": "off",
    },
  },
]);
