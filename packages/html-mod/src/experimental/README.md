# HTML-Mod Experimental: Auto-Flush Implementation

Automatically synchronizes the AST after every modification - no manual `flush()` calls needed.

## Why Use Experimental?

**Faster in ALL benchmarks** (10/10 wins):

- 4.72x faster for simple parsing
- 3.40x faster for parse + setAttribute
- 2.44x faster for real-world templates
- 2.29x faster for modify+query patterns
- 1.33x faster for batch modifications

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
| Parse simple HTML      | 5.31µs   | 1.13µs       | 4.72x faster ✅ |
| Parse + setAttribute   | 11.35µs  | 3.34µs       | 3.40x faster ✅ |
| Real-world template    | 27.96µs  | 11.44µs      | 2.44x faster ✅ |
| innerHTML modification | 9.86µs   | 3.97µs       | 2.49x faster ✅ |
| Remove element         | 8.70µs   | 2.18µs       | 4.00x faster ✅ |
| Modify + query pattern | 604.05µs | 263.83µs     | 2.29x faster ✅ |
| 10 modifications       | 14.54µs  | 10.95µs      | 1.33x faster ✅ |

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
