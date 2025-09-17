# @ciolabs/prettier-config

Shared Prettier configuration for Customer.io projects.

## Installation

```bash
npm install --save-dev @ciolabs/prettier-config prettier
```

## Usage

In your `package.json`:

```json
{
  "prettier": "@ciolabs/prettier-config"
}
```

Or create a `.prettierrc.js`:

```js
module.exports = require('@ciolabs/prettier-config');
```

Or using ESM:

```js
import config from '@ciolabs/prettier-config';

export default config;
```

## Configuration

- **Semi-colons**: enabled
- **Single quotes**: enabled for JavaScript/TypeScript
- **Trailing commas**: ES5
- **Print width**: 120 characters (aligned with Customer.io codebases)
- **Tab width**: 2 spaces
- **Arrow parens**: avoid when possible
- **End of line**: LF
- **Import sorting**: automatic with `@trivago/prettier-plugin-sort-imports`

## File-Specific Overrides

- **JavaScript/TypeScript files**: Single quotes
- **Handlebars/Ember templates**: Double quotes
- **Import organization**: Relative imports grouped last

## TypeScript Support

This package is built with TypeScript and provides full type definitions for Prettier configuration options.
