---
'@ciolabs/html-mod': patch
---

Fix several data-corruption / data-loss bugs where the tracked AST fell out of
sync with the source string:

- **Self-closing tags.** Mutating a self-closing element (`<img src="y"/>`,
  `<br>`, `<x-card ... />`) via `prepend`/`append`/`innerHTML`/`textContent`/
  `expandSelfClosing` left positions out of sync, so a later edit wrote to the
  wrong place (e.g. `<b> id="x">hi</b>`, `<brx</br>>`). These paths now keep
  `openTag.endIndex`, the synthesized close tag, and `element.endIndex`
  consistent with the parser's conventions.
- **Implicitly-closed / unclosed elements.** For an element with no close tag
  (a `<td>`/`<li>`/`<p>` closed implicitly by a following sibling, common in
  email HTML) the parser's `endIndex` overshoots into the next sibling.
  `innerHTML`/`append`/`textContent` ate the next element and
  `outerHTML`/`after`/`remove`/`replaceWith` spanned into it — e.g.
  `remove()` on the first of `<td>1<td>2` deleted _both_ cells. Content and
  outer boundaries are now derived from the element's own last descendant.
- **`trim`/`trimStart`/`trimEnd`/`trimLines`.** Trimmed boundary whitespace was
  removed from the string but left as stale/phantom text nodes in the AST (and
  trimming both ends mis-applied the trailing delta). The AST is now reconciled.
- **`HtmlModText` at index 0.** A one-character text node at the start of the
  document (`endIndex === 0`) silently dropped `textContent`/`innerHTML` writes.
