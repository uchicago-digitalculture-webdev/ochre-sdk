import type { KnipConfig } from "knip";

const config: KnipConfig = {
  ignoreIssues: { ".github/**/*.yml": ["binaries"] },
};

export default config;
