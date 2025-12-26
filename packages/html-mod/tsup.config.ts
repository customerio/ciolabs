import { defineConfig } from 'tsup';

import baseConfig from '../../tsup.config';

export default defineConfig({
  ...baseConfig,
  entry: [
    'src/index.ts',
    'src/experimental/index.ts',
    'src/experimental/ast-updater.ts',
    'src/experimental/ast-manipulator.ts',
    'src/experimental/position-delta.ts',
    'src/benchmark.ts',
  ],
});
