import type { Config } from 'prettier';

const config: Config = {
  semi: true,
  trailingComma: 'es5',
  singleQuote: true,
  printWidth: 120,
  tabWidth: 2,
  useTabs: false,
  bracketSpacing: true,
  bracketSameLine: false,
  arrowParens: 'avoid',
  endOfLine: 'lf',
  overrides: [
    {
      files: ['*.{js,ts,gts,jsx,tsx}', '.*.{js,ts,gts,jsx,tsx}'],
      options: {
        singleQuote: true,
      },
    },
    {
      files: ['*.{hbs,handlebars}'],
      options: {
        singleQuote: false,
      },
    },
  ],
};

module.exports = config;
