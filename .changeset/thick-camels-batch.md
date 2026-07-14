---
'@ciolabs/html-mod': minor
---

Add `HtmlMod.prototype.batch(fn)` — batched writes.

Every eager mutation pays two O(document) costs (a full string splice and a recursive AST position update), so loops that write many attributes scale quadratically with document size. Inside `batch()`, `setAttribute`/`removeAttribute` (and everything built on them: `dataset`, `id`/`className` setters, `toggleAttribute`) plus the structural inserts `before`/`after`/`prepend`/`append` queue their edits and apply them in ONE string rebuild + ONE AST position pass at flush.

Measured on a 232KB document: 3,600 `setAttribute` calls 515ms → 7ms; stripping the same attributes 627ms → 8ms; wrapping 800 elements in before/after markers 120ms → 6ms — and batched time stays flat as documents grow.

Semantics are identical to unbatched execution: any read that could observe pending state flushes the batch first (source/serialization reads, selector queries, attribute reads on an edited element, non-attribute mutations, a second write to an already-edited element). The one documented difference: position fields read _inside_ a batch reflect pre-batch coordinates (mutually consistent) until the batch ends.
