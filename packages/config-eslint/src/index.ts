import type { Linter } from 'eslint';

const config: Linter.Config = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  env: {
    browser: true,
    node: true,
    es6: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'plugin:unicorn/recommended',
    'prettier',
  ],
  plugins: ['@typescript-eslint', 'import', 'unicorn', 'unused-imports'],
  rules: {
    '@typescript-eslint/no-unused-vars': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/ban-ts-comment': 'off',
    '@typescript-eslint/no-var-requires': 'off',

    'no-console': 'error',
    'no-unused-vars': 'off',
    'no-case-declarations': 'off',
    'prefer-const': 'error',
    camelcase: ['error', { properties: 'always' }],

    'import/order': [
      'error',
      {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
        'newlines-between': 'always',
        alphabetize: {
          order: 'asc',
          caseInsensitive: true,
        },
      },
    ],
    'import/no-unresolved': 'error',

    // Unicorn rules (from parcel)
    'unicorn/no-array-reduce': 'off',
    'unicorn/prefer-node-protocol': 'off',
    'unicorn/no-null': 'off',
    'unicorn/no-nested-ternary': 'off',
    'unicorn/filename-case': ['error', { case: 'kebabCase' }],
    'unicorn/import-style': ['error', { styles: { path: false } }],
    'unicorn/prefer-module': 'off',
    'unicorn/prefer-top-level-await': 'off',
    'unicorn/no-await-expression-member': 'warn',
    'unicorn/prevent-abbreviations': [
      'error',
      {
        replacements: {
          ref: false,
          props: false,
          prop: false,
          dev: false,
          doc: false,
          docs: false,
          def: false,
          params: false,
          req: false,
          res: false,
          iOS: false,
          env: false,
          args: false,
          mod: false,
        },
      },
    ],

    // Unused imports (from parcel)
    'unused-imports/no-unused-imports': 'error',
    'unused-imports/no-unused-vars': [
      'warn',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      },
    ],
  },
  settings: {
    'import/resolver': {
      typescript: {
        alwaysTryTypes: true,
      },
    },
  },
};

export default config;
