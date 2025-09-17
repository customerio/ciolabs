# Standardize Package Naming Conventions

## Summary

- Standardized package naming conventions across the monorepo for better organization and consistency
- Config packages now use `config-*` prefix
- HTML utility packages now use `html-*` prefix
- Updated all cross-package references and imports
- Maintained backward compatibility through proper package exports

## Package Renames

### Config Packages

- `eslint-config` → `config-eslint`
- `prettier-config` → `config-prettier`

### HTML Utility Packages

- `source-htmlparser2` → `htmlparser2-source`
- `magic-html` → `html-mod` (with class renames: `MagicHtml` → `HtmlMod`, `MagicElement` → `HtmlModElement`)
- `find-conditional-comments` → `html-find-conditional-comments`
- `preserve-comment-whitespace` → `html-preserve-comment-whitespace`
- `process-conditional-comments` → `html-process-conditional-comments`

## Updated References

- Updated all `package.json` files with new package names
- Updated all import statements across packages
- Updated README documentation to reflect new naming
- Rebuilt all packages with updated configurations
- Fixed ESLint configuration resolution for monorepo setup

## Test Plan

- [ ] All packages build successfully with `pnpm run build`
- [ ] All inter-package imports resolve correctly
- [ ] ESLint and Prettier configurations work with new package names
- [ ] Documentation reflects new package names
- [ ] Workspace dependencies resolve properly

🤖 Generated with [Claude Code](https://claude.ai/code)
