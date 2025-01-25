/** @type {import('prettier').Config & import('prettier-plugin-tailwindcss').PluginOptions} */
const config = {
  experimentalTernaries: true,
  plugins: ["prettier-plugin-tailwindcss"],
  tailwindFunctions: ["cva", "cn"],
};

export default config;
