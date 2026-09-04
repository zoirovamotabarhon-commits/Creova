const expoConfig = require("eslint-config-expo/flat");

module.exports = [
  ...expoConfig,
  {
    ignores: [
      ".local/**",
      "supabase/functions/**",
      "node_modules/**",
      ".expo/**",
      "dist/**",
      "build/**",
    ],
  },
];