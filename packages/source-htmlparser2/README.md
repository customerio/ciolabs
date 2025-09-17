# @ciolabs/source-htmlparser2

> A wrapper around [htmlparser2](https://github.com/fb55/htmlparser2) that adds source range information to the AST.

## Install

```
npm install @ciolabs/source-htmlparser2
```

## Usage

```typescript
import { parseDocument } from '@ciolabs/source-htmlparser2';

const html = '<div>hello</div>';

const document = parseDocument(html);
```

## API

### parseDocument(data, options?)

Parses HTML and returns a document with source range information attached to each element.

#### Parameters

- `data` (`string`) - The HTML string to parse
- `options` (`Options`, optional) - Parser options that inherit all [htmlparser2 ParserOptions](https://github.com/fb55/htmlparser2/wiki/Parser-options) and [DomHandlerOptions](https://github.com/fb55/domhandler#options)

#### Returns

Returns a `SourceDocument` with enhanced elements that include source range information.

## Options

### `autofix`

This will add in the missing close tags into the AST. Note, because they don't exist in the source, they will have index positions of -1.

```typescript
import { parseDocument, nodeToString } from '@ciolabs/source-htmlparser2';

const html = '<div>hello';

const document = parseDocument(html, { autofix: true });

console.log(nodeToString(document)); //=> <div>hello</div>
```

## Types

### SourceElement

Enhanced HTML elements that include source range information:

```typescript
type SourceElement = {
  source: {
    openTag: {
      startIndex: number;
      endIndex: number;
      data: string;
      name: string;
      isSelfClosing: boolean;
    };
    closeTag: {
      startIndex: number;
      endIndex: number;
      data: string;
      name: string;
    } | null;
    attributes: Array<{
      name: {
        startIndex: number;
        endIndex: number;
        data: string;
      };
      value: {
        startIndex: number;
        endIndex: number;
        data: string;
      } | null;
      quote: '"' | "'" | null | undefined;
      source: {
        startIndex: number;
        endIndex: number;
        data: string;
      };
    }>;
  };
  children: SourceChildNode[];
};
```

### SourceDocument

Enhanced document with position utilities:

```typescript
type SourceDocument = {
  children: SourceChildNode[];
  offsetToPosition(offset: number): { line: number; character: number };
};
```

## Utility Functions

### nodeToString(node)

Converts a parsed node back to its HTML string representation.

```typescript
import { parseDocument, nodeToString } from '@ciolabs/source-htmlparser2';

const html = '<div class="test">content</div>';
const document = parseDocument(html);

console.log(nodeToString(document)); // '<div class="test">content</div>'
```

### Type Guards

The package exports several type guard functions:

- `isTag(node)` - Check if node is a SourceElement
- `isText(node)` - Check if node is a text node
- `isComment(node)` - Check if node is a comment node
- `isDocument(node)` - Check if node is a SourceDocument
- `isCDATA(node)` - Check if node is a CDATA section
- `isDirective(node)` - Check if node is a processing instruction
- `isDoctype(node)` - Check if node is a doctype declaration
