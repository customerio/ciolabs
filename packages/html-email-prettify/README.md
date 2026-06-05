# @ciolabs/html-email-prettify

Format and prettify HTML email content with email-safe whitespace handling.

Built on top of [`@ciolabs/html-mod`](../html-mod) — walks the AST and adjusts whitespace text nodes using position-tracked operations. No external formatting libraries. The returned `HtmlMod` has a fully consistent AST for further edits.

**Note:** `prettify()` re-parses internally to sync the AST after formatting. Any `HtmlModElement` handles captured before calling `prettify(mod)` will be stale — re-query after formatting.

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
// doc is now formatted — re-query elements after prettify
const p = doc.querySelector('p');
```

## Options

```typescript
prettify(input, {
  // Indentation
  indentSize: 2, // default: 2
  indentChar: ' ', // default: ' ' (use '\t' for tabs)

  // Attribute wrapping
  maxLineLength: 120, // default: 0 (off) — triggers auto wrapping
  // default: 'auto'
  wrapAttributes:
    'auto' | //   wrap only when exceeding maxLineLength
    'force' | //   always wrap, one attribute per line (no maxLineLength needed)
    'force-aligned' | //   always wrap, align to first attribute (no maxLineLength needed)
    false, //   never wrap

  // Whitespace
  collapseBlankLines: true, // default: true — collapse 2+ blank lines to one
});
```

## Attribute wrapping

Attributes are broken onto new lines using the "break before attribute" style, which saves a character:

Before:

    <table cellpadding="0" cellspacing="0" border="0" width="600" align="center">

After (`wrapAttributes: 'auto'` or `'force'`):

    <table
      cellpadding="0"
      cellspacing="0"
      border="0"
      width="600"
      align="center">

After (`wrapAttributes: 'force-aligned'`):

    <table cellpadding="0"
           cellspacing="0"
           border="0"
           width="600"
           align="center">

Tags that start mid-line (e.g. `<p>Hello <a href="...">`) are not wrapped — only tags at the start of a line.

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
