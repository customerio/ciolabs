# @ciolabs/html-email-formatter

> Format and prettify HTML email content with conditional comment support

Email HTML often contains Microsoft Outlook conditional comments (`<!--[if mso]>`) that need special handling during formatting. Standard HTML formatters can break these comments or misalign their indentation. This package safely formats email HTML while preserving conditional comment structure and whitespace.

## Why?

When building HTML emails, you often need to include conditional comments for Microsoft Outlook compatibility:

```html
<div>
  <!--[if mso]>
<table><tr><td>
<![endif]-->
  <p>Email content</p>
  <!--[if mso]>
</td></tr></table>
<![endif]-->
</div>
```

Standard HTML formatters either:

- Break the conditional comment syntax
- Misalign the opening and closing tags
- Strip important whitespace around comments

This formatter handles these edge cases correctly.

## Install

```bash
npm install @ciolabs/html-email-formatter
```

## Usage

```typescript
import emailFormatter from '@ciolabs/html-email-formatter';

const html = `
<div>
<!--[if mso]>
<table><tr><td>
<![endif]-->
<p>Email content</p>
<!--[if mso]>
</td></tr></table>
<![endif]-->
</div>
`;

const formatted = emailFormatter(html);
console.log(formatted);
```

Output:

```html
<div>
  <!--[if mso]>
  <table>
    <tr>
      <td>
  <![endif]-->
  <p>Email content</p>
  <!--[if mso]>
      </td>
    </tr>
  </table>
  <![endif]-->
</div>
```

### With Options

The formatter accepts options from both [pretty](https://www.npmjs.com/package/pretty) and [js-beautify](https://www.npmjs.com/package/js-beautify):

```typescript
const formatted = emailFormatter(html, {
  indent_size: 4,
  wrap_line_length: 80,
  preserve_newlines: false,
});
```

## How It Works

1. **Temporarily closes conditional comments** - Converts `<!--[if mso]>content<![endif]-->` to `<!--[if mso]>-->content<!--<![endif]-->` so formatters can process the inner HTML
2. **Preserves comment whitespace** - Uses [@ciolabs/html-preserve-comment-whitespace](../html-preserve-comment-whitespace) to maintain spacing around comments
3. **Formats the HTML** - Runs the modified HTML through standard formatters
4. **Restores conditional comments** - Converts back to original conditional comment syntax
5. **Aligns indentation** - Ensures opening and closing tags have consistent indentation

## API

### `emailFormatter(html, options?)`

Formats HTML email content while preserving conditional comments.

**Parameters:**

- `html` (string) - The HTML content to format
- `options` (object, optional) - Formatting options combining [pretty options](https://www.npmjs.com/package/pretty#options) and [js-beautify HTML options](https://beautifier.io/)

**Returns:**

- (string) - The formatted HTML

**Common Options:**

- `indent_size` (number) - Number of spaces for indentation (default: 2)
- `wrap_line_length` (number) - Line length before wrapping (default: 80)
- `preserve_newlines` (boolean) - Whether to preserve existing newlines (default: true)
- `max_preserve_newlines` (number) - Maximum consecutive newlines to preserve (default: 2)

## License

Apache-2.0 WITH Commons-Clause
