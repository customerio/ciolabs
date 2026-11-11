---
'@ciolabs/html-email-formatter': patch
---

Call js-beautify directly instead of through the unmaintained `pretty` package. The defaults, `ocd` and `newlines` behave as before, and output is unchanged. `pretty` also passed `condense-newlines` options such as `sep`, `min` and `keepWhitespace` through to the `ocd` pass. The types never allowed them, and they are now ignored. js-beautify stays on `~1.13.4` for parity with parcel-standalone.
