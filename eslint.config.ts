import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";

export default defineConfig({
  files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
  plugins: { js },
  extends: [
    js.configs.recommended,
    tseslint.configs.recommendedTypeChecked,
  ],
  languageOptions: {
    globals: globals.node,
    parserOptions: {
      projectService: true
    }
  },
  rules: {
    "@typescript-eslint/no-unsafe-type-assertion": "error",
    "no-magic-numbers": ["error", { ignore: [0, 1] }],
    "semi": "error",
    "no-console": "error"
  },
});
