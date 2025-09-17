import type { Linter } from 'eslint';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const baseConfig = require('./index');

const config: Linter.Config = {
  ...baseConfig,
  extends: [
    ...(baseConfig.extends || []),
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:jsx-a11y/recommended',
  ],
  plugins: [...(baseConfig.plugins || []), 'react', 'react-hooks', 'jsx-a11y'],
  parserOptions: {
    ...baseConfig.parserOptions,
    ecmaFeatures: {
      ...baseConfig.parserOptions?.ecmaFeatures,
      jsx: true,
    },
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
  rules: {
    ...baseConfig.rules,
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    'jsx-a11y/anchor-is-valid': 'off',
  },
};

module.exports = config;
