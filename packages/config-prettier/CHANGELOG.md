# @ciolabs/config-prettier

## 0.0.2

### Patch Changes

- [#28](https://github.com/customerio/ciolabs/pull/28) [`273de45`](https://github.com/customerio/ciolabs/commit/273de45c3d9e3156464c36d41a771494a35599fb) Thanks [@avigoldman](https://github.com/avigoldman)! - Remove Prettier import sorting plugin to resolve conflict with ESLint import/order rule

  ## Changes
  - Removed `@trivago/prettier-plugin-sort-imports` plugin
  - Removed `importOrder` and `importOrderSeparation` configuration
  - ESLint's `import/order` rule now handles all import organization
  - Fixes conflict where Prettier and ESLint were fighting over import formatting

  This allows both tools to work together harmoniously without conflicting changes.

## 0.0.1

### Patch Changes

- [#11](https://github.com/customerio/ciolabs/pull/11) [`712c657`](https://github.com/customerio/ciolabs/commit/712c657909b6f9dddf6e79cc0bd2d6c1978cb110) Thanks [@avigoldman](https://github.com/avigoldman)! - Update license
