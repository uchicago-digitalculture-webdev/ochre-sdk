import type { KnipConfig } from "knip";

const config: KnipConfig = {
  ignoreFiles: ["changelogithub.config.ts"],
  ignoreIssues: { ".github/**/*.yml": ["binaries"] },
};

export default config;
