---
'@ciolabs/config-prettier': patch
---

Remove Prettier import sorting plugin to resolve conflict with ESLint import/order rule

## Changes

- Removed `@trivago/prettier-plugin-sort-imports` plugin
- Removed `importOrder` and `importOrderSeparation` configuration
- ESLint's `import/order` rule now handles all import organization
- Fixes conflict where Prettier and ESLint were fighting over import formatting

This allows both tools to work together harmoniously without conflicting changes.
