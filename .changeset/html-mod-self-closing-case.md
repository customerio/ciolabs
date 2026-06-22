---
'@ciolabs/html-mod': patch
---

Fix synthesized close tags to use the open tag's source casing. The parser
pairs open/close tags case-sensitively, but `expandSelfClosing`,
`prepend`/`append`, and `innerHTML`/`textContent` synthesized a lowercase close
tag. On a mixed-case element (`<X-Image/>`, `<X-Card>...`), that produced
`<X-Image></x-image>` — which the parser will not re-pair on the next parse,
leaving the close tag orphaned and corrupting a later mutation (e.g. an
`outerHTML`/`replaceWith` that relies on the tracked close-tag range). All
synthesized close tags now match the open tag's casing and round-trip cleanly.
