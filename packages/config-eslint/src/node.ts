import type { Linter } from 'eslint';

import baseConfig from './index';

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
