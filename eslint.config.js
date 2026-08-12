const expoConfig = require("eslint-config-expo/flat");

module.exports = [
  ...expoConfig,
  {
    ignores: [
      "supabase/functions/**",
      "node_modules/**",
      ".expo/**",
      "dist/**",
      "build/**"
    ]
  }
];
