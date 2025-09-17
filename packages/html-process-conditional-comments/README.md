# @ciolabs/process-conditional-comments

> Makes it easy to safely process HTML inside of conditional comments

## Why?

Conditional comments are a way to target specific email clients. For example, you can use conditional comments to target Outlook 2007 and below. However, conditional comments are literally HTML comments, so you can't parse them with a normal HTML parser. This library makes it easy to safely process HTML inside of conditional comments by revealing the HTML content and wrapping the HTML back inside of the conditional comments when the processing is complete.

## Install

```bash
npm install @ciolabs/process-conditional-comments
```

## Usage

```js
import { preprocess, postprocess } from '@ciolabs/process-conditional-comments';

const html = `
  <!--[if mso]>
    <div>hello</div>
  <![endif]-->
`;

const processed = preprocess(html);

// now parse the HTML and do whatever you want with it
const doc = new HtmlMod(processed);

// do some manipulation
doc.querySelector('div').innerHTML = 'world';

// now postprocess the HTML
const postprocessed = postprocess(doc.toString());

console.log(postprocessed);
//=> <!--[if mso]>
//=>   <div>world</div>
//=> <![endif]-->
```

## API

### preprocess(source: string) => string

Preprocesses the HTML string by revealing the HTML content inside of conditional comments. This is the first step in processing HTML inside of conditional comments.

**Example:**

```html
<!--[if mso]>HTML<![endif]-->
```

becomes

```html
<!--[if mso]>__PROCESS_CONDITIONAL_COMMENTS-->HTML<!--__PROCESS_CONDITIONAL_COMMENTS<![endif]-->
```

### postprocess(source: string) => string

Postprocesses the HTML string by wrapping the HTML content inside of conditional comments. This is the last step in processing HTML inside of conditional comments.

Reverts the changes made by `preprocess()`.

### getEmbeddedDocument(source: string) => string

Gets the full embedded document, replacing the conditional comments with whitespace of equal length.

This is useful when you want to extract just the HTML content without the conditional comment markers, while preserving the original document structure and character positions.

## TypeScript Support

This package is built with TypeScript and provides full type definitions.
