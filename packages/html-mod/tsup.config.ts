import { defineConfig } from 'tsup';

import baseConfig from '../../tsup.config';

export default defineConfig({
  ...baseConfig,
  entry: [
    'src/index.ts',
    'src/ast-updater.ts',
    'src/ast-manipulator.ts',
    'src/position-delta.ts',
    'src/experimental/index.ts',
    'src/benchmark.ts',
  ],
});
