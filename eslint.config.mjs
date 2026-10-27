import js from "@eslint/js"
import prettier from "eslint-config-prettier"
import unusedImports from "eslint-plugin-unused-imports"
import tseslint from "typescript-eslint"

export default tseslint.config(
    { ignores: ["dist", "coverage", "node_modules"] },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    prettier,
    {
        plugins: { "unused-imports": unusedImports },
        rules: {
            "@typescript-eslint/no-unused-vars": "off",
            "unused-imports/no-unused-imports": "error",
            "unused-imports/no-unused-vars": [
                "warn",
                { vars: "all", varsIgnorePattern: "^_", args: "after-used", argsIgnorePattern: "^_" },
            ],
        },
    }
)
