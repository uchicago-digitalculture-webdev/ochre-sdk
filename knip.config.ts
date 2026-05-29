import type { KnipConfig } from "knip";

const config: KnipConfig = {
  ignoreFiles: ["bumpp.config.ts"],
  ignoreIssues: { ".github/**/*.yml": ["binaries"] },
};

export default config;
