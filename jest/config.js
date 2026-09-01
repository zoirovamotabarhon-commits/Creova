module.exports = {
  rootDir: "..",

  preset: "jest-expo",

  testMatch: [
    "<rootDir>/__tests__/**/*.[jt]s?(x)",
    "<rootDir>/?(*.)+(spec|test).[jt]s?(x)"
  ],

  testPathIgnorePatterns: [
    "/node_modules/"
  ]
};
