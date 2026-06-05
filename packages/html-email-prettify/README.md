# @ciolabs/html-email-prettify

Format and prettify HTML email content with email-safe whitespace handling.

Built on top of [`@ciolabs/html-mod`](../html-mod) — walks the AST and adjusts whitespace text nodes directly using position-tracked operations. No re-parse, no external formatting libraries. The `HtmlMod` instance stays live with valid positions throughout.

## Install

```sh
npm install @ciolabs/html-email-prettify
```

## Usage

```typescript
import prettify from '@ciolabs/html-email-prettify';
import { HtmlMod } from '@ciolabs/html-mod';

// From a string — returns a new HtmlMod
const mod = prettify('<div><p>hello</p><p>world</p></div>');
console.log(mod.toString());
// <div>
//   <p>hello</p>
//   <p>world</p>
// </div>

// From an HtmlMod — mutates in place, returns the same instance
const doc = new HtmlMod('<div><p>original</p></div>');
doc.querySelector('p').after('<table><tr><td>added</td></tr></table>');
prettify(doc);
// doc is now formatted with the new table properly indented
```

## Options

```typescript
prettify(input, {
  // Indentation
  indentSize: 2, // default: 2
  indentChar: ' ', // default: ' ' (use '\t' for tabs)

  // Line length & attribute wrapping
  maxLineLength: 120, // default: 0 (off) — wrap attributes when tag exceeds this
  // default: 'auto'
  wrapAttributes:
    'auto' | //   wrap only when exceeding maxLineLength
    'force' | //   always wrap, one attribute per line
    'force-aligned' | //   always wrap, align to first attribute
    false, //   never wrap

  // Whitespace
  collapseBlankLines: true, // default: true — collapse 2+ blank lines to one

  // Conditional comments
  indentAfterConditionalComments: true, // default: true
  // Set false to keep content at the same indent as the comment
});
```

## Attribute wrapping

When `maxLineLength` is set and a tag's opening line exceeds it, attributes are broken onto new lines. Uses the "break before attribute" style which saves a character:

```html
<!-- Before -->
<table cellpadding="0" cellspacing="0" border="0" width="600" align="center">
  <!-- After (wrapAttributes: 'auto' or 'force') -->
  <table cellpadding="0" cellspacing="0" border="0" width="600" align="center">
    <!-- After (wrapAttributes: 'force-aligned') -->
    <table cellpadding="0" cellspacing="0" border="0" width="600" align="center"></table>
  </table>
</table>
```

## Email-specific whitespace rules

The formatter is aware of patterns where adding whitespace breaks email rendering:

| Pattern                          | Behavior                                                     |
| -------------------------------- | ------------------------------------------------------------ |
| Adjacent inline elements         | No whitespace added between `</span><span>`, `</a><a>`, etc. |
| `display:inline-block` columns   | No whitespace added between adjacent inline-block elements   |
| Single-line conditional comments | Content preserved verbatim                                   |
| Bubble/revealed conditionals     | No whitespace inserted next to `<!--[if !mso]><!-->`         |
| `<pre>`, `<code>`, `<textarea>`  | Internal content never touched                               |
| NBSP (`\u00A0`)                  | Treated as semantic content, never stripped                  |

## License

Apache-2.0 WITH Commons-Clause
