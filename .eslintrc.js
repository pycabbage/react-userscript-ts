/** @type {import("@typescript-eslint/utils").TSESLint.Linter.Config } */
module.exports = {
  env: {
    browser: true,
    es2021: true,
  },
  extends: [
    "plugin:react/recommended",
    "plugin:userscripts/recommended",
    "standard-with-typescript",
  ],
  overrides: [],
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  plugins: ["react"],
  rules: {},
  ignorePatterns: [
    ".eslintrc.js",
    "node_modules/**/*",
    "dist/**/*",
  ],
};
