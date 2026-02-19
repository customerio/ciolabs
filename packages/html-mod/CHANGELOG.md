# @ciolabs/html-mod

## 1.0.0

### Major Changes

- [#35](https://github.com/customerio/ciolabs/pull/35) [`4e6a04a`](https://github.com/customerio/ciolabs/commit/4e6a04a0b50b594daeadce23b44d7c3c82d4b9c1) Thanks [@avigoldman](https://github.com/avigoldman)! - Promote experimental auto-flush implementation to be the default.

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

## 0.1.2

### Patch Changes

- [#33](https://github.com/customerio/ciolabs/pull/33) [`0f4b1c7`](https://github.com/customerio/ciolabs/commit/0f4b1c7dd0f535addfd47ce1c3ba776d62c6dbd7) Thanks [@avigoldman](https://github.com/avigoldman)! - Add support for :scope queries on the root of an element

## 0.1.1

### Patch Changes

- [#31](https://github.com/customerio/ciolabs/pull/31) [`de38bfc`](https://github.com/customerio/ciolabs/commit/de38bfcce588ce365d4a89028e27b626435d5234) Thanks [@avigoldman](https://github.com/avigoldman)! - Update experimental version to have same API as standard

## 0.1.0

### Minor Changes

- [#28](https://github.com/customerio/ciolabs/pull/28) [`3f7b86b`](https://github.com/customerio/ciolabs/commit/3f7b86b55dc567aa75cf39c98e3fd41d17c7f194) Thanks [@avigoldman](https://github.com/avigoldman)! - Add experimental auto-flush implementation that eliminates manual `flush()` calls

  ## New Features

  ### Experimental Auto-Flush Implementation
  - **Import path**: `@ciolabs/html-mod/experimental`
  - Automatically synchronizes AST after every modification
  - No manual `flush()` calls required
  - Element references stay valid across modifications
  - 2.16x faster for modify+query patterns (most common in visual editors)

  ### Dataset API (Both Versions)
  - Added `dataset` property to `HtmlModElement`
  - Full Proxy-based implementation with camelCase ↔ kebab-case conversion
  - Compatible with standard DOM `DOMStringMap` interface
  - Supports all dataset operations: get, set, delete, enumerate

  ## Performance

  **Benchmarks (vs stable version):**
  - Parse + setAttribute: 1.19x faster
  - Modify + query pattern: 2.16x faster
  - Real-world templates: 1.29x faster
  - Batched modifications: 3.07x slower (rare pattern)

  ## Documentation
  - See `EXPERIMENTAL.md` for complete feature comparison
  - Migration guide included for switching from stable to experimental
  - Comprehensive deployment recommendations

  ## Testing
  - 624 tests passing (vs 196 in stable)
  - Includes adversarial testing, stress testing, and real-world scenarios
  - Zero drift over 10,000+ consecutive operations
  - Handles malformed HTML gracefully

  ## Breaking Changes

  None - fully backward compatible. The experimental version is available at a separate import path (`/experimental`).

## 0.0.4

### Patch Changes

- [#23](https://github.com/customerio/ciolabs/pull/23) [`4b3dcad`](https://github.com/customerio/ciolabs/commit/4b3dcad877bb2cf95b87c0bd531ff3ee811af483) Thanks [@avigoldman](https://github.com/avigoldman)! - Fix valueless attribute source ranges

- Updated dependencies [[`4b3dcad`](https://github.com/customerio/ciolabs/commit/4b3dcad877bb2cf95b87c0bd531ff3ee811af483)]:
  - @ciolabs/htmlparser2-source@0.0.3

## 0.0.3

### Patch Changes

- [#21](https://github.com/customerio/ciolabs/pull/21) [`083e91f`](https://github.com/customerio/ciolabs/commit/083e91f429b22875da93997a41838fb5b8c02bab) Thanks [@avigoldman](https://github.com/avigoldman)! - Handle settinge the innerHTML of a self-closing tag

## 0.0.2

### Patch Changes

- [#19](https://github.com/customerio/ciolabs/pull/19) [`ec9a3f8`](https://github.com/customerio/ciolabs/commit/ec9a3f8541b57bec6f7e9ec08009becbb548444b) Thanks [@avigoldman](https://github.com/avigoldman)! - Adds SourceHtml and HtmlModText classes

- Updated dependencies [[`ec9a3f8`](https://github.com/customerio/ciolabs/commit/ec9a3f8541b57bec6f7e9ec08009becbb548444b)]:
  - @ciolabs/htmlparser2-source@0.0.2

## 0.0.1

### Patch Changes

- [#11](https://github.com/customerio/ciolabs/pull/11) [`712c657`](https://github.com/customerio/ciolabs/commit/712c657909b6f9dddf6e79cc0bd2d6c1978cb110) Thanks [@avigoldman](https://github.com/avigoldman)! - Update license

- Updated dependencies [[`712c657`](https://github.com/customerio/ciolabs/commit/712c657909b6f9dddf6e79cc0bd2d6c1978cb110)]:
  - @ciolabs/htmlparser2-source@0.0.1
