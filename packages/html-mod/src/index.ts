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
import MagicString from 'magic-string';
import { AstUpdater } from './ast-updater.js';
import { calculateOverwriteDelta, calculateAppendRightDelta, calculatePrependLeftDelta, calculateRemoveDelta, type PositionDelta } from './position-delta.js';
import * as AstManipulator from './ast-manipulator.js';

export type HtmlModOptions = Options & {
  HtmlModElement?: typeof HtmlModElement; // allow for custom HtmlModElement
};

export class HtmlMod {
  __source: string;
  __s: MagicString;
  __dom: SourceDocument;
  __flushed = false;
  __HtmlMod: typeof HtmlMod;
  __HtmlModElement: typeof HtmlModElement;
  __HtmlModText: typeof HtmlModText;
  __options: HtmlModOptions;
  __astUpdater: AstUpdater;
  __pendingDeltas: PositionDelta[] = [];
  __cachedInnerHTML: WeakMap<SourceElement, string> = new WeakMap();
  __cachedOuterHTML: WeakMap<SourceElement, string> = new WeakMap();

  constructor(source: string, options?: HtmlModOptions) {
    this.__source = source;
    this.__options = {
      recognizeSelfClosing: true,
      ...options,
    };
    this.__s = new MagicString(source);
    this.__dom = parseDocument(source, this.__options);
    this.__flushed = true;
    this.__HtmlModElement = options?.HtmlModElement || HtmlModElement;
    this.__HtmlModText = HtmlModText;
    this.__HtmlMod = HtmlMod;
    this.__astUpdater = new AstUpdater();
  }

  /**
   * Apply all pending deltas at end of operation
   * This updates AST positions, refreshes source, and creates fresh MagicString
   */
  __finishOperation() {
    if (this.__pendingDeltas.length === 0) {
      return;
    }

    // Apply all deltas to AST positions
    for (const delta of this.__pendingDeltas) {
      this.__astUpdater.updateNodePositions(this.__dom, delta);
    }

    // Update source and create fresh MagicString with current state
    this.__source = this.__s.toString();
    this.__s = new MagicString(this.__source);

    // Clear pending deltas
    this.__pendingDeltas = [];
    this.__flushed = true;
  }

  trim(charType?: Parameters<typeof MagicString.prototype.trim>[0]) {
    // 1. Calculate what will be trimmed
    const beforeSource = this.__source;
    this.__s.trim(charType);

    // 2. Queue deltas for removed characters
    const trimmedStart = beforeSource.length - beforeSource.trimStart().length;
    const trimmedEnd = beforeSource.length - beforeSource.trimEnd().length;

    if (trimmedStart > 0) {
      this.__pendingDeltas.push(calculateRemoveDelta(0, trimmedStart));
    }
    if (trimmedEnd > 0) {
      this.__pendingDeltas.push(calculateRemoveDelta(beforeSource.length - trimmedEnd, beforeSource.length));
    }

    // 3. No AST structure changes for trim operations

    // 4. Apply deltas and refresh
    this.__finishOperation();

    return this;
  }

  trimStart(charType?: Parameters<typeof MagicString.prototype.trimStart>[0]) {
    // 1. Calculate what will be trimmed
    const beforeSource = this.__source;
    this.__s.trimStart(charType);

    // 2. Queue delta for removed characters at start
    const trimmed = beforeSource.length - beforeSource.trimStart().length;
    if (trimmed > 0) {
      this.__pendingDeltas.push(calculateRemoveDelta(0, trimmed));
    }

    // 3. No AST structure changes for trim operations

    // 4. Apply deltas and refresh
    this.__finishOperation();

    return this;
  }

  trimEnd(charType?: Parameters<typeof MagicString.prototype.trimEnd>[0]) {
    // 1. Calculate what will be trimmed
    const beforeSource = this.__source;
    this.__s.trimEnd(charType);

    // 2. Queue delta for removed characters at end
    const trimmed = beforeSource.length - beforeSource.trimEnd().length;
    if (trimmed > 0) {
      this.__pendingDeltas.push(calculateRemoveDelta(beforeSource.length - trimmed, beforeSource.length));
    }

    // 3. No AST structure changes for trim operations

    // 4. Apply deltas and refresh
    this.__finishOperation();

    return this;
  }

  trimLines() {
    // 1. Calculate what will be trimmed
    const beforeSource = this.__source;
    this.__s.trimLines();

    // 2. Calculate deltas by comparing before/after
    // trimLines removes empty lines from start and end
    const beforeLines = beforeSource.split('\n');

    let trimmedStartLines = 0;
    for (let i = 0; i < beforeLines.length; i++) {
      if (beforeLines[i].trim() === '') {
        trimmedStartLines++;
      } else {
        break;
      }
    }

    let trimmedEndLines = 0;
    for (let i = beforeLines.length - 1; i >= 0; i--) {
      if (beforeLines[i].trim() === '' && i > trimmedStartLines) {
        trimmedEndLines++;
      } else {
        break;
      }
    }

    if (trimmedStartLines > 0) {
      const trimmedChars = beforeLines.slice(0, trimmedStartLines).join('\n').length + 1; // +1 for final newline
      this.__pendingDeltas.push(calculateRemoveDelta(0, trimmedChars));
    }

    if (trimmedEndLines > 0) {
      const startPos = beforeLines.slice(0, beforeLines.length - trimmedEndLines).join('\n').length;
      this.__pendingDeltas.push(calculateRemoveDelta(startPos, beforeSource.length));
    }

    // 3. No AST structure changes for trim operations

    // 4. Apply deltas and refresh
    this.__finishOperation();

    return this;
  }
  isEmpty() {
    return this.__s.isEmpty();
  }
  isFlushed() {
    return this.__flushed;
  }
  generateDecodedMap(options?: Parameters<typeof MagicString.prototype.generateDecodedMap>[0]) {
    return this.__s.generateDecodedMap(options);
  }
  generateMap(options?: Parameters<typeof MagicString.prototype.generateMap>[0]) {
    return this.__s.generateMap(options);
  }
  toString() {
    if (this.__options.autofix) {
      return nodeToString(parseDocument(this.__s.toString(), this.__options));
    }

    return this.__s.toString();
  }
  clone() {
    return new HtmlMod(this.__s.toString());
  }

  flush(source?: string) {
    this.__source = source ?? this.__s.toString();
    this.__s = new MagicString(this.__source);
    this.__dom = parseDocument(this.__source, this.__options);
    this.__flushed = true;

    return this;
  }

  querySelector(selector: string): HtmlModElement | null {
    const result = select(selector, this.__dom)?.[0];
    if (!result) {
      return null;
    }

    return new this.__HtmlModElement(result as unknown as SourceElement, this);
  }

  querySelectorAll(selector: string): HtmlModElement[] {
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
    return this.__element.tagName;
  }

  set tagName(tagName: string) {
    if (!this.__element.endIndex) {
      return;
    }

    tagName = tagName.toLowerCase();

    const currentTagName = this.__element.tagName;

    // 1. Do ALL MagicString operations and 2. Queue ALL deltas

    // Override the opening tag
    const openTagStart = this.__element.source.openTag.startIndex + 1;
    const openTagEnd = this.__element.source.openTag.startIndex + 1 + currentTagName.length;
    this.__htmlMod.__s.overwrite(openTagStart, openTagEnd, tagName);
    this.__htmlMod.__pendingDeltas.push(calculateOverwriteDelta(openTagStart, openTagEnd, tagName));

    // Override the closing tag
    if (this.__element.source.closeTag) {
      const closeTagStart = this.__element.source.closeTag.startIndex + 2;
      const closeTagEnd = this.__element.source.closeTag.startIndex + 2 + currentTagName.length;
      this.__htmlMod.__s.overwrite(closeTagStart, closeTagEnd, tagName);
      this.__htmlMod.__pendingDeltas.push(calculateOverwriteDelta(closeTagStart, closeTagEnd, tagName));
    }

    // 3. Modify AST: Update element tag name
    AstManipulator.setTagName(this.__element, tagName);

    // 4. Apply deltas and refresh
    this.__htmlMod.__finishOperation();
  }

  get id() {
    return this.__element.attribs.id ?? '';
  }

  get classList() {
    const classList = (this.__element.attribs.class ?? '').split(' ').map((c: string) => c.trim());

    // compact
    return classList.filter((c: string) => Boolean(c.trim()));
  }

  get className() {
    return this.__element.attribs.class ?? '';
  }

  get attributes() {
    return this.__element.source.attributes.map(attribute => {
      return {
        name: attribute.name.data,
        value: unescapeQuote(attribute.value?.data, attribute.quote ?? null),
      };
    });
  }

  get innerHTML() {
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

    const contentStart = this.__element.source.openTag.endIndex + 1;
    const contentEnd = this.__element?.source?.closeTag?.startIndex ?? this.__element.endIndex;
    const isEmpty = this.innerHTML.length === 0;
    const isSelfClosing = this.__element.source.openTag.isSelfClosing;
    const hasSlash = isSelfClosing && this.__htmlMod.__source.charAt(this.__element.source.openTag.endIndex - 1) === '/';

    // Save original positions for parse position calculation
    const originalContentStart = contentStart;
    const originalContentEnd = contentEnd;
    const originalOpenTagEnd = this.__element.source.openTag.endIndex;

    // 1. All MagicString operations
    if (isSelfClosing) {
      // Handle self-closing tag conversion
      const closingTag = `</${this.__element.tagName}>`;
      const combined = html + closingTag;

      if (hasSlash) {
        // Overwrite '/>' with '>content</div>'
        const slashStart = this.__element.source.openTag.endIndex - 1;
        const tagEnd = this.__element.source.openTag.endIndex + 1; // After the '>'
        this.__htmlMod.__s.overwrite(slashStart, tagEnd, `>${combined}`);
        this.__htmlMod.__pendingDeltas.push(calculateOverwriteDelta(slashStart, tagEnd, `>${combined}`));
      } else {
        // No slash, just append after the '>'
        const insertPos = this.__element.source.openTag.endIndex;
        this.__htmlMod.__s.appendRight(insertPos, combined);
        this.__htmlMod.__pendingDeltas.push(calculateAppendRightDelta(insertPos, combined));
      }
    } else if (isEmpty) {
      // When empty (not self-closing), use prependLeft at contentEnd to shift the closeTag
      this.__htmlMod.__s.prependLeft(contentEnd, html);
      this.__htmlMod.__pendingDeltas.push(calculatePrependLeftDelta(contentEnd, html));
    } else {
      // Normal case: overwrite existing content
      this.__htmlMod.__s.overwrite(contentStart, contentEnd, html);
      this.__htmlMod.__pendingDeltas.push(calculateOverwriteDelta(contentStart, contentEnd, html));
    }

    // 3. Finish operation FIRST (apply deltas to existing AST and refresh)
    this.__htmlMod.__finishOperation();

    // 4. After deltas applied, parse and add new content to AST
    if (html.length > 0) {
      // Calculate parse position - use ORIGINAL positions since content was inserted there
      let parsePos: number;
      if (isSelfClosing) {
        // After overwrite, '>' is at endIndex-1 (if had slash) or endIndex (if no slash)
        const openTagEnd = hasSlash ? originalOpenTagEnd - 1 : originalOpenTagEnd;
        parsePos = openTagEnd + 1; // Content starts after '>'
      } else if (isEmpty) {
        // After prependLeft, content is at the ORIGINAL contentEnd position
        parsePos = originalContentEnd;
      } else {
        // After overwrite, content is at the ORIGINAL contentStart position
        parsePos = originalContentStart;
      }
      const newChildren = AstManipulator.parseHtmlAtPosition(html, parsePos, this.__htmlMod.__options);
      AstManipulator.replaceChildren(this.__element, newChildren);
    } else {
      AstManipulator.replaceChildren(this.__element, []);
    }

    // 5. After position updates, convert self-closing to regular tag
    if (isSelfClosing) {
      const closingTag = `</${this.__element.tagName}>`;

      // Calculate positions based on the updated source
      // After overwrite, the '>' is at position endIndex-1 (where '/' was) if there was a slash
      const openTagEnd = hasSlash
        ? this.__element.source.openTag.endIndex - 1  // The new '>' is where the '/' was
        : this.__element.source.openTag.endIndex;     // '>' position unchanged

      if (html.length > 0) {
        const closeTagStart = openTagEnd + 1 + html.length;
        const closeTagEnd = closeTagStart + closingTag.length - 1; // Inclusive end
        AstManipulator.convertToRegularTag(this.__element, openTagEnd, closeTagStart, closeTagEnd);
      } else {
        const closeTagStart = openTagEnd + 1;
        const closeTagEnd = closeTagStart + closingTag.length - 1; // Inclusive end
        AstManipulator.convertToRegularTag(this.__element, openTagEnd, closeTagStart, closeTagEnd);
      }
    }
  }

  get textContent() {
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

  get children(): (HtmlModElement | HtmlModText)[] {
    return this.__element.children.map(child => {
      if (child.type === 'text') {
        return new this.__htmlMod.__HtmlModText(child as unknown as SourceText, this.__htmlMod);
      } else if (child.type === 'tag') {
        return new this.__htmlMod.__HtmlModElement(child as unknown as SourceElement, this.__htmlMod);
      }
      // For other node types (comments, etc.), skip them for now
      return null;
    }).filter((child): child is HtmlModElement | HtmlModText => child !== null);
  }

  get parent(): HtmlModElement | null {
    const { parent } = this.__element;

    if (parent?.type === 'tag') {
      return new this.__htmlMod.__HtmlModElement(parent as unknown as SourceElement, this.__htmlMod);
    }

    return null;
  }

  before(html: string) {
    const insertPos = this.__element.source.openTag.startIndex;

    // 1. Do MagicString operation
    this.__htmlMod.__s.prependLeft(insertPos, html);

    // 2. Queue delta
    this.__htmlMod.__pendingDeltas.push(calculatePrependLeftDelta(insertPos, html));

    // 3. Apply deltas first
    this.__htmlMod.__finishOperation();

    // 4. Parse and insert nodes AFTER deltas are applied
    const newNodes = AstManipulator.parseHtmlAtPosition(html, insertPos, this.__htmlMod.__options);
    AstManipulator.insertBefore(this.__element, newNodes);

    return this;
  }

  after(html: string) {
    const insertPos = this.__element.source.closeTag?.endIndex ?? this.__element.endIndex + 1;

    // 1. Do MagicString operation
    this.__htmlMod.__s.appendRight(insertPos, html);

    // 2. Queue delta
    this.__htmlMod.__pendingDeltas.push(calculateAppendRightDelta(insertPos, html));

    // 3. Apply deltas first
    this.__htmlMod.__finishOperation();

    // 4. Parse and insert nodes AFTER deltas are applied
    const newNodes = AstManipulator.parseHtmlAtPosition(html, insertPos, this.__htmlMod.__options);
    AstManipulator.insertAfter(this.__element, newNodes);

    return this;
  }

  prepend(html: string) {
    const isSelfClosing = this.__element.source.openTag.isSelfClosing;
    const hadSlash = isSelfClosing && this.__htmlMod.__source.charAt(this.__element.source.openTag.endIndex - 1) === '/';

    // Save original endIndex before operations
    const originalEndIndex = this.__element.source.openTag.endIndex;

    // Handle self-closing tag conversion
    if (isSelfClosing) {
      const closingTag = `</${this.__element.tagName}>`;

      if (hadSlash) {
        // Overwrite '/>' with '>' + content + closing tag
        const slashStart = originalEndIndex - 1;
        const gtEnd = originalEndIndex + 1;
        const replacement = `>${html}${closingTag}`;
        this.__htmlMod.__s.overwrite(slashStart, gtEnd, replacement);
        this.__htmlMod.__pendingDeltas.push(calculateOverwriteDelta(slashStart, gtEnd, replacement));
      } else {
        // No slash, just append after '>'
        const insertPos = originalEndIndex + 1;
        const combined = html + closingTag;
        this.__htmlMod.__s.appendRight(insertPos, combined);
        this.__htmlMod.__pendingDeltas.push(calculateAppendRightDelta(insertPos, combined));
      }
    } else {
      // Regular tag - prepend content
      const insertPos = originalEndIndex + 1;
      this.__htmlMod.__s.prependLeft(insertPos, html);
      this.__htmlMod.__pendingDeltas.push(calculatePrependLeftDelta(insertPos, html));
    }

    // Apply deltas first
    this.__htmlMod.__finishOperation();

    // Now parse and add children to AST (using original positions)
    if (isSelfClosing) {
      // For self-closing, content starts after the '>'
      const parsePos = originalEndIndex + 1;
      const openTagEnd = hadSlash ? originalEndIndex - 1 : originalEndIndex;

      const newNodes = AstManipulator.parseHtmlAtPosition(html, parsePos, this.__htmlMod.__options);
      AstManipulator.prependChild(this.__element, newNodes);

      // Convert to regular tag
      const closingTag = `</${this.__element.tagName}>`;
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
    /**
     * If the element is self closing, it's the same as prepend
     */
    if (this.__element.source.openTag.isSelfClosing) {
      return this.prepend(html);
    }

    const insertPos = this.__element?.source?.closeTag?.startIndex ?? this.__element.endIndex;

    // 1. Do MagicString operation
    this.__htmlMod.__s.appendRight(insertPos, html);

    // 2. Queue delta
    this.__htmlMod.__pendingDeltas.push(calculateAppendRightDelta(insertPos, html));

    // 3. Apply deltas first
    this.__htmlMod.__finishOperation();

    // 4. Parse and append nodes AFTER deltas are applied
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
    // If already removed, do nothing
    if (this.__removed) {
      return this;
    }

    // Cache innerHTML for this element and all descendants before removal
    this.__cacheDescendantsInnerHTML();

    const removeStart = this.__element.source.openTag.startIndex;
    const removeEnd = Math.min(
      this.__element.source.closeTag?.endIndex ?? this.__element.endIndex + 1,
      this.__htmlMod.__source.length
    );

    this.__htmlMod.__s.remove(removeStart, removeEnd);
    this.__htmlMod.__pendingDeltas.push(calculateRemoveDelta(removeStart, removeEnd));

    AstManipulator.removeNode(this.__element);

    this.__htmlMod.__finishOperation();

    return this;
  }

  replaceWith(html: string) {
    // If already removed, do nothing
    if (this.__removed) {
      return this;
    }

    // Cache innerHTML for this element and all descendants before replacement
    this.__cacheDescendantsInnerHTML();

    const replaceStart = this.__element.source.openTag.startIndex;
    const replaceEnd = Math.min(
      this.__element.source.closeTag?.endIndex ?? this.__element.endIndex + 1,
      this.__htmlMod.__source.length
    );

    // 1. Do MagicString operation
    this.__htmlMod.__s.overwrite(replaceStart, replaceEnd, html);

    // 2. Queue delta
    this.__htmlMod.__pendingDeltas.push(calculateOverwriteDelta(replaceStart, replaceEnd, html));

    // 3. Apply deltas first
    this.__htmlMod.__finishOperation();

    // 4. Parse and replace nodes AFTER deltas are applied
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

    // 1. Do ALL MagicString operations and 2. Queue ALL deltas
    if (attribute) {
      /**
       * A value is already set, so we need to overwrite it
       */
      if (attribute?.value && attribute.value.startIndex <= attribute.value.endIndex) {
        const overwriteStart = attribute.value?.startIndex + (hasQuote ? -1 : 0);
        const overwriteEnd = attribute.value?.endIndex + 1 + (hasQuote ? 1 : 0);
        const content = `${quoteChar}${escapedValue}${quoteChar}`;

        this.__htmlMod.__s.overwrite(overwriteStart, overwriteEnd, content);
        this.__htmlMod.__pendingDeltas.push(calculateOverwriteDelta(overwriteStart, overwriteEnd, content));

        nameStart = attribute.name.startIndex;
        valueStart = overwriteStart + (quoteChar ? 1 : 0);
        sourceStart = attribute.source.startIndex;
        sourceEnd = attribute.source.startIndex + (attribute.source.endIndex - attribute.source.startIndex) + (content.length - (overwriteEnd - overwriteStart));
      } else if (
        /**
         * The value is empty so we need to add it
         */
        attribute?.value &&
        attribute.value.startIndex > attribute.value.endIndex &&
        attribute.value.data === ''
      ) {
        // If the empty value is quoted, we need to replace those as well
        if (hasQuote) {
          const overwriteStart = attribute.value?.startIndex - 1;
          const overwriteEnd = attribute.value?.endIndex + 2;
          const content = `${quoteChar}${escapedValue}${quoteChar}`;

          this.__htmlMod.__s.overwrite(overwriteStart, overwriteEnd, content);
          this.__htmlMod.__pendingDeltas.push(calculateOverwriteDelta(overwriteStart, overwriteEnd, content));

          nameStart = attribute.name.startIndex;
          valueStart = overwriteStart + (quoteChar ? 1 : 0);
          sourceStart = attribute.source.startIndex;
          sourceEnd = attribute.source.startIndex + (attribute.source.endIndex - attribute.source.startIndex) + (content.length - (overwriteEnd - overwriteStart));
        } else {
          const insertPos = attribute.value.startIndex;
          const content = `${quoteChar}${escapedValue}${quoteChar}`;

          this.__htmlMod.__s.appendRight(insertPos, content);
          this.__htmlMod.__pendingDeltas.push(calculateAppendRightDelta(insertPos, content));

          nameStart = attribute.name.startIndex;
          valueStart = insertPos + (quoteChar ? 1 : 0);
          sourceStart = attribute.source.startIndex;
          sourceEnd = attribute.source.endIndex + content.length;
        }
      } else {
        /**
         * No value is set, so we need to add it
         */
        const insertPos = attribute.name.endIndex + 1;
        const content = `=${quoteChar || '"'}${escapedValue}${quoteChar || '"'}`;

        this.__htmlMod.__s.appendRight(insertPos, content);
        this.__htmlMod.__pendingDeltas.push(calculateAppendRightDelta(insertPos, content));

        nameStart = attribute.name.startIndex;
        valueStart = insertPos + 1 + (quoteChar || '"' ? 1 : 0);
        sourceStart = attribute.source.startIndex;
        sourceEnd = attribute.source.endIndex + content.length;
      }
    } else {
      /**
       * No attribute is set, so we need to add it
       */
      // Insert before the '>' of the opening tag
      let insertPos = this.__element.source.openTag.endIndex;
      let content = ` ${name}=${quoteChar || '"'}${escapedValue}${quoteChar || '"'}`;

      // For self-closing tags with trailing slash, insert before the '/' and add space after attribute
      const isSelfClosing = this.__element.source.openTag.isSelfClosing;
      if (isSelfClosing) {
        const charBeforeGt = this.__htmlMod.__source.charAt(insertPos - 1);
        if (charBeforeGt === '/') {
          // Check if there's already a space before the '/'
          const charBeforeSlash = this.__htmlMod.__source.charAt(insertPos - 2);
          if (charBeforeSlash === ' ') {
            // There's already a space, don't add another leading space
            content = `${name}=${quoteChar || '"'}${escapedValue}${quoteChar || '"'} `;
            insertPos = insertPos - 1; // Insert before the '/'
          } else {
            // No space before '/', keep the leading space and add trailing space
            content = ` ${name}=${quoteChar || '"'}${escapedValue}${quoteChar || '"'} `;
            insertPos = insertPos - 1; // Insert before the '/'
          }
        }
      }

      this.__htmlMod.__s.prependLeft(insertPos, content);
      this.__htmlMod.__pendingDeltas.push(calculatePrependLeftDelta(insertPos, content));

      // Positions are calculated relative to where content is inserted
      // prependLeft inserts BEFORE insertPos, so content starts at insertPos
      const contentStart = insertPos;
      const hasLeadingSpace = content.startsWith(' ');
      const hasTrailingSpace = content.endsWith(' ');

      nameStart = contentStart + (hasLeadingSpace ? 1 : 0);
      valueStart = nameStart + name.length + 1 + (quoteChar || '"' ? 1 : 0); // +1 for =, +1 for quote
      sourceStart = contentStart + (hasLeadingSpace ? 1 : 0);
      sourceEnd = contentStart + content.length - (hasTrailingSpace ? 1 : 0);
    }

    // 3. Apply deltas first
    this.__htmlMod.__finishOperation();

    // 4. Modify AST: Update attribute in element AFTER deltas are applied
    // Positions are already correct since they were calculated before the operation
    AstManipulator.setAttribute(
      this.__element,
      name,
      value,
      quoteChar as '"' | "'" | null,
      nameStart,
      valueStart,
      sourceStart,
      sourceEnd
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
    // 1. Do ALL MagicString operations and 2. Queue ALL deltas
    for (const attribute of this.__element.source.attributes) {
      if (attribute.name.data !== name) {
        continue;
      }

      // Always remove the space before the attribute
      const removeStart = attribute.source.startIndex - 1;
      const removeEnd = attribute.source.endIndex + 1;

      this.__htmlMod.__s.remove(removeStart, removeEnd);
      this.__htmlMod.__pendingDeltas.push(calculateRemoveDelta(removeStart, removeEnd));
    }

    // 3. Modify AST: Remove attribute from element
    AstManipulator.removeAttribute(this.__element, name);

    // 4. Apply deltas and refresh
    this.__htmlMod.__finishOperation();

    return this;
  }

  querySelector(selector: string): HtmlModElement | null {
    const result = select(selector, this.__element)?.[0] ?? null;
    if (!result) {
      return null;
    }

    return new this.__htmlMod.__HtmlModElement(result as unknown as SourceElement, this.__htmlMod);
  }

  querySelectorAll(selector: string): HtmlModElement[] {
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
    return decode(this.__text.data);
  }

  get innerHTML() {
    return this.__text.data;
  }

  set innerHTML(html: string) {
    if (!this.__text.endIndex) {
      return;
    }

    // Save original positions
    const originalStart = this.__text.startIndex;
    const originalEnd = this.__text.endIndex;

    // 1. Do MagicString operation
    const overwriteStart = originalStart;
    const overwriteEnd = originalEnd + 1;
    this.__htmlMod.__s.overwrite(overwriteStart, overwriteEnd, html);

    // 2. Queue delta
    this.__htmlMod.__pendingDeltas.push(calculateOverwriteDelta(overwriteStart, overwriteEnd, html));

    // 3. Modify AST: Update text node data
    AstManipulator.setTextData(this.__text, html);

    // 4. Apply deltas and refresh
    this.__htmlMod.__finishOperation();

    // 5. Manually update endIndex AFTER deltas are applied
    // The text node is inside the overwritten region, so its position needs manual correction
    this.__text.endIndex = originalStart + html.length - 1;
  }

  set textContent(text: string) {
    if (!this.__text.endIndex) {
      return;
    }

    const escapedText = escapeHtml(text);

    // Save original positions
    const originalStart = this.__text.startIndex;
    const originalEnd = this.__text.endIndex;

    // 1. Do MagicString operation
    const overwriteStart = originalStart;
    const overwriteEnd = originalEnd + 1;
    this.__htmlMod.__s.overwrite(overwriteStart, overwriteEnd, escapedText);

    // 2. Queue delta
    this.__htmlMod.__pendingDeltas.push(calculateOverwriteDelta(overwriteStart, overwriteEnd, escapedText));

    // 3. Modify AST: Update text node data
    AstManipulator.setTextData(this.__text, escapedText);

    // 4. Apply deltas and refresh
    this.__htmlMod.__finishOperation();

    // 5. Manually update endIndex AFTER deltas are applied
    // The text node is inside the overwritten region, so its position needs manual correction
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
  // we flip the quotes to double quotes
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
