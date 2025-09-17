import type { Linter } from 'eslint';

const config: Linter.Config = {
  extends: ['@ciolabs/config-eslint'],
  env: {
    node: true,
    browser: false,
  },
  rules: {
    'no-console': 'off',
    '@typescript-eslint/no-var-requires': 'off',
  },
};

module.exports = config;
