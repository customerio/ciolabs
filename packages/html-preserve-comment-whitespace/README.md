# @ciolabs/preserve-comment-whitespace

> Preserves the presence or lack thereof of whitespace surrounding HTML comments.

HTML formatters don't always properly handle HTML comments. This package attempts to properly maintain the whitespace around the HTML comments.

Some known issues:

- https://github.com/beautify-web/js-beautify/issues/1301
- https://github.com/beautify-web/js-beautify/issues/1823

## Install

```
npm install @ciolabs/preserve-comment-whitespace
```

## Usage

```js
import { preserve, restore } from '@ciolabs/preserve-comment-whitespace';
import beautify from 'js-beautify';

const html = `<div><div><!-- my html comment --></div></div>`;

const comments = preserve(html);
const formatted = beautify.html(html);
//=> <div>\n    <div>\n        <!-- my html comment -->\n    </div>\n</div>
const formattedAndRestored = restore(formatted, comments);
//=> <div>\n    <div><!-- my html comment --></div>\n</div>
```

## API

### preserve(html)

Returns an Array containing the objects describing the HTML comments.

### restore(html, comments, options)

Returns a string where the whitespace around the HTML comments is restored.

**Note:** the processing between `preserve` and `restore` should not add or remove any comments. If the number of comments given don't match the number of comments found in the given HTML, `restore` will return the given string, unprocessed.

#### html

> `string` | required

String of HTML after any formatting that would have affected the whitespace.

#### comments

> `CommentData[]` | defaults to `[]`

The Array returned from `preserve`.

#### options

> `RestoreOptions` | defaults to `{ restoreInline: true }`

Configuration for how to restore the comment whitespace.

Accept `restoreInline`. If `true`, comments that were originally inline (i.e. not on their own lines) will be restored to be inline. Otherwise, it will accept the new line placement.

## Types

### CommentData

```typescript
interface CommentData {
  leadingWhitespace: string;
  trailingWhitespace: string;
  hasLeadingWhitespace: boolean;
  hasTrailingWhitespace: boolean;
}
```

### RestoreOptions

```typescript
interface RestoreOptions {
  restoreInline: boolean;
}
```
