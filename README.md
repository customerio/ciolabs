# Customer.io Open Source

Open source libraries and configurations used at [Customer.io](https://customer.io).

## Packages

- [@ciolabs/config-eslint](./packages/config-eslint) - Shared ESLint configuration for Customer.io projects
- [@ciolabs/config-prettier](./packages/config-prettier) - Shared Prettier configuration for Customer.io projects
- [@ciolabs/html-find-conditional-comments](./packages/html-find-conditional-comments) - Finds all conditional comments in a string
- [@ciolabs/html-preserve-comment-whitespace](./packages/html-preserve-comment-whitespace) - Preserves the presence or lack thereof of whitespace surrounding HTML comments
- [@ciolabs/html-process-conditional-comments](./packages/html-process-conditional-comments) - Makes it easy to safely process HTML inside of conditional comments
- [@ciolabs/htmlparser2-source](./packages/htmlparser2-source) - A wrapper around htmlparser2 that adds source range information to the AST
- [@ciolabs/html-mod](./packages/html-mod) - Manipulate HTML strings with a Browser-like API

## Development

This monorepo uses pnpm workspaces for managing multiple packages. pnpm provides better dependency resolution, faster installs, and automatic build ordering based on package dependencies.

### Setup

```bash
pnpm install
```

> **Note**: This project requires pnpm >= 10.0.0. If you don't have pnpm installed, you can install it with `npm install -g pnpm` or use Corepack: `corepack enable`.

### Available Scripts

```bash
pnpm run lint          # Lint all packages
pnpm run lint:fix      # Lint and auto-fix issues
pnpm run format        # Format all files with Prettier
pnpm run format:check  # Check formatting without changes
pnpm run typecheck     # Type check all packages
pnpm run build         # Build all packages (in dependency order)
pnpm run test          # Run tests for all packages
pnpm run clean         # Clean build artifacts
```

### Releases & Publishing

This project uses [Changeset](https://github.com/changesets/changesets) for version management and publishing.

#### Creating a changeset

When you make changes that should be released:

```bash
pnpm run changeset
```

This will prompt you to:

- Select which packages have changed
- Choose the type of change (major, minor, patch)
- Write a summary of the changes

#### Publishing releases

Once you've created changesets, the release process is automated:

1. **Changeset creates a release PR** automatically with version bumps and changelog
2. **Review and merge the release PR** - this triggers the GitHub Action
3. **Packages are automatically published** to npm with GitHub releases created

### Pre-commit Hooks

This repository uses Husky and lint-staged to automatically lint and format changed files before each commit.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Ensure all tests pass and code is properly formatted
5. Create a changeset: `pnpm run changeset`
6. Submit a pull request

## License

MIT License - see [LICENSE](./LICENSE) file for details.

---

Made with ❤️ by the team at Customer.io
