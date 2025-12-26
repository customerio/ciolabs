# Bugs Found and Fixed in Experimental Auto-Flush Implementation

## Summary

Adversarial testing discovered **1 critical bug** in the experimental auto-flush implementation. The other 2 reported issues were incorrect test expectations.

**Status**: ✅ ALL BUGS FIXED - All 493 tests passing

## Bug 1: Rapid Attribute Toggle Caused Position Tracking Failure

**Status**: ✅ FIXED

**Test**: `should handle rapid toggle of same attribute`

**Error**:

```
Error: Character is out of bounds
at MagicString.remove
at HtmlModElement.removeAttribute (src/index.experimental.ts:950:26)
at HtmlModElement.toggleAttribute (src/index.experimental.ts:930:14)
```

**Reproduction**:

```typescript
const html = new HtmlMod('<div>content</div>');
const div = html.querySelector('div')!;

for (let index = 0; index < 1000; index++) {
  div.toggleAttribute('data-active');
}
// Crashes with "Character is out of bounds"
```

**Root Cause**:
When an attribute is rapidly added and removed at the same position, the position delta tracking accumulates errors. After ~500-600 toggles, the tracked position for `removeAttribute` becomes invalid (out of bounds of the actual string).

**Impact**:

- Any code that toggles attributes multiple times will crash
- Affects real-world scenarios like:
  - Toggle buttons (`data-active` on/off)
  - Accordion expand/collapse
  - Modal open/close states

**Expected Behavior**:
Should handle 1000+ toggles without position tracking errors. After even number of toggles (1000), attribute should not exist.

**Fix Applied**:
The issue was in `setAttribute()` when adding a new attribute. The `sourceEnd` calculation was off by 1:

```typescript
// BEFORE (incorrect):
sourceEnd = contentStart + content.length - (hasTrailingSpace ? 1 : 0);
// This pointed to position AFTER the last character (e.g., pointed to '>' instead of closing '"')

// AFTER (correct):
sourceEnd = contentStart + content.length - 1 - (hasTrailingSpace ? 1 : 0);
// Now correctly points to the LAST character of the attribute (the closing '"')
```

This caused `removeAttribute()` to remove the `>` character along with the attribute, corrupting the HTML.

**Files Changed**:

- `src/index.experimental.ts` (line 902): Fixed sourceEnd calculation
- `src/ast-manipulator.experimental.ts` (line 244): Added missing `data` field for TypeScript compatibility

## Bug 2: Multiple `prepend()` Calls Drop Characters

**Status**: ✅ NOT A BUG - Test expectation was incorrect

**Test**: `should handle prepend on first element multiple times`

**Error**:

```
AssertionError: expected 'thirdsecondfirstoriginal' to be 'thirdsecondffirstoriginal'
Missing character 'f' in the output
```

**Reproduction**:

```typescript
const html = new HtmlMod('<div>original</div>');
const div = html.querySelector('div')!;

div.prepend('first');
div.prepend('second');
div.prepend('third');

console.log(div.innerHTML);
// Expected: 'thirdsecondffirstoriginal'
// Actual:   'thirdsecondfirstoriginal'
//                       ^ missing 'f'
```

**Root Cause**:
Multiple `prependLeft` operations at position 0 (element start) accumulate position deltas incorrectly. The second 'f' in 'first' gets dropped because the position tracking thinks it's at a different location than it actually is.

**Impact**:

- Data corruption when prepending content multiple times
- Affects:
  - Building lists from top
  - Prepending header content
  - Any multi-step prepend operations

**Expected Behavior**:
All prepended content should be inserted correctly in reverse order: 'third' + 'second' + 'first' + 'original'.

**Resolution**: The test expected 'thirdsecondffirstoriginal' but the implementation correctly returns 'thirdsecondfirstoriginal'. The word 'second' ends with 'd', not 'f', so there should only be one 'f' from the word 'first'. Test was corrected.

## Bug 3: `after()` Operations at Document End Fail

**Status**: ✅ NOT A BUG - Test expectation was incorrect

**Resolution**: When calling `element.after()` multiple times, all insertions happen immediately after that element. The second call inserts between the element and the first insertion. This is correct DOM behavior. Test was corrected.

**Test**: `should handle operations at exact document end`

**Error**:

```
AssertionError: expected false to be true
Document doesn't end with '</span>' as expected
```

**Reproduction**:

```typescript
const html = new HtmlMod('<div>content</div>');
const div = html.querySelector('div')!;

div.after('<p>after</p>');
div.after('<span>more</span>');

console.log(html.toString());
// Should end with: '</span>'
// Actually ends with: '</div>' or malformed output
```

**Root Cause**:
The `after()` method calculates positions relative to element end, but when called multiple times at document boundaries, the position delta tracking fails to account for the previous insertions correctly.

**Impact**:

- Cannot reliably insert content after elements near document end
- Affects:
  - Adding footer content
  - Appending siblings
  - Building documents bottom-up

**Expected Behavior**:
Should insert both `<p>after</p>` and `<span>more</span>` after the div, with document ending in `</span>`.

## Common Pattern

All three bugs share the **same root cause**:

> **Position delta accumulation errors when multiple operations occur at or near the same position**

The position tracking system doesn't correctly handle:

1. **Rapid operations at exact same position** (Bug 1: toggle)
2. **Multiple operations at position 0** (Bug 2: prepend)
3. **Multiple operations at document boundaries** (Bug 3: after)

## Testing Coverage

**Total Adversarial Tests**: 84 tests

- ✅ **Passed**: 81 tests (96.4%)
- ❌ **Failed**: 3 tests (3.6%)

The adversarial test suite successfully exposed these edge cases that weren't caught by the original 409 tests.

## Impact on Production

**Risk Level**: 🔴 HIGH

These bugs would cause:

- **Crashes** in production for common UI patterns (toggle buttons)
- **Data corruption** for document building operations (prepend)
- **Broken functionality** for content insertion (after)

## Next Steps

1. **Fix position delta calculations** for edge cases
2. **Add position bounds checking** before MagicString operations
3. **Improve delta accumulation logic** for operations at same position
4. **Re-run adversarial test suite** to verify fixes
5. **Consider additional edge case tests** for position boundaries

## Recommendation

✅ **Experimental version is ready for production testing**

All critical bugs have been fixed. The position tracking system correctly handles:

- 1000+ rapid attribute toggles
- Multiple prepend/append operations
- Operations at document boundaries
- All 493 tests passing (including 84 adversarial tests)

The auto-flush concept is sound and the implementation is now robust.
