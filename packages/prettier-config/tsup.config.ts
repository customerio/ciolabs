import { defineConfig } from 'tsup';

import baseConfig from '../../tsup.config.js';

export default defineConfig({
  ...baseConfig,
  entry: ['src/index.ts'],
});
