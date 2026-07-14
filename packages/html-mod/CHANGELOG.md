# @ciolabs/html-mod

## 1.2.0

### Minor Changes

- [#58](https://github.com/customerio/ciolabs/pull/58) [`174d4d9`](https://github.com/customerio/ciolabs/commit/174d4d94d8a8177966bb5a7b4a2cf19fb84b40a6) Thanks [@avigoldman](https://github.com/avigoldman)! - Add `HtmlMod.prototype.batch(fn)` — batched writes.

  Every eager mutation pays two O(document) costs (a full string splice and a recursive AST position update), so loops that write many attributes scale quadratically with document size. Inside `batch()`, `setAttribute`/`removeAttribute` (and everything built on them: `dataset`, `id`/`className` setters, `toggleAttribute`) plus the structural inserts `before`/`after`/`prepend`/`append` queue their edits and apply them in ONE string rebuild + ONE AST position pass at flush.

  Measured on a 232KB document: 3,600 `setAttribute` calls 515ms → 7ms; stripping the same attributes 627ms → 8ms; wrapping 800 elements in before/after markers 120ms → 6ms — and batched time stays flat as documents grow.

  Semantics are identical to unbatched execution: any read that could observe pending state flushes the batch first (source/serialization reads, selector queries, attribute reads on an edited element, non-attribute mutations, a second write to an already-edited element). The one documented difference: raw AST position fields (node `startIndex`/`endIndex` reached via `children`) read _inside_ a batch reflect pre-batch coordinates (mutually consistent) until the batch ends; position getters like `sourceRange` flush and return final coordinates.

  Internal note: `HtmlMod.__source` (an internal, `__`-prefixed member) changes from a data property to an accessor pair backed by a new `__sourceRaw` field. The getter flushes pending batched edits; the setter asserts none are pending. No public API changes. Direct external assignment to `HtmlMod.__source` now routes through the setter — no known consumers do this (the `__source` fields on `MarshaledPreview`/`magic-html` are unrelated classes).

## 1.1.2

### Patch Changes

- [#53](https://github.com/customerio/ciolabs/pull/53) [`671d5d9`](https://github.com/customerio/ciolabs/commit/671d5d96c73dd3e001346940423c35fb9598dde5) Thanks [@avigoldman](https://github.com/avigoldman)! - Fix synthesized close tags to use the open tag's source casing. The parser
  pairs open/close tags case-sensitively, but `expandSelfClosing`,
  `prepend`/`append`, and `innerHTML`/`textContent` synthesized a lowercase close
  tag. On a mixed-case element (`<X-Image/>`, `<X-Card>...`), that produced
  `<X-Image></x-image>` — which the parser will not re-pair on the next parse,
  leaving the close tag orphaned and corrupting a later mutation (e.g. an
  `outerHTML`/`replaceWith` that relies on the tracked close-tag range). All
  synthesized close tags now match the open tag's casing and round-trip cleanly.

## 1.1.1

### Patch Changes

- [#51](https://github.com/customerio/ciolabs/pull/51) [`6ffd55d`](https://github.com/customerio/ciolabs/commit/6ffd55da06f5ad6f4d6f733556d397c3cf611824) Thanks [@avigoldman](https://github.com/avigoldman)! - Fix several data-corruption / data-loss bugs where the tracked AST fell out of
  sync with the source string:
  - **Self-closing tags.** Mutating a self-closing element (`<img src="y"/>`,
    `<br>`, `<x-card ... />`) via `prepend`/`append`/`innerHTML`/`textContent`/
    `expandSelfClosing` left positions out of sync, so a later edit wrote to the
    wrong place (e.g. `<b> id="x">hi</b>`, `<brx</br>>`). These paths now keep
    `openTag.endIndex`, the synthesized close tag, and `element.endIndex`
    consistent with the parser's conventions.
  - **Implicitly-closed / unclosed elements.** For an element with no close tag
    (a `<td>`/`<li>`/`<p>` closed implicitly by a following sibling, common in
    email HTML) the parser's `endIndex` overshoots into the next sibling.
    `innerHTML`/`append`/`textContent` ate the next element and
    `outerHTML`/`after`/`remove`/`replaceWith` spanned into it — e.g.
    `remove()` on the first of `<td>1<td>2` deleted _both_ cells. Content and
    outer boundaries are now derived from the element's own last descendant.
  - **`trim`/`trimStart`/`trimEnd`/`trimLines`.** Trimmed boundary whitespace was
    removed from the string but left as stale/phantom text nodes in the AST (and
    trimming both ends mis-applied the trailing delta). The AST is now reconciled.
  - **`HtmlModText` at index 0.** A one-character text node at the start of the
    document (`endIndex === 0`) silently dropped `textContent`/`innerHTML` writes.

## 1.1.0

### Minor Changes

- [#48](https://github.com/customerio/ciolabs/pull/48) [`a18b0c0`](https://github.com/customerio/ciolabs/commit/a18b0c0663f65e0e6280625aee8c6b0f99c68ffd) Thanks [@avigoldman](https://github.com/avigoldman)! - Add `isSelfClosing` getter and `expandSelfClosing()` method to `HtmlModElement`.
  - `isSelfClosing` returns true when the element has no close tag (`<tag />`)
  - `expandSelfClosing()` converts `<tag />` to `<tag></tag>`, updating both the source string and the AST

## 1.0.1

### Patch Changes

- [#41](https://github.com/customerio/ciolabs/pull/41) [`c19865b`](https://github.com/customerio/ciolabs/commit/c19865b1386e679053c4e57db3fd30c71fae7d1c) Thanks [@avigoldman](https://github.com/avigoldman)! - Update README to reflect that the auto-flush implementation is now the default. Remove outdated `flush()` and `isFlushed()` docs, add element reference stability examples, and add migration notes for users upgrading from older versions.

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
