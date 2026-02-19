---
'@ciolabs/html-mod': major
---

Promote experimental auto-flush implementation to be the default.

### Breaking changes

- `flush()` and `isFlushed()` removed — the AST is always kept in sync automatically
- `__ensureFlushed()` removed
- `__flushed` property removed
- `generateMap()` / `generateDecodedMap()` removed (source map generation via MagicString)
- `trim(charType)` / `trimStart(charType)` / `trimEnd(charType)` no longer accept a char type parameter
- `__s` (MagicString instance) no longer exists — use `__source` and `__overwrite()` instead
- `removeAttribute()` now cleans up extra whitespace instead of leaving gaps
- `magic-string` is no longer a dependency

### Migration

If you were importing from `@ciolabs/html-mod/experimental`, you can now import from `@ciolabs/html-mod` directly. The `./experimental` export still works but is deprecated.
