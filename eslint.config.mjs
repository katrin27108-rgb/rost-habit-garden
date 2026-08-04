import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated output, local tooling state, QA captures and vendored browser
    // assets are not authored TypeScript sources. In particular, public/
    // contains minified Babylon.js runtime files that must not be linted.
    ".vinext/**",
    ".wrangler/**",
    ".pnpm-store/**",
    "dist/**",
    "outputs/**",
    "work/**",
    "artifacts/**",
    "public/**",
  ]),
  {
    files: ["app/**/*.{ts,tsx}"],
    // Existing visual prototypes predate the strict React 19/TypeScript
    // baseline. Keep their debt visible without blocking repository CI; new
    // work should avoid adding warnings and can tighten these rules per area.
    rules: {
      "@next/next/no-html-link-for-pages": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "prefer-const": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;
