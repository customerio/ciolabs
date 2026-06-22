---
'@ciolabs/html-mod': patch
---

Fix position-drift data corruption on self-closing tags. Mutating a
self-closing element (`<img src="y"/>`, `<br>`, `<x-card ... />`) via
`prepend`/`append`/`innerHTML`/`textContent`/`expandSelfClosing` could leave
the tracked AST positions out of sync with the source string, so a subsequent
edit wrote bytes to the wrong location (e.g. `<b> id="x">hi</b>` or
`<brx</br>>`). All of these paths now keep `openTag.endIndex`, the synthesized
close tag, and `element.endIndex` consistent with the parser's conventions.
