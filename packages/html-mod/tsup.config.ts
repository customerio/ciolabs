import { defineConfig } from 'tsup';

import baseConfig from '../../tsup.config';

export default defineConfig({
  ...baseConfig,
  entry: [
    'src/index.ts',
    'src/index.experimental.ts',
    'src/ast-updater.experimental.ts',
    'src/ast-manipulator.experimental.ts',
    'src/position-delta.experimental.ts',
    'src/benchmark.ts',
  ],
});
