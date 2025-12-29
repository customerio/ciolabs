import {
  parseDocument,
  SourceDocument,
  SourceElement,
  Options,
  DomUtils,
  nodeToString,
  SourceText,
} from '@ciolabs/htmlparser2-source';
import { select } from 'cheerio-select';
import escapeHtml from 'escape-html';
import { decode } from 'html-entities';

import * as AstManipulator from './ast-manipulator';
import { AstUpdater } from './ast-updater';
import { getContentStart, getContentEnd, makeClosingTag, isSelfClosing, hasTrailingSlash } from './element-utils';
import { calculateRemoveDelta, type PositionDelta } from './position-delta';
import { atomicOverwrite, atomicAppendRight, atomicPrependLeft, atomicRemove } from './string-operations';

export type HtmlModOptions = Options & {
  HtmlModElement?: typeof HtmlModElement; // allow for custom HtmlModElement
};

export class HtmlMod {
  __source: string;
  __dom: SourceDocument;
  __flushed = true; // Always true with auto-flush - AST is always synchronized
  __HtmlMod: typeof HtmlMod;
  __HtmlModElement: typeof HtmlModElement;
  __HtmlModText: typeof HtmlModText;
  __options: HtmlModOptions;
  __astUpdater: AstUpdater;
  __cachedInnerHTML: WeakMap<SourceElement, string> = new WeakMap();
  __cachedOuterHTML: WeakMap<SourceElement, string> = new WeakMap();

  constructor(source: string, options?: HtmlModOptions) {
    this.__source = source;
    this.__options = {
      recognizeSelfClosing: true,
      ...options,
    };
    this.__dom = parseDocument(source, this.__options);
    this.__flushed = true;
    this.__HtmlModElement = options?.HtmlModElement || HtmlModElement;
    this.__HtmlModText = HtmlModText;
    this.__HtmlMod = HtmlMod;
    this.__astUpdater = new AstUpdater();
  }

  /**
   * Direct string manipulation methods (replacing MagicString)
   * Public but marked with __ to indicate internal use
   */
  __overwrite(start: number, end: number, content: string): void {
    this.__source = this.__source.slice(0, start) + content + this.__source.slice(end);
  }

  __appendRight(index: number, content: string): void {
    this.__source = this.__source.slice(0, index) + content + this.__source.slice(index);
  }

  __prependLeft(index: number, content: string): void {
    this.__source = this.__source.slice(0, index) + content + this.__source.slice(index);
  }

  __remove(start: number, end: number): void {
    this.__source = this.__source.slice(0, start) + this.__source.slice(end);
  }

  /**
   * Track a delta and immediately update AST positions
   * With direct string manipulation, we don't need to recreate anything!
   */
  __trackDelta(delta: PositionDelta, affectedElement?: SourceElement) {
    // Apply delta to AST positions immediately
    if (affectedElement) {
      // Targeted update - only update affected subtrees (ancestors + descendants + following siblings)
      this.__astUpdater.updateFromElement(affectedElement, this.__dom, delta);
    } else {
      // Full tree walk fallback (for operations without element context like trim())
      this.__astUpdater.updateNodePositions(this.__dom, delta);
    }
    // Note: __source is already up-to-date from string operations
  }

  /**
   * Ensure AST is synchronized (no-op since we update immediately)
   * Kept for API compatibility
   */
  __ensureFlushed() {
    // No-op: source is always up-to-date with direct string manipulation
  }

  trim() {
    const beforeSource = this.__source;
    const afterSource = beforeSource.trim();
    this.__source = afterSource;

    // Queue deltas for removed characters
    const trimmedTotal = beforeSource.length - afterSource.length;
    if (trimmedTotal > 0) {
      const trimmedStart = beforeSource.length - beforeSource.trimStart().length;
      const trimmedEnd = trimmedTotal - trimmedStart;

      if (trimmedStart > 0) {
        this.__trackDelta(calculateRemoveDelta(0, trimmedStart));
      }
      if (trimmedEnd > 0) {
        this.__trackDelta(calculateRemoveDelta(beforeSource.length - trimmedEnd, beforeSource.length));
      }
    }

    return this;
  }

  trimStart() {
    const beforeSource = this.__source;
    const afterSource = beforeSource.trimStart();
    this.__source = afterSource;

    // Queue delta for removed characters at start
    const trimmed = beforeSource.length - afterSource.length;
    if (trimmed > 0) {
      this.__trackDelta(calculateRemoveDelta(0, trimmed));
    }

    return this;
  }

  trimEnd() {
    const beforeSource = this.__source;
    const afterSource = beforeSource.trimEnd();
    this.__source = afterSource;

    // Queue delta for removed characters at end
    const trimmed = beforeSource.length - afterSource.length;
    if (trimmed > 0) {
      this.__trackDelta(calculateRemoveDelta(beforeSource.length - trimmed, beforeSource.length));
    }

    return this;
  }

  trimLines() {
    const beforeSource = this.__source;
    const beforeLines = beforeSource.split('\n');

    let trimmedStartLines = 0;
    for (const beforeLine of beforeLines) {
      if (beforeLine.trim() === '') {
        trimmedStartLines++;
      } else {
        break;
      }
    }

    let trimmedEndLines = 0;
    for (let index = beforeLines.length - 1; index >= 0; index--) {
      if (beforeLines[index].trim() === '' && index > trimmedStartLines) {
        trimmedEndLines++;
      } else {
        break;
      }
    }

    // Apply trimming to source
    if (trimmedStartLines > 0 || trimmedEndLines > 0) {
      const keepLines = beforeLines.slice(trimmedStartLines, beforeLines.length - trimmedEndLines);
      this.__source = keepLines.join('\n');
    }

    // Track deltas
    if (trimmedStartLines > 0) {
      const trimmedChars = beforeLines.slice(0, trimmedStartLines).join('\n').length + 1; // +1 for final newline
      this.__trackDelta(calculateRemoveDelta(0, trimmedChars));
    }

    if (trimmedEndLines > 0) {
      const startPos = beforeLines.slice(0, beforeLines.length - trimmedEndLines).join('\n').length;
      this.__trackDelta(calculateRemoveDelta(startPos, beforeSource.length));
    }

    return this;
  }

  isEmpty() {
    return this.__source.length === 0;
  }

  /**
   * Check if the AST is synchronized with the string state.
   *
   * @deprecated This always returns `true` in the experimental auto-flush implementation.
   * The AST is automatically kept synchronized after every modification, so manual
   * flushing is never needed. This method exists only for API compatibility.
   */
  isFlushed() {
    return true;
  }

  toString() {
    this.__ensureFlushed();

    if (this.__options.autofix) {
      return nodeToString(parseDocument(this.__source, this.__options));
    }

    return this.__source;
  }

  clone() {
    this.__ensureFlushed();
    return new HtmlMod(this.__source);
  }

  flush(_source?: string) {
    // No-op in experimental auto-flush version - AST is always synchronized
    // Kept for backwards compatibility
    return this;
  }

  querySelector(selector: string): HtmlModElement | null {
    this.__ensureFlushed();
    const result = select(selector, this.__dom)?.[0];
    if (!result) {
      return null;
    }

    return new this.__HtmlModElement(result as unknown as SourceElement, this);
  }

  querySelectorAll(selector: string): HtmlModElement[] {
    this.__ensureFlushed();
    return select(selector, this.__dom).map(element => {
      return new this.__HtmlModElement(element as unknown as SourceElement, this);
    });
  }
}

export class HtmlModElement {
  __element: SourceElement;
  __htmlMod: HtmlMod;
  __isClone = false;
  __removed = false;

  constructor(element: SourceElement, htmlModule: HtmlMod) {
    this.__element = element;
    this.__htmlMod = htmlModule;
  }

  get sourceRange() {
    this.__htmlMod.__ensureFlushed();
    const startIndex = this.__element.source.openTag.startIndex;
    const endIndex = this.__element.source.closeTag?.endIndex ?? this.__element.endIndex + 1;
    const html = this.__htmlMod.__source;

    // count the lines before this element
    const startLines: string[] = html.slice(0, Math.max(0, startIndex)).split(/\n/);
    const startLineNumber = startLines.length;
    // count the characters before this element on the start line
    const startColumn = startLines.at(-1)!.length + 1; // add one for the space

    // count the lines before the end of element
    const endLines = html.slice(0, Math.max(0, endIndex)).split(/\n/);
    const endLineNumber = endLines.length;
    // count the characters before the end of element on the last line
    const endColumn = endLines.at(-1)!.length + 1; // add one for the space

    return {
      startLineNumber,
      startColumn,
      endLineNumber,
      endColumn,
    };
  }

  get tagName() {
    this.__htmlMod.__ensureFlushed();
    return this.__element.tagName;
  }

  set tagName(tagName: string) {
    if (!this.__element.endIndex) {
      return;
    }

    tagName = tagName.toLowerCase();

    const currentTagName = this.__element.tagName;

    const openTagStart = this.__element.source.openTag.startIndex + 1;
    const openTagEnd = this.__element.source.openTag.startIndex + 1 + currentTagName.length;
    atomicOverwrite(this.__htmlMod, openTagStart, openTagEnd, tagName, this.__element);

    if (this.__element.source.closeTag) {
      const closeTagStart = this.__element.source.closeTag.startIndex + 2;
      const closeTagEnd = this.__element.source.closeTag.startIndex + 2 + currentTagName.length;
      atomicOverwrite(this.__htmlMod, closeTagStart, closeTagEnd, tagName, this.__element);
    }

    AstManipulator.setTagName(this.__element, tagName);
  }

  get id() {
    this.__htmlMod.__ensureFlushed();
    return this.__element.attribs.id ?? '';
  }

  set id(value: string) {
    this.setAttribute('id', value);
  }

  get classList() {
    this.__htmlMod.__ensureFlushed();
    const classes = this.__element.attribs.class ?? '';
    const result: string[] = [];

    // Single loop: split, trim, and filter in one pass
    for (const cls of classes.split(' ')) {
      const trimmed = cls.trim();
      if (trimmed) {
        result.push(trimmed);
      }
    }

    return result;
  }

  get className() {
    this.__htmlMod.__ensureFlushed();
    return this.__element.attribs.class ?? '';
  }

  set className(value: string) {
    this.setAttribute('class', value);
  }

  get dataset(): DOMStringMap {
    return new Proxy(
      {},
      {
        get: (_target, prop: string) => {
          if (typeof prop !== 'string') return;
          const attributeName = `data-${camelToKebab(prop)}`;
          return this.getAttribute(attributeName);
        },

        set: (_target, prop: string, value: string) => {
          if (typeof prop !== 'string') return false;
          const attributeName = `data-${camelToKebab(prop)}`;
          this.setAttribute(attributeName, String(value));
          return true;
        },

        deleteProperty: (_target, prop: string) => {
          if (typeof prop !== 'string') return false;
          const attributeName = `data-${camelToKebab(prop)}`;
          this.removeAttribute(attributeName);
          return true;
        },

        has: (_target, prop: string) => {
          if (typeof prop !== 'string') return false;
          const attributeName = `data-${camelToKebab(prop)}`;
          return this.hasAttribute(attributeName);
        },

        ownKeys: _target => {
          // Return all data-* attributes as camelCase
          return this.getAttributeNames()
            .filter(name => name.startsWith('data-'))
            .map(name => kebabToCamel(name.slice(5))); // Remove 'data-' prefix
        },

        getOwnPropertyDescriptor: (_target, prop: string) => {
          if (typeof prop !== 'string') return;
          const attributeName = `data-${camelToKebab(prop)}`;
          if (!this.hasAttribute(attributeName)) return;

          return {
            configurable: true,
            enumerable: true,
            value: this.getAttribute(attributeName),
            writable: true,
          };
        },
      }
    );
  }

  get attributes() {
    this.__htmlMod.__ensureFlushed();
    return this.__element.source.attributes.map(attribute => {
      return {
        name: attribute.name.data,
        value: unescapeQuote(attribute.value?.data, attribute.quote ?? null),
      };
    });
  }

  get innerHTML() {
    this.__htmlMod.__ensureFlushed();
    // Check if innerHTML is cached (element was removed/replaced)
    const cached = this.__htmlMod.__cachedInnerHTML.get(this.__element);
    if (cached !== undefined) {
      return cached;
    }

    if (!this.__element.endIndex) {
      return '';
    }

    return this.__htmlMod.__source.slice(
      this.__element.source.openTag.endIndex + 1,
      this.__element?.source?.closeTag?.startIndex ?? this.__element.endIndex
    );
  }

  set innerHTML(html: string) {
    if (!this.__element.endIndex) {
      return;
    }

    const contentStart = getContentStart(this.__element);
    const contentEnd = getContentEnd(this.__element);
    const isEmpty = this.innerHTML.length === 0;
    const selfClosing = isSelfClosing(this.__element);
    const hasSlash = hasTrailingSlash(this.__element, this.__htmlMod.__source);

    const originalContentStart = contentStart;
    const originalContentEnd = contentEnd;
    const originalOpenTagEnd = this.__element.source.openTag.endIndex;

    if (selfClosing) {
      const closingTag = makeClosingTag(this.__element.tagName);
      const combined = html + closingTag;

      if (hasSlash) {
        const slashStart = this.__element.source.openTag.endIndex - 1;
        const tagEnd = this.__element.source.openTag.endIndex + 1;
        atomicOverwrite(this.__htmlMod, slashStart, tagEnd, `>${combined}`, this.__element);
      } else {
        const insertPos = this.__element.source.openTag.endIndex;
        atomicAppendRight(this.__htmlMod, insertPos, combined, this.__element);
      }
    } else if (isEmpty) {
      atomicPrependLeft(this.__htmlMod, contentEnd, html, this.__element);
    } else {
      atomicOverwrite(this.__htmlMod, contentStart, contentEnd, html, this.__element);
    }

    if (html.length > 0) {
      let parsePos: number;
      if (selfClosing) {
        const openTagEnd = hasSlash ? originalOpenTagEnd - 1 : originalOpenTagEnd;
        parsePos = openTagEnd + 1;
      } else if (isEmpty) {
        parsePos = originalContentEnd;
      } else {
        parsePos = originalContentStart;
      }
      const newChildren = AstManipulator.parseHtmlAtPosition(html, parsePos, this.__htmlMod.__options);
      AstManipulator.replaceChildren(this.__element, newChildren);
    } else {
      AstManipulator.replaceChildren(this.__element, []);
    }

    if (selfClosing) {
      const closingTag = makeClosingTag(this.__element.tagName);
      const openTagEnd = hasSlash ? this.__element.source.openTag.endIndex - 1 : this.__element.source.openTag.endIndex;

      if (html.length > 0) {
        const closeTagStart = openTagEnd + 1 + html.length;
        const closeTagEnd = closeTagStart + closingTag.length - 1;
        AstManipulator.convertToRegularTag(this.__element, openTagEnd, closeTagStart, closeTagEnd);
      } else {
        const closeTagStart = openTagEnd + 1;
        const closeTagEnd = closeTagStart + closingTag.length - 1;
        AstManipulator.convertToRegularTag(this.__element, openTagEnd, closeTagStart, closeTagEnd);
      }
    }
  }

  get textContent() {
    this.__htmlMod.__ensureFlushed();
    const text = DomUtils.textContent(this.__element);

    return decode(text);
  }

  set textContent(text: string) {
    if (!this.__element.endIndex) {
      return;
    }

    this.innerHTML = escapeHtml(text);
  }

  get outerHTML() {
    this.__htmlMod.__ensureFlushed();
    // Check if outerHTML is cached (element was removed/replaced)
    const cached = this.__htmlMod.__cachedOuterHTML.get(this.__element);
    if (cached !== undefined) {
      return cached;
    }

    return this.__htmlMod.__source.slice(
      this.__element.source.openTag.startIndex,
      this.__element.source.closeTag?.endIndex ?? this.__element.endIndex + 1
    );
  }

  get children() {
    return this.__element.children;
  }

  get parent(): HtmlModElement | null {
    this.__htmlMod.__ensureFlushed();
    const { parent } = this.__element;

    if (parent?.type === 'tag') {
      return new this.__htmlMod.__HtmlModElement(parent as unknown as SourceElement, this.__htmlMod);
    }

    return null;
  }

  before(html: string) {
    const insertPos = this.__element.source.openTag.startIndex;

    atomicPrependLeft(this.__htmlMod, insertPos, html, this.__element);

    const newNodes = AstManipulator.parseHtmlAtPosition(html, insertPos, this.__htmlMod.__options);
    AstManipulator.insertBefore(this.__element, newNodes);

    return this;
  }

  after(html: string) {
    const insertPos = this.__element.source.closeTag?.endIndex ?? this.__element.endIndex + 1;

    atomicAppendRight(this.__htmlMod, insertPos, html, this.__element);

    const newNodes = AstManipulator.parseHtmlAtPosition(html, insertPos, this.__htmlMod.__options);
    AstManipulator.insertAfter(this.__element, newNodes);

    return this;
  }

  prepend(html: string) {
    const selfClosing = isSelfClosing(this.__element);
    const hadSlash = hasTrailingSlash(this.__element, this.__htmlMod.__source);
    const originalEndIndex = this.__element.source.openTag.endIndex;

    if (selfClosing) {
      const closingTag = makeClosingTag(this.__element.tagName);

      if (hadSlash) {
        const slashStart = originalEndIndex - 1;
        const gtEnd = originalEndIndex + 1;
        const replacement = `>${html}${closingTag}`;
        atomicOverwrite(this.__htmlMod, slashStart, gtEnd, replacement, this.__element);
      } else {
        const insertPos = originalEndIndex + 1;
        const combined = html + closingTag;
        atomicAppendRight(this.__htmlMod, insertPos, combined, this.__element);
      }
    } else {
      const insertPos = originalEndIndex + 1;
      atomicPrependLeft(this.__htmlMod, insertPos, html, this.__element);
    }

    if (selfClosing) {
      const parsePos = originalEndIndex + 1;
      const openTagEnd = hadSlash ? originalEndIndex - 1 : originalEndIndex;

      const newNodes = AstManipulator.parseHtmlAtPosition(html, parsePos, this.__htmlMod.__options);
      AstManipulator.prependChild(this.__element, newNodes);

      const closingTag = makeClosingTag(this.__element.tagName);
      const closeTagStart = parsePos + html.length;
      const closeTagEnd = closeTagStart + closingTag.length - 1;
      AstManipulator.convertToRegularTag(this.__element, openTagEnd, closeTagStart, closeTagEnd);
    } else {
      const insertPos = originalEndIndex + 1;
      const newNodes = AstManipulator.parseHtmlAtPosition(html, insertPos, this.__htmlMod.__options);
      AstManipulator.prependChild(this.__element, newNodes);
    }

    return this;
  }

  append(html: string) {
    if (isSelfClosing(this.__element)) {
      return this.prepend(html);
    }

    const insertPos = getContentEnd(this.__element);

    atomicAppendRight(this.__htmlMod, insertPos, html, this.__element);

    const newNodes = AstManipulator.parseHtmlAtPosition(html, insertPos, this.__htmlMod.__options);
    AstManipulator.appendChild(this.__element, newNodes);

    return this;
  }

  private __cacheDescendantsInnerHTML() {
    // Cache innerHTML and outerHTML for this element and all descendants
    const cacheNode = (node: SourceElement) => {
      // Only cache if not already cached
      if (!this.__htmlMod.__cachedInnerHTML.has(node)) {
        // Read innerHTML directly from source before it changes
        const innerHTML = this.__htmlMod.__source.slice(
          node.source.openTag.endIndex + 1,
          node?.source?.closeTag?.startIndex ?? node.endIndex
        );
        this.__htmlMod.__cachedInnerHTML.set(node, innerHTML);

        // Also cache outerHTML
        const outerHTML = this.__htmlMod.__source.slice(
          node.source.openTag.startIndex,
          node.source.closeTag?.endIndex ?? node.endIndex + 1
        );
        this.__htmlMod.__cachedOuterHTML.set(node, outerHTML);

        this.__removed = true;
      }

      // Recursively cache children
      if (node.children) {
        for (const child of node.children) {
          if (child.type === 'tag') {
            cacheNode(child as SourceElement);
          }
        }
      }
    };

    cacheNode(this.__element);
  }

  remove() {
    if (this.__removed) {
      return this;
    }

    this.__cacheDescendantsInnerHTML();

    const removeStart = this.__element.source.openTag.startIndex;
    const removeEnd = Math.min(
      this.__element.source.closeTag?.endIndex ?? this.__element.endIndex + 1,
      this.__htmlMod.__source.length
    );

    atomicRemove(this.__htmlMod, removeStart, removeEnd, this.__element);

    AstManipulator.removeNode(this.__element);

    return this;
  }

  replaceWith(html: string) {
    if (this.__removed) {
      return this;
    }

    this.__cacheDescendantsInnerHTML();

    const replaceStart = this.__element.source.openTag.startIndex;
    const replaceEnd = Math.min(
      this.__element.source.closeTag?.endIndex ?? this.__element.endIndex + 1,
      this.__htmlMod.__source.length
    );

    atomicOverwrite(this.__htmlMod, replaceStart, replaceEnd, html, this.__element);

    const newNodes = AstManipulator.parseHtmlAtPosition(html, replaceStart, this.__htmlMod.__options);
    AstManipulator.replaceNode(this.__element, newNodes);

    return this;
  }

  hasAttribute(name: string) {
    return name in this.__element.attribs;
  }

  hasAttributes() {
    return Object.keys(this.__element.attribs).length > 0;
  }

  getAttribute(name: string): string | null {
    const attribute = this.__element.source.attributes.find(a => a.name.data === name);

    const value = this.__element.attribs[name] ?? null;

    if (!value) {
      return value;
    }

    return unescapeQuote(value, attribute?.quote ?? null) ?? null;
  }

  getAttributeNames() {
    return Object.keys(this.__element.attribs);
  }

  setAttribute(name: string, value: string) {
    const attribute = this.__element.source.attributes.find(a => a.name.data === name);

    // Process the value and determine the quote
    const [escapedValue, quoteChar] = processValueAndQuote(attribute?.quote ?? null, value);
    const hasQuote = !!attribute?.quote;

    // Variables to track attribute positions
    let nameStart: number;
    let valueStart: number;
    let sourceStart: number;
    let sourceEnd: number;

    // Track the actual quote character used in the source
    // (may differ from quoteChar due to fallback logic)
    let actualQuoteUsed = quoteChar;

    if (attribute) {
      /**
       * A value is already set, so we need to overwrite it
       */
      if (attribute?.value && attribute.value.startIndex <= attribute.value.endIndex) {
        const overwriteStart = attribute.value?.startIndex + (hasQuote ? -1 : 0);
        const overwriteEnd = attribute.value?.endIndex + 1 + (hasQuote ? 1 : 0);
        const content = `${quoteChar}${escapedValue}${quoteChar}`;

        atomicOverwrite(this.__htmlMod, overwriteStart, overwriteEnd, content, this.__element);

        nameStart = attribute.name.startIndex;
        valueStart = overwriteStart + (quoteChar ? 1 : 0);
        sourceStart = attribute.source.startIndex;
        sourceEnd =
          attribute.source.startIndex +
          (attribute.source.endIndex - attribute.source.startIndex) +
          (content.length - (overwriteEnd - overwriteStart));
      } else if (
        /**
         * The value is empty so we need to add it
         */
        attribute?.value &&
        attribute.value.startIndex > attribute.value.endIndex &&
        attribute.value.data === ''
      ) {
        if (hasQuote) {
          const overwriteStart = attribute.value?.startIndex - 1;
          const overwriteEnd = attribute.value?.endIndex + 2;
          const content = `${quoteChar}${escapedValue}${quoteChar}`;

          atomicOverwrite(this.__htmlMod, overwriteStart, overwriteEnd, content, this.__element);

          nameStart = attribute.name.startIndex;
          valueStart = overwriteStart + (quoteChar ? 1 : 0);
          sourceStart = attribute.source.startIndex;
          sourceEnd =
            attribute.source.startIndex +
            (attribute.source.endIndex - attribute.source.startIndex) +
            (content.length - (overwriteEnd - overwriteStart));
        } else {
          const insertPos = attribute.value.startIndex;
          const content = `${quoteChar}${escapedValue}${quoteChar}`;

          atomicAppendRight(this.__htmlMod, insertPos, content, this.__element);

          nameStart = attribute.name.startIndex;
          valueStart = insertPos + (quoteChar ? 1 : 0);
          sourceStart = attribute.source.startIndex;
          sourceEnd = attribute.source.endIndex + content.length;
        }
      } else {
        actualQuoteUsed = quoteChar || '"';
        const insertPos = attribute.name.endIndex + 1;
        const content = `=${actualQuoteUsed}${escapedValue}${actualQuoteUsed}`;

        atomicAppendRight(this.__htmlMod, insertPos, content, this.__element);

        nameStart = attribute.name.startIndex;
        valueStart = insertPos + 2; // +1 for =, +1 for quote
        sourceStart = attribute.source.startIndex;
        sourceEnd = attribute.source.endIndex + content.length;
      }
    } else {
      /**
       * No attribute is set, so we need to add it
       */
      actualQuoteUsed = quoteChar || '"';
      // Insert before the '>' of the opening tag
      let insertPos = this.__element.source.openTag.endIndex;
      let content = ` ${name}=${actualQuoteUsed}${escapedValue}${actualQuoteUsed}`;

      // For self-closing tags with trailing slash, insert before the '/' and add space after attribute
      if (isSelfClosing(this.__element)) {
        const charBeforeGt = this.__htmlMod.__source.charAt(insertPos - 1);
        if (charBeforeGt === '/') {
          // Check if there's already a space before the '/'
          const charBeforeSlash = this.__htmlMod.__source.charAt(insertPos - 2);
          if (charBeforeSlash === ' ') {
            // There's already a space, don't add another leading space
            content = `${name}=${actualQuoteUsed}${escapedValue}${actualQuoteUsed} `;
            insertPos = insertPos - 1; // Insert before the '/'
          } else {
            // No space before '/', keep the leading space and add trailing space
            content = ` ${name}=${actualQuoteUsed}${escapedValue}${actualQuoteUsed} `;
            insertPos = insertPos - 1; // Insert before the '/'
          }
        }
      }

      atomicPrependLeft(this.__htmlMod, insertPos, content, this.__element);

      // Positions are calculated relative to where content is inserted
      // prependLeft inserts BEFORE insertPos, so content starts at insertPos
      const contentStart = insertPos;
      const hasLeadingSpace = content.startsWith(' ');
      const hasTrailingSpace = content.endsWith(' ');

      nameStart = contentStart + (hasLeadingSpace ? 1 : 0);
      valueStart = nameStart + name.length + 2; // +1 for =, +1 for quote
      sourceStart = contentStart + (hasLeadingSpace ? 1 : 0);
      // sourceEnd should point to the LAST character of the attribute (inclusive), not past it
      sourceEnd = contentStart + content.length - 1 - (hasTrailingSpace ? 1 : 0);
    }

    // 3. Modify AST: Update attribute in element
    // Positions are already correct since they were calculated before the operation
    // Pass escapedValue for source.data (HTML), value for attribs (JavaScript)
    AstManipulator.setAttribute(
      this.__element,
      name,
      escapedValue,
      actualQuoteUsed as '"' | "'" | null,
      nameStart,
      valueStart,
      sourceStart,
      sourceEnd,
      value // unescaped value for attribs
    );

    return this;
  }

  toggleAttribute(name: string, force?: boolean) {
    if (force === true) {
      this.setAttribute(name, '');
    } else if (force === false) {
      this.removeAttribute(name);
    } else {
      if (this.hasAttribute(name)) {
        this.removeAttribute(name);
      } else {
        this.setAttribute(name, '');
      }
    }

    return this;
  }

  removeAttribute(name: string) {
    for (const attribute of this.__element.source.attributes) {
      if (attribute.name.data !== name) {
        continue;
      }

      // Always remove the space before the attribute
      const removeStart = attribute.source.startIndex - 1;
      const removeEnd = attribute.source.endIndex + 1;

      atomicRemove(this.__htmlMod, removeStart, removeEnd, this.__element);
    }

    // 3. Modify AST: Remove attribute from element
    AstManipulator.removeAttribute(this.__element, name);

    return this;
  }

  querySelector(selector: string): HtmlModElement | null {
    this.__htmlMod.__ensureFlushed();
    const result = select(selector, this.__element)?.[0] ?? null;
    if (!result) {
      return null;
    }

    return new this.__htmlMod.__HtmlModElement(result as unknown as SourceElement, this.__htmlMod);
  }

  querySelectorAll(selector: string): HtmlModElement[] {
    this.__htmlMod.__ensureFlushed();
    return select(selector, this.__element).map(element => {
      return new this.__htmlMod.__HtmlModElement(element as unknown as SourceElement, this.__htmlMod);
    });
  }

  toString() {
    if (this.__isClone) {
      return this.__htmlMod.toString();
    }

    return this.outerHTML;
  }

  clone() {
    const HtmlModule = this.__htmlMod.__HtmlMod;

    const clone = new HtmlModule(this.outerHTML).querySelector('*') as this;
    if (clone) {
      clone.__isClone = true;
    }

    return clone;
  }
}

export class HtmlModText {
  __text: SourceText;
  __htmlMod: HtmlMod;

  constructor(text: SourceText, htmlModule: HtmlMod) {
    this.__text = text;
    this.__htmlMod = htmlModule;
  }

  get textContent() {
    this.__htmlMod.__ensureFlushed();
    return decode(this.__text.data);
  }

  get innerHTML() {
    this.__htmlMod.__ensureFlushed();
    return this.__text.data;
  }

  set innerHTML(html: string) {
    if (!this.__text.endIndex) {
      return;
    }

    const originalStart = this.__text.startIndex;
    atomicOverwrite(this.__htmlMod, originalStart, this.__text.endIndex + 1, html);

    // Modify AST: Update text node data
    AstManipulator.setTextData(this.__text, html);

    // Manually update endIndex - text node is inside the overwritten region
    this.__text.endIndex = originalStart + html.length - 1;
  }

  set textContent(text: string) {
    if (!this.__text.endIndex) {
      return;
    }

    const escapedText = escapeHtml(text);
    const originalStart = this.__text.startIndex;
    atomicOverwrite(this.__htmlMod, originalStart, this.__text.endIndex + 1, escapedText);

    // Modify AST: Update text node data
    AstManipulator.setTextData(this.__text, escapedText);

    // Manually update endIndex - text node is inside the overwritten region
    this.__text.endIndex = originalStart + escapedText.length - 1;
  }

  toString() {
    return this.__text.data;
  }
}

function processValueAndQuote(quote: '"' | "'" | null, value: string) {
  //  " ' ` = < > or whitespace then we need to use quotes
  const valueNeedsQuotes = /[\s"'<=>`]/.test(value);

  // If no quotes are needed we return the value as is
  if (!valueNeedsQuotes) {
    return [value, quote || ''];
  }

  // If the attribute has single quotes and the value only contains single quotes,
  // we flip the quotes to double quotes
  if ((quote === "'" || !quote) && value.includes("'") && !value.includes('"')) {
    return [value, '"'];
  }

  // If the attribute has double quotes and the value only contains double quotes,
  // we flip the quotes to single quotes
  if ((quote === '"' || !quote) && value.includes('"') && !value.includes("'")) {
    return [value, "'"];
  }

  // For mixed quotes content, we need to escape
  return [quote === "'" ? value.replaceAll("'", '&#39;') : value.replaceAll('"', '&quot;'), quote || '"'];
}

function unescapeQuote(value: string | undefined, quote: '"' | "'" | null) {
  if (!value) return value;
  return quote === "'" ? value.replaceAll('&#39;', "'") : value.replaceAll('&quot;', '"');
}

// Helper to convert camelCase to kebab-case
function camelToKebab(string_: string): string {
  return string_.replaceAll(/([A-Z])/g, '-$1').toLowerCase();
}

// Helper to convert kebab-case to camelCase
function kebabToCamel(string_: string): string {
  return string_.replaceAll(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}
