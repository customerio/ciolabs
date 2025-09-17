import type { Linter } from 'eslint';

import baseConfig from './index';

const config: Linter.Config = {
  ...baseConfig,
  extends: [...(baseConfig.extends || []), 'plugin:ember/recommended'],
  plugins: [...(baseConfig.plugins || []), 'ember'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ...baseConfig.parserOptions,
    project: ['./tsconfig.eslint.json'],
    ecmaFeatures: {
      ...baseConfig.parserOptions?.ecmaFeatures,
      jsx: true,
    },
  },
  rules: {
    // Ember-specific rules (from ui repo)
    'ember/no-array-prototype-extensions': ['error'],
    'ember/use-ember-data-rfc-395-imports': ['off'],
    'ember/no-computed-properties-in-native-classes': ['off'],
    'ember/no-empty-glimmer-component-classes': ['off'],
    'ember/no-component-lifecycle-hooks': ['off'],
    'ember/require-tagless-components': ['off'],
    'ember/require-computed-property-dependencies': ['off'],
    'ember/classic-decorator-hooks': ['off'],
    'ember/classic-decorator-no-classic-methods': ['off'],
    'ember/no-assignment-of-untracked-properties-used-in-tracking-contexts': ['off'],
    'ember/no-controller-access-in-routes': ['off'],
    'ember/no-shadow-route-definition': ['off'],
    'ember/no-side-effects': ['off'],

    ...baseConfig.rules,
    // Override base rules for Ember
    'unicorn/filename-case': 'off', // Ember has different naming conventions
  },
  overrides: [
    {
      files: ['**/*.{gts,gjs}'],
      parser: 'ember-eslint-parser',
      extends: ['plugin:ember/recommended-gts'],
    },
    {
      files: ['tests/**/*.{js,ts,gts}'],
      extends: ['plugin:qunit/recommended'],
      rules: {
        'qunit/require-expect': ['off'],
      },
    },
  ],
};

module.exports = config;
