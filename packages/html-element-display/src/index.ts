// Auto-generated from the WHATWG HTML spec user-agent stylesheet.
// Source: https://html.spec.whatwg.org/multipage/rendering.html
// Package: html-ua-styles (https://www.npmjs.com/package/html-ua-styles)
// Generated: 2026-06-04
// Run `pnpm generate` to regenerate.

export type CssDisplay =
  | 'block'
  | 'contents'
  | 'flex'
  | 'inline'
  | 'inline-block'
  | 'inline-flex'
  | 'list-item'
  | 'none'
  | 'ruby'
  | 'ruby-text'
  | 'table'
  | 'table-caption'
  | 'table-cell'
  | 'table-column'
  | 'table-column-group'
  | 'table-footer-group'
  | 'table-header-group'
  | 'table-row'
  | 'table-row-group';

/**
 * Default CSS `display` value for HTML elements per the WHATWG spec.
 * Elements not in this map default to `'inline'`.
 */
const ELEMENT_DISPLAY = new Map<string, CssDisplay>([
  // block
  ['address', 'block'],
  ['article', 'block'],
  ['aside', 'block'],
  ['blockquote', 'block'],
  ['body', 'block'],
  ['center', 'block'],
  ['dd', 'block'],
  ['details', 'block'],
  ['dialog', 'block'],
  ['dir', 'block'],
  ['div', 'block'],
  ['dl', 'block'],
  ['dt', 'block'],
  ['fieldset', 'block'],
  ['figcaption', 'block'],
  ['figure', 'block'],
  ['footer', 'block'],
  ['form', 'block'],
  ['h1', 'block'],
  ['h2', 'block'],
  ['h3', 'block'],
  ['h4', 'block'],
  ['h5', 'block'],
  ['h6', 'block'],
  ['header', 'block'],
  ['hgroup', 'block'],
  ['hr', 'block'],
  ['html', 'block'],
  ['legend', 'block'],
  ['listing', 'block'],
  ['main', 'block'],
  ['menu', 'block'],
  ['nav', 'block'],
  ['ol', 'block'],
  ['p', 'block'],
  ['plaintext', 'block'],
  ['pre', 'block'],
  ['search', 'block'],
  ['section', 'block'],
  ['summary', 'block'],
  ['ul', 'block'],
  ['xmp', 'block'],
  // contents
  ['slot', 'contents'],
  // inline-block
  ['button', 'inline-block'],
  ['input', 'inline-block'],
  ['marquee', 'inline-block'],
  ['select', 'inline-block'],
  // list-item
  ['li', 'list-item'],
  // none
  ['area', 'none'],
  ['base', 'none'],
  ['basefont', 'none'],
  ['datalist', 'none'],
  ['head', 'none'],
  ['link', 'none'],
  ['meta', 'none'],
  ['noembed', 'none'],
  ['noframes', 'none'],
  ['param', 'none'],
  ['rp', 'none'],
  ['script', 'none'],
  ['style', 'none'],
  ['template', 'none'],
  ['title', 'none'],
  // ruby
  ['ruby', 'ruby'],
  // ruby-text
  ['rt', 'ruby-text'],
  // table
  ['table', 'table'],
  // table-caption
  ['caption', 'table-caption'],
  // table-cell
  ['td', 'table-cell'],
  ['th', 'table-cell'],
  // table-column
  ['col', 'table-column'],
  // table-column-group
  ['colgroup', 'table-column-group'],
  // table-footer-group
  ['tfoot', 'table-footer-group'],
  // table-header-group
  ['thead', 'table-header-group'],
  // table-row
  ['tr', 'table-row'],
  // table-row-group
  ['tbody', 'table-row-group'],
]);

/**
 * Get the default CSS `display` value for an HTML element.
 * Returns `'inline'` for unknown or custom elements.
 */
export function getElementDisplay(tagName: string): CssDisplay {
  return ELEMENT_DISPLAY.get(tagName.toLowerCase()) ?? 'inline';
}

/**
 * Whether an element has an inline default display value
 * (`inline`, `inline-block`, or `inline-flex`).
 * Unknown and custom elements return `true` (conservative default).
 */
export function isInlineElement(tagName: string): boolean {
  const display = getElementDisplay(tagName);
  return display === 'inline' || display === 'inline-block' || display === 'inline-flex';
}
