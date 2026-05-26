import { defineConfig } from "tsdown/config";

export default defineConfig({
  entry: ["src/**/*.ts", "!src/**/*.test.ts"],
  format: "esm",
  outDir: "dist",
  root: "src",
  unbundle: true,
  dts: true,
  deps: { skipNodeModulesBundle: true },
  treeshake: true,
});
