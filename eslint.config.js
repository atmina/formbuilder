/**
 * @type {import('eslint').Linter.FlatConfig[]}
 */
module.exports = [
  ...require('@atmina/linting/eslint/recommended'),
  require('@atmina/linting/eslint/react'),
];
