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
  indentSize: 4, // default: 2
  indentChar: '\t', // default: ' '
});
```

## What it does

- Indents block elements with correct nesting depth
- Leaves inline elements alone (no added gaps between `<span>`, `<a>`, `<img>`, `<font>`, etc.)
- Preserves single-line conditional comments verbatim (MSO buttons, ghost tables)
- Formats content inside multi-line conditional comments
- Consistent indentation for closing-tag-only conditional comments
- Protects downlevel-revealed bubble comments (`<!--[if !mso]><!-->...<!--<![endif]-->`)
- Skips whitespace insertion between adjacent `display:inline-block` elements
- Never touches `<pre>`, `<code>`, `<textarea>` content

## Email-specific whitespace rules

The formatter is aware of patterns where adding whitespace breaks email rendering:

| Pattern                          | Behavior                                                     |
| -------------------------------- | ------------------------------------------------------------ |
| Adjacent inline elements         | No whitespace added between `</span><span>`, `</a><a>`, etc. |
| `display:inline-block` columns   | No whitespace added between adjacent inline-block elements   |
| Single-line conditional comments | Content preserved verbatim                                   |
| Bubble/revealed conditionals     | No whitespace inserted next to `<!--[if !mso]><!-->`         |
| `<pre>`, `<code>`, `<textarea>`  | Internal content never touched                               |

## License

Apache-2.0 WITH Commons-Clause
