import type { Linter } from 'eslint';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const baseConfig = require('./index');

const config: Linter.Config = {
  ...baseConfig,
  env: {
    ...baseConfig.env,
    node: true,
    browser: false,
  },
  rules: {
    ...baseConfig.rules,
    'no-console': 'off',
    '@typescript-eslint/no-var-requires': 'off',
  },
};

module.exports = config;
