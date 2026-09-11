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
      ". core/**",
    ],
  },
  {
    files: ["scripts/**/*.js"],
    languageOptions: {
      sourceType: "commonjs",
      globals: {
        __dirname: "readonly",
        __filename: "readonly",
        require: "readonly",
        module: "writable",
        exports: "writable",
        process: "readonly",
        console: "readonly",
      },
    },
  },
];
