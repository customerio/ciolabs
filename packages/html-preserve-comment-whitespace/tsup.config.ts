import { defineConfig } from 'tsup';

import baseConfig from '../../tsup.config';

export default defineConfig({
  ...baseConfig,
  entry: ['src/index.ts'],
  noExternal: ['ranges-apply', 'ranges-merge', 'tiny-invariant'],
});
