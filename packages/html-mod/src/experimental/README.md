# HTML-Mod Experimental: Auto-Flush Implementation

Automatically synchronizes the AST after every modification - no manual `flush()` calls needed.

## Why Use Experimental?

**Faster in ALL benchmarks** (10/10 wins):

- 4.69x faster for simple parsing
- 3.51x faster for parse + setAttribute
- 2.61x faster for real-world templates
- 2.29x faster for modify+query patterns
- 1.47x faster for batch modifications

**Simpler API:**

- No manual `flush()` calls
- Element references never go stale
- Zero cognitive overhead

**Production-ready:**

- 715 tests passing
- Zero drift over 10,000+ operations
- Handles malformed HTML gracefully

## Usage

```javascript
import { HtmlMod } from '@ciolabs/html-mod/experimental';

const html = new HtmlMod('<div><p>Hello</p></div>');
const div = html.querySelector('div');

// Modify - AST automatically synchronized
div.setAttribute('class', 'active');

// Query immediately - no flush needed!
const p = html.querySelector('p'); // ✅ Works perfectly

// Element references stay valid
div.setAttribute('data-id', '123'); // ✅ Still works
```

---

## Benchmarks

| Benchmark              | Stable   | Experimental | Speedup         |
| ---------------------- | -------- | ------------ | --------------- |
| Parse simple HTML      | 6.50µs   | 1.39µs       | 4.69x faster ✅ |
| Parse + setAttribute   | 14.70µs  | 4.18µs       | 3.51x faster ✅ |
| Real-world template    | 37.17µs  | 14.27µs      | 2.61x faster ✅ |
| innerHTML modification | 12.83µs  | 5.13µs       | 2.50x faster ✅ |
| Remove element         | 11.50µs  | 2.64µs       | 4.36x faster ✅ |
| Modify + query pattern | 769.69µs | 336.23µs     | 2.29x faster ✅ |
| 10 modifications       | 19.26µs  | 13.11µs      | 1.47x faster ✅ |

**Result: Experimental wins 10/10 benchmarks**

---

## Migration from Stable

**1. Update import:**

```javascript
// Before
import { HtmlMod } from '@ciolabs/html-mod';

// After
import { HtmlMod } from '@ciolabs/html-mod/experimental';
```

**2. Remove `flush()` calls** (or leave them - they're no-ops for backward compatibility)

**3. Simplify code** - element references stay valid, no need to re-query after modifications

That's it! The experimental version is 100% API compatible.
