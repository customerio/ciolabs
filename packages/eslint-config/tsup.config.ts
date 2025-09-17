import { defineConfig } from 'tsup';

import baseConfig from '../../tsup.config.js';

export default defineConfig({
  ...baseConfig,
  entry: ['src/index.ts', 'src/react.ts', 'src/node.ts', 'src/ember.ts'],
});
