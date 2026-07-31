import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["app/AshfallGame.tsx"],
    // The React Compiler diagnostics build a multi-gigabyte whole-component
    // graph for this legacy battle shell and exhaust Node before reporting.
    // Keep the core hooks rules active here; extracted modules receive the
    // complete compiler rule set through the configs above.
    rules: {
      "react-hooks/static-components": "off",
      "react-hooks/use-memo": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/incompatible-library": "off",
      "react-hooks/immutability": "off",
      "react-hooks/globals": "off",
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/error-boundaries": "off",
      "react-hooks/purity": "off",
      "react-hooks/set-state-in-render": "off",
      "react-hooks/unsupported-syntax": "off",
      "react-hooks/config": "off",
      "react-hooks/gating": "off",
    },
  },
  {
    // The service worker runs outside the document: it has no `window`, and its
    // globals come from the ServiceWorkerGlobalScope rather than the DOM lib.
    files: ["public/sw.js"],
    languageOptions: {
      globals: {
        caches: "readonly",
        clients: "readonly",
        fetch: "readonly",
        self: "readonly",
        MessageChannel: "readonly",
        Request: "readonly",
        Response: "readonly",
        URL: "readonly",
      },
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".vinext/**",
    ".wrangler/**",
    "dist/**",
    "out/**",
    "outputs/**",
    "work/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
