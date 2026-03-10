import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import eslintConfigPrettier from "eslint-config-prettier";

export default tseslint.config(
    { ignores: ["dist/"] },

    // Base JS recommended rules
    js.configs.recommended,

    // TypeScript strict rules for all TS files
    ...tseslint.configs.strict,

    // React hooks rules for webapp files
    {
        files: ["src/webapp/**/*.{ts,tsx}"],
        plugins: {
            "react-hooks": reactHooks,
            "react-refresh": reactRefresh,
        },
        rules: {
            ...reactHooks.configs.recommended.rules,
            "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
            // setState in effects is needed for initialization and sync patterns
            "react-hooks/set-state-in-effect": "off",
        },
    },

    // Disable rules that conflict with Prettier (must be last)
    eslintConfigPrettier,
);
