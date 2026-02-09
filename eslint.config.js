import antfu from "@antfu/eslint-config";

export default antfu({
  stylistic: false,
  markdown: false,
  node: true,
  typescript: {
    parserOptions: {
      tsconfigRootDir: import.meta.dirname,
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
      "ts/await-thenable": "error",
    },
  },
  unicorn: {
    allRecommended: true,
    overrides: {
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
    },
  },
  imports: {
    overrides: {
      "perfectionist/sort-imports": [
        "error",
        {
          tsconfig: { rootDir: import.meta.dirname, filename: "tsconfig.json" },
          newlinesBetween: 0,
          order: "asc",
          type: "natural",
        },
      ],
    },
  },
  rules: {
    "no-console": ["warn"],
    "antfu/no-top-level-await": ["off"],
    "node/prefer-global/process": ["off"],
    "node/no-process-env": ["error"],
    "jsonc/sort-keys": "off",
    "pnpm/json-enforce-catalog": "off",
    "pnpm/yaml-enforce-settings": "off",
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
  },
});
