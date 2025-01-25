import antfu from "@antfu/eslint-config";
import pluginUnused from "eslint-plugin-unused-imports";

export default function createConfig(options, ...userConfigs) {
  return antfu(
    {
      stylistic: false,
      plugins: {
        "unused-imports": pluginUnused,
      },
      markdown: false,
      typescript: {
        parserOptions: {
          tsconfigRootDir: import.meta.dir,
          project: "tsconfig.json",
        },
        overrides: {
          "ts/no-explicit-any": "error",
          "ts/no-dynamic-delete": "error",
          "ts/no-array-delete": "error",
          "ts/array-type": ["error", { default: "generic" }],
          "ts/consistent-indexed-object-style": ["error", "record"],
          "ts/no-duplicate-type-constituents": "error",
          "ts/no-inferrable-types": "error",
          "ts/no-redundant-type-constituents": "error",
          "ts/no-unnecessary-boolean-literal-compare": "error",
          "ts/no-unnecessary-condition": "error",
          "ts/no-unsafe-argument": "error",
          "ts/no-unsafe-assignment": "error",
          "ts/no-unsafe-call": "error",
          "ts/no-unsafe-member-access": "error",
          "ts/no-unsafe-return": "error",
          "ts/non-nullable-type-assertion-style": "error",
          "ts/consistent-type-definitions": ["error", "type"],
          "ts/prefer-nullish-coalescing": "error",
          "ts/prefer-regexp-exec": "error",
          "ts/prefer-string-starts-ends-with": "error",
          "ts/restrict-plus-operands": "error",
          "ts/use-unknown-in-catch-callback-variable": "error",
          "ts/consistent-type-imports": [
            "warn",
            { prefer: "type-imports", fixStyle: "inline-type-imports" },
          ],
          "ts/no-unused-vars": "off",
          "ts/switch-exhaustiveness-check": [
            "warn",
            { considerDefaultExhaustiveForUnions: true },
          ],
          "ts/prefer-includes": "warn",
          "ts/prefer-optional-chain": "warn",
        },
      },
      unicorn: {
        allRecommended: true,
      },
      ...options,
    },
    {
      rules: {
        "unicorn/filename-case": [
          "error",
          {
            case: "kebabCase",
            ignore: ["README.md", "CONTRIBUTING.md", "CHANGELOG.md", "LICENSE"],
          },
        ],
        "unicorn/better-regex": "error",
        "unicorn/prevent-abbreviations": "off",
        "unicorn/no-nested-ternary": "off",
        "unicorn/no-null": "off",
        "unicorn/no-negated-condition": "off",
        "unicorn/no-thenable": "off",
        "unicorn/prefer-ternary": "off",
        "no-console": ["warn"],
        "antfu/no-top-level-await": ["off"],
        "node/prefer-global/process": ["off"],
        "node/no-process-env": ["error"],
        "jsonc/sort-keys": "off",
        "unused-imports/no-unused-imports": "warn",
        "unused-imports/no-unused-vars": [
          "warn",
          {
            vars: "all",
            varsIgnorePattern: "^_",
            args: "after-used",
            argsIgnorePattern: "^_",
          },
        ],
        "perfectionist/sort-imports": [
          "error",
          {
            groups: [
              "side-effect",
              "type",
              ["internal-type", "parent-type", "sibling-type", "index-type"],
              "builtin",
              "internal",
              "external",
              ["parent", "sibling", "index"],
              "object",
              "unknown",
            ],
            tsconfigRootDir: "tsconfig.json",
            newlinesBetween: "never",
            order: "asc",
            type: "natural",
          },
        ],
      },
    },
    ...userConfigs,
  );
}
