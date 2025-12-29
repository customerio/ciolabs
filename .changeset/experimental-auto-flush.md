---
'@ciolabs/html-mod': minor
---

Add experimental auto-flush implementation that eliminates manual `flush()` calls

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
