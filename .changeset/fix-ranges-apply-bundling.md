---
'@ciolabs/html-email-formatter': patch
'@ciolabs/html-preserve-comment-whitespace': patch
'@ciolabs/html-process-conditional-comments': patch
---

Bundle ranges-apply into CJS dist

`ranges-apply` and its dependencies (`ranges-merge`, `tiny-invariant`) are ESM-only packages. Without bundling them, CJS consumers (like server-procedures in parcel) can't `require()` the ciolabs packages. Added `noExternal` to tsup configs to inline these deps into the dist output.
