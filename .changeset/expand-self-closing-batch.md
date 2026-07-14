---
'@ciolabs/html-mod': minor
---

Make `expandSelfClosing()` batch-aware.

Inside `batch()`, `expandSelfClosing()` now queues its edit (the ` />` → `></tag>` rewrite plus the AST convert-to-regular-tag) and applies it at flush, instead of an O(document) splice + AST walk per call. Expanding every self-closing element in a large document drops from quadratic to one rebuild + one AST pass.

`expandSelfClosing` is treated as a "structural" batch kind: it conflicts with any other queued edit on the same element (both touch the open-tag boundary), so a mixed sequence like `setAttribute(...)` then `expandSelfClosing()` on one element flushes between them — identical output to unbatched. Callers wanting the batched win should apply attribute marks and expansions in separate batched passes over distinct elements. `isSelfClosing` / `children` / `textContent` reads flush a pending expand so they never observe stale structure.

Measured (43KB document, 400 self-closing elements, two batched passes): 26ms → 2.3ms (11×), and batched time scales linearly with document size.
