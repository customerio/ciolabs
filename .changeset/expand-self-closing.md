---
'@ciolabs/html-mod': minor
---

Add `isSelfClosing` getter and `expandSelfClosing()` method to `HtmlModElement`.

- `isSelfClosing` returns true when the element has no close tag (`<tag />`)
- `expandSelfClosing()` converts `<tag />` to `<tag></tag>`, updating both the source string and the AST
