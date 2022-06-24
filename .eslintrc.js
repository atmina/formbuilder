module.exports = {
  env: {
    browser: true,
    es6: true,
    jest: true,
  },
  extends: ["standard-with-typescript", "prettier"],
  globals: {
    Atomics: "readonly",
    SharedArrayBuffer: "readonly",
  },
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: 2020,
    sourceType: "module",
    project: "tsconfig.json",
  },
  plugins: ["react", "prettier"],
  rules: {
    "react/jsx-uses-react": "error",
    "react/jsx-uses-vars": "error",
    "prettier/prettier": ["error"],
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/array-type": "off",
    "@typescript-eslint/prefer-function-type": "off",
    "@typescript-eslint/method-signature-style": "off",
  },
};
