# @ciolabs/config-eslint

Shared ESLint configuration for Customer.io projects.

## Installation

### Base Dependencies

```bash
npm install --save-dev @ciolabs/config-eslint eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser eslint-config-prettier eslint-plugin-import eslint-plugin-unicorn eslint-plugin-unused-imports eslint-import-resolver-typescript
```

### Additional Dependencies for React

```bash
npm install --save-dev eslint-plugin-react eslint-plugin-react-hooks eslint-plugin-jsx-a11y
```

### Additional Dependencies for Ember

```bash
npm install --save-dev eslint-plugin-ember
```

## Usage

### Base TypeScript Configuration

In your `.eslintrc.js`:

```js
module.exports = {
  extends: ['@ciolabs/config-eslint'],
};
```

Or using ESM in `eslint.config.js`:

```js
import config from '@ciolabs/config-eslint';

export default [config];
```

### React Configuration

For React projects:

```js
module.exports = {
  extends: ['@ciolabs/config-eslint/react'],
};
```

### Ember Configuration

For Ember projects:

```js
module.exports = {
  extends: ['@ciolabs/config-eslint/ember'],
};
```

### Node.js Configuration

For Node.js projects:

```js
module.exports = {
  extends: ['@ciolabs/config-eslint/node'],
};
```

## What's Included

- **TypeScript support** with strict rules and modern patterns
- **Import/export linting** with automatic organization and unused import cleanup
- **Prettier integration** for consistent formatting
- **Unicorn plugin** for modern JavaScript best practices
- **React and JSX support** with hooks and accessibility rules (in React config)
- **Ember support** with template tags and Glimmer components (in Ember config)
- **Node.js optimizations** with relaxed console and require rules (in Node config)

## TypeScript Support

This package is built with TypeScript and provides full type definitions. You'll get IntelliSense and type checking when configuring ESLint rules.
