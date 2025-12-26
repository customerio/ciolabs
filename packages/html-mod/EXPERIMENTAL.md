# Experimental Auto-Flush Implementation

This directory contains an **experimental** version of html-mod that automatically synchronizes the AST after every modification, eliminating the need for manual `flush()` calls.

## Files

- `src/index.experimental.ts` - Main entry point with auto-flush
- `src/ast-updater.experimental.ts` - AST position updater
- `src/ast-manipulator.experimental.ts` - AST manipulation utilities
- `src/position-delta.experimental.ts` - Position delta calculations
- `src/benchmark.ts` - Performance comparison tool

## Usage

### Option 1: Import from experimental module (recommended for testing)

```typescript
import { HtmlMod } from '@ciolabs/html-mod/experimental';

const html = new HtmlMod('<div><p>Hello</p></div>');
const p = html.querySelector('p')!;

// No flush needed! AST is automatically synchronized
p.innerHTML = 'World';
const result = html.querySelector('p')!.innerHTML; // 'World'
```

### Option 2: Direct import (for production testing)

```typescript
// In your package.json or import map, alias the experimental version
import { HtmlMod } from '@ciolabs/html-mod';

// Points to dist/index.experimental.mjs
```

## Key Differences

### Original (Manual Flush)

```typescript
const html = new HtmlMod('<div><p>Hello</p></div>');
const div = html.querySelector('div')!;

div.setAttribute('id', 'container');
div.setAttribute('class', 'main');

// Must flush before querying
html.flush();

const updated = html.querySelector('#container'); // Now finds it
```

### Experimental (Auto-Flush)

```typescript
const html = new HtmlMod('<div><p>Hello</p></div>');
const div = html.querySelector('div')!;

div.setAttribute('id', 'container');
div.setAttribute('class', 'main');

// No flush needed!
const updated = html.querySelector('#container'); // Immediately finds it
```

## Performance Characteristics

Based on benchmark results:

### ✅ Experimental is FASTER for:

- **Simple modifications** (1.24x faster) - Single attribute sets, innerHTML changes
- **Complex modify + query patterns** (2.24x faster) - Real-world usage where you modify then query
- **Real-world scenarios** (1.23x faster) - Template rendering, list building

### ⚠️ Original is FASTER for:

- **Bulk modifications without queries** (3.08x faster) - When you make many modifications then flush once

### 🤝 Similar performance:

- Parse-only operations
- Single modifications without queries
- innerHTML modifications
- Remove operations

## When to Use Experimental

Use the experimental version when:

1. **Developer experience is priority** - No need to remember to call `flush()`
2. **Interactive workflows** - Frequent modify + query patterns
3. **Real-world applications** - Template rendering, dynamic updates
4. **Testing in production** - Want to evaluate auto-flush with real workloads

## When to Use Original

Use the original version when:

1. **Bulk operations** - Making 10+ modifications before any queries
2. **Performance-critical paths** - Every microsecond counts
3. **Stable production** - Don't want experimental features

## Running Benchmarks

```bash
npm run benchmark
```

This will run 10 different benchmarks comparing original vs experimental implementations and show:

- Individual test results
- Overall winner
- Detailed performance breakdown

## API Compatibility

The experimental version is **100% API compatible** with the original:

- All methods work identically
- `flush()` is a no-op (kept for backwards compatibility)
- `isFlushed()` always returns `true`
- All tests pass (457/457) ✅
- Includes dataset API (browser-like data-\* attribute access)

## Implementation Details

The auto-flush implementation uses:

1. **Position Delta Tracking** - Calculates how each MagicString operation affects AST positions
2. **Incremental AST Updates** - Updates all affected nodes after each operation
3. **Cached Content** - Preserves innerHTML/outerHTML for removed elements
4. **Zero Breaking Changes** - Drop-in replacement for original

### Auto-Flush Process

After every modification:

1. **MagicString Operation** - Perform the string manipulation
2. **Calculate Delta** - Determine position changes (start, end, length delta)
3. **Queue Delta** - Add to pending deltas list
4. **Finish Operation** - Apply all deltas to AST, refresh source
5. **Ready for Next Query** - AST is synchronized, no flush needed

## Testing

### Comprehensive Test Coverage: 457 Tests ✅

The experimental version includes extensive testing to ensure robustness:

**Original Tests (196)**

- Core functionality from original implementation
- All existing behavior preserved

**Auto-Flush Edge Cases (181)**

- Clone behavior with modifications
- replaceWith edge cases
- Text node operations
- Parent/child reference integrity
- Children getter modifications
- querySelector after complex modifications
- Cascading modifications
- Document-level operations

**Dataset API (32)**

- Basic operations (get, set, delete, has)
- CamelCase ↔ kebab-case conversion
- Multiple attributes & enumeration
- Type coercion
- Special characters & unicode
- Integration with setAttribute/getAttribute
- Real-world patterns
- Performance scenarios

**Adversarial Tests (48)** 🔥

- **Extreme Values**: 1MB attributes, 500KB innerHTML, 1000 attributes, 200 nesting levels, 10,000 siblings
- **Malformed HTML**: Unclosed tags, mismatched tags, broken attributes, invalid nesting
- **Rapid Sequential Operations**: 1000 setAttribute calls, 100 innerHTML changes, 500 add/remove cycles
- **Edge Cases with Position Tracking**: Document boundaries, zero-length replacements, overlapping modifications
- **Boundary Conditions**: Null-like values, empty attributes, whitespace-only content
- **Stale Reference Handling**: Operations on removed elements and their siblings
- **Unicode and Special Characters**: Complex unicode, emoji, RTL text, zero-width characters, surrogate pairs
- **Memory and Performance Stress**: 1000 create/destroy cycles, 100 large documents
- **AST Corruption Detection**: Complex operations maintaining AST integrity
- **Dataset API Edge Cases**: 1000 attributes via dataset, extreme names, rapid changes
- **Pathological Cases**: 1000 nesting levels, circular modification patterns

Run tests:

```bash
npm test
```

Run adversarial tests specifically:

```bash
npm test src/adversarial.experimental.test.ts
```

## Production Readiness

### ✅ Ready for Testing

- All tests pass
- API compatible
- Performance is good for most use cases
- Benchmarks available

### ⚠️ Before Full Production

1. **Test with your workloads** - Run your specific use cases
2. **Profile performance** - Ensure it meets your requirements
3. **Monitor in staging** - Validate with real traffic
4. **Gradual rollout** - A/B test if possible

## Feedback

Please report any issues or performance concerns when testing the experimental version.

## Migration Path

If the experimental version proves stable and performant:

1. **Phase 1** (Current): Test experimental in staging/production
2. **Phase 2**: Promote experimental to main if successful
3. **Phase 3**: Keep original as legacy for specific use cases
4. **Phase 4**: Deprecate original if auto-flush is universally better

## Example: Real-World Usage

```typescript
// Template rendering - a common pattern
import { HtmlMod } from '@ciolabs/html-mod/experimental';

function renderUserList(users: User[]) {
  const html = new HtmlMod('<div id="users"></div>');
  const container = html.querySelector('#users')!;

  // Build user list
  const items = users
    .map(
      u =>
        `<div class="user" data-id="${u.id}">
      <h3>${u.name}</h3>
      <p>${u.email}</p>
    </div>`
    )
    .join('');

  container.innerHTML = items;

  // No flush needed! Can immediately query and modify
  const firstUser = html.querySelector('.user')!;
  firstUser.setAttribute('data-first', 'true');

  const allUsers = html.querySelectorAll('.user');
  allUsers[0].setAttribute('class', 'user active');

  return html.toString();
}
```

## Conclusion

The experimental auto-flush implementation provides a better developer experience with minimal performance impact for most real-world use cases. Test it in your environment to determine if it's right for your needs.
