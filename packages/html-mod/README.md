# @ciolabs/html-mod

> Manipulate HTML strings with a Browser-like API

## Why?

### The problems

Why is this necessary? Why not just use a tried and true tool like cheerio? There is a whole group of tools made for this.

That class of tools are parsing. They parse the HTML into an Abstract Syntax Tree (AST) and then you can manipulate the AST. Then when you're ready to output the HTML, you serialize the AST back into a string.

This is great if the HTML is totally valid and has no quirks.

But we are building for two use cases:

1. Email code
2. User source files

#### Email code

Email code will have plenty of quirks. And it will contain personalization languages like Liquid and Handlebars. We need to be able to parse the HTML, but we can't serialize it into an AST because it might break the personalization languages.

For example, running this HTML through cheerio:

```
<a href={{ url }}>Click me</a>
```

will result in this:

```html
<a href="{{" url }}>Click me</a>
```

As you can see that broke the Liquid syntax.

#### User source files

User source files might have similar quirks. But more importantly, we want to edit their file without changing the _whole_ file. Just the one part we are trying to edit.

An example is if we are trying to add a class to this `div`:

```
<main class='main'>
  <div class="button">Click me</div>
</main>
```

If we use cheerio it will reserialize **all** of the HTML with double quotes:

```html
<main class="main">
  <div class="button added-class">Click me</div>
</main>
```

This is fine programmatically, but it's not what the user expects. We just changed potentially hundreds of lines of code, but the user only changed one single attribute.

And if the user had anything not 100% correct (i.e. a missing tag) we just "fixed" it - a totally unexpected edit!

### The solution

We need a tool that can parse the HTML, but not serialize it. We need a tool that can edit the HTML without changing the whole file.

This is where `html-mod` comes in. It's a tool that can parse the HTML so we get the AST-style manipulation. But instead of manipulating the AST we take the HTML and manipulate the string directly. That way we only ever change the part of the HTML we want to change.

## Install

```bash
npm install @ciolabs/html-mod
```

## Usage

```typescript
import { HtmlMod } from '@ciolabs/html-mod';

const h = new HtmlMod('<div>hello</div>');

h.querySelector('div')!.innerHTML = 'world';

console.log(h.toString());
//=> <div>world</div>
```

## Automatic Position Updates

`html-mod` automatically keeps the AST synchronized with string manipulations without expensive reparsing. When you modify the HTML, the library:

1. Tracks position changes from string operations
2. Updates AST node positions incrementally (cheap!)
3. Ensures queries always reflect the current state

This means you can query immediately after modifications:

```typescript
import { HtmlMod } from '@ciolabs/html-mod';

const h = new HtmlMod('<div>hello</div>');

h.querySelector('div')!.append('<div>world</div>');

// Queries work immediately - no manual flushing needed!
console.log(h.querySelectorAll('div').length); //=> 2
```

### Manual Flushing (Rarely Needed)

The `flush()` method is still available for backward compatibility or rare edge cases where you need to force a full reparse:

```typescript
h.flush(); // Force full reparse (usually not needed)
```

You can check flush status with `isFlushed()`, though this is primarily for internal use:

```typescript
console.log(h.isFlushed()); //=> true (automatically maintained)
```

## HtmlMod

The `HtmlMod` class is the main class for this package. It's the class that you use to query for `HtmlModElement` elements and manipulate the HTML string.

### constructor(html: string, options?)

#### options

> `HtmlModOptions` | optional

The full options for [htmlparser2](https://github.com/fb55/htmlparser2/wiki/Parser-options#option-xmlmode). This is the underlying parser used to parse the HTML.

#### options.HtmlModElement

> `Class` | optional

The class to use for the `HtmlModElement` class. This is the class that is used to manipulate the HTML. By default, it uses the `HtmlModElement` class in this package.

### Methods

#### trim() => this

Removes all whitespace from the beginning and end of the HTML string.

#### trimStart(charType?: string) => this

Removes all whitespace from the beginning of the HTML string.

**charType**: The type of character to remove. Defaults to `\s`.

#### trimEnd(charType?: string) => this

Removes all whitespace from the end of the HTML string.

**charType**: The type of character to remove. Defaults to `\s`.

#### trimLines() => this

Removes empty lines from the start and end.

#### isEmpty() => boolean

Returns `true` if the resulting HTML is empty.

#### isFlushed() => boolean

Returns `true` if the AST positions are in sync with the source string. This is automatically managed and primarily for internal use.

#### generateDecodedMap()

Generates a decoded map of the HTML string. This is used to map the manipulated HTML string back to the original HTML string.

#### generateMap()

Generates a map of the HTML string. This is used to map the manipulated HTML string back to the original HTML string.

#### toString() => string

Returns the manipulated HTML string.

#### clone() => HtmlMod

Returns a new `HtmlMod` instance with the same HTML string.

#### flush() => this

Forces a full reparse of the HTML. This is rarely needed as the library automatically maintains AST synchronization. Provided for backward compatibility and edge cases.

Returns `this`.

#### querySelector(selector: string) => HtmlModElement | null

Returns the first `HtmlModElement` that matches the selector.

#### querySelectorAll(selector: string) => HtmlModElement[]

Returns an array of `HtmlModElement` that match the selector.

## HtmlModElement

The `HtmlModElement` class is the class that is used to manipulate the HTML. It's the class that is returned when you run a query.

### Properties

#### tagName: string

The tag name of the element.

#### id: string

The id of the element.

#### classList: string[]

An array of the classes on the element.

#### className: string

The class attribute value of the element.

#### attributes: Attribute[]

An array of `Attribute` objects.

#### innerHTML: string

The inner HTML of the element. This can be set.

#### outerHTML: string

The outer HTML of the element.

#### textContent: string

The text content of the element. This can be set.

#### children: SourceChildNode[]

An array of the children of the element.

#### parent: HtmlModElement | null

The parent element.

#### sourceRange: object

Position information for the element in the source:

```typescript
{
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
}
```

### Methods

#### before(html: string) => this

Inserts the HTML before the element.

#### after(html: string) => this

Inserts the HTML after the element.

#### prepend(html: string) => this

Prepends the HTML to the element.

#### append(html: string) => this

Appends the HTML to the element.

#### remove() => this

Removes the element.

#### replaceWith(html: string) => this

Replaces the element with the HTML.

#### hasAttribute(name: string) => boolean

Returns `true` if the element has the attribute.

#### hasAttributes() => boolean

Returns `true` if the element has any attributes.

#### getAttribute(name: string) => string | null

Returns the value of the attribute.

#### getAttributeNames() => string[]

Returns an array of the attribute names.

#### setAttribute(name: string, value: string) => this

Sets the attribute.

#### toggleAttribute(name: string, force?: boolean) => this

Toggles the attribute.

**force**: If `true`, the attribute will be added. If `false`, the attribute will be removed. If not specified, the attribute will be toggled.

#### removeAttribute(name: string) => this

Removes the attribute.

#### querySelector(selector: string) => HtmlModElement | null

Returns the first `HtmlModElement` that matches the selector.

#### querySelectorAll(selector: string) => HtmlModElement[]

Returns an array of `HtmlModElement` that match the selector.

#### toString() => string

Returns the HTML string. Same as `outerHTML`.

#### clone() => HtmlModElement

Returns a new `HtmlModElement` instance with the same HTML string.

Useful if you want to manipulate the HTML without affecting the original `HtmlMod` instance.

## Types

### HtmlModOptions

```typescript
type HtmlModOptions = Options & {
  HtmlModElement?: typeof HtmlModElement;
};
```

Where `Options` inherits all [htmlparser2 ParserOptions](https://github.com/fb55/htmlparser2/wiki/Parser-options) and [DomHandlerOptions](https://github.com/fb55/domhandler#options).
