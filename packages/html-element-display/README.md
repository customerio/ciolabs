# @ciolabs/html-element-display

Default CSS `display` values for HTML elements per the [WHATWG HTML spec](https://html.spec.whatwg.org/multipage/rendering.html).

Auto-generated from the [`html-ua-styles`](https://www.npmjs.com/package/html-ua-styles) package (the spec's user-agent stylesheet). Run `pnpm generate` to regenerate.

## Install

```sh
npm install @ciolabs/html-element-display
```

## Usage

```typescript
import { getElementDisplay, isInlineElement } from '@ciolabs/html-element-display';

getElementDisplay('div'); // 'block'
getElementDisplay('span'); // 'inline'
getElementDisplay('table'); // 'table'
getElementDisplay('td'); // 'table-cell'
getElementDisplay('li'); // 'list-item'
getElementDisplay('button'); // 'inline-block'
getElementDisplay('script'); // 'none'

// Unknown/custom elements default to 'inline'
getElementDisplay('x-button'); // 'inline'

isInlineElement('span'); // true
isInlineElement('button'); // true  (inline-block counts as inline)
isInlineElement('div'); // false
isInlineElement('x-component'); // true  (unknown defaults to inline)
```

## API

### `getElementDisplay(tagName: string): CssDisplay`

Returns the default CSS `display` value for the given HTML element. Unknown and custom elements return `'inline'`.

### `isInlineElement(tagName: string): boolean`

Returns `true` if the element's default display is `inline`, `inline-block`, or `inline-flex`. Unknown and custom elements return `true`.

### `CssDisplay`

TypeScript union of all possible default display values.

## Regenerating

The source is auto-generated from the WHATWG spec. To update after a spec change:

```sh
pnpm generate
```

This parses `html-ua-styles/index.css` and writes `src/index.ts`.

## License

Apache-2.0 WITH Commons-Clause
