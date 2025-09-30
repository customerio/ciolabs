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
  __options: HtmlModOptions;

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
    this.__HtmlMod = HtmlMod;
  }
  trim(charType?: Parameters<typeof MagicString.prototype.trim>[0]) {
    this.__s.trim(charType);
    this.__flushed = false;
    return this;
  }
  trimStart(charType?: Parameters<typeof MagicString.prototype.trimStart>[0]) {
    this.__s.trimStart(charType);
    this.__flushed = false;
    return this;
  }
  trimEnd(charType?: Parameters<typeof MagicString.prototype.trimEnd>[0]) {
    this.__s.trimEnd(charType);
    this.__flushed = false;
    return this;
  }
  trimLines() {
    this.__s.trimLines();
    this.__flushed = false;
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

    // override the opening tag
    this.__htmlMod.__s.overwrite(
      this.__element.source.openTag.startIndex + 1,
      this.__element.source.openTag.startIndex + 1 + currentTagName.length,
      tagName
    );

    // override the closing tag
    if (this.__element.source.closeTag) {
      this.__htmlMod.__s.overwrite(
        this.__element.source.closeTag.startIndex + 2,
        this.__element.source.closeTag.startIndex + 2 + currentTagName.length,
        tagName
      );
    }

    this.__htmlMod.__flushed = false;
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

    if (this.innerHTML.length === 0) {
      this.__htmlMod.__s.appendRight(this.__element.source.openTag.endIndex + 1, html);
    } else {
      this.__htmlMod.__s.overwrite(
        this.__element.source.openTag.endIndex + 1,
        this.__element?.source?.closeTag?.startIndex ?? this.__element.endIndex,
        html
      );
    }
    this.__htmlMod.__flushed = false;
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
    return this.__htmlMod.__source.slice(
      this.__element.source.openTag.startIndex,
      this.__element.source.closeTag?.endIndex ?? this.__element.endIndex + 1
    );
  }

  get children() {
    return this.__element.children;
  }

  get parent(): HtmlModElement | null {
    const { parent } = this.__element;

    if (parent?.type === 'tag') {
      return new this.__htmlMod.__HtmlModElement(parent as unknown as SourceElement, this.__htmlMod);
    }

    return null;
  }

  before(html: string) {
    this.__htmlMod.__s.prependLeft(this.__element.source.openTag.startIndex, html);

    this.__htmlMod.__flushed = false;

    return this;
  }

  after(html: string) {
    this.__htmlMod.__s.appendRight(this.__element.source.closeTag?.endIndex ?? this.__element.endIndex + 1, html);

    this.__htmlMod.__flushed = false;

    return this;
  }

  prepend(html: string) {
    /**
     * If the element is self closing, we need to remove the slash
     */
    if (this.__element.source.openTag.isSelfClosing) {
      const hasSlash = this.__htmlMod.__source.charAt(this.__element.source.openTag.endIndex - 1) === '/';

      if (hasSlash) {
        // remove the slash
        this.__htmlMod.__s.remove(this.__element.source.openTag.endIndex - 1, this.__element.source.openTag.endIndex);
      }
    }

    this.__htmlMod.__s.prependLeft(this.__element.source.openTag.endIndex + 1, html);

    /**
     * If the element was self closing, we need to add the closing tag
     */
    if (this.__element.source.openTag.isSelfClosing) {
      this.__htmlMod.__s.appendRight(this.__element.source.openTag.endIndex + 1, `</${this.__element.tagName}>`);
    }

    this.__htmlMod.__flushed = false;

    return this;
  }

  append(html: string) {
    /**
     * If the element is self closing, it's the same as prepend
     */
    if (this.__element.source.openTag.isSelfClosing) {
      return this.prepend(html);
    }

    this.__htmlMod.__s.appendRight(this.__element?.source?.closeTag?.startIndex ?? this.__element.endIndex, html);

    this.__htmlMod.__flushed = false;

    return this;
  }

  remove() {
    this.__htmlMod.__s.remove(
      this.__element.source.openTag.startIndex,
      // if the item we are removing is the last item in the document,
      // the +1 will cause an out of bounds error so we make sure
      // we don't go past the end of the document
      Math.min(this.__element.source.closeTag?.endIndex ?? this.__element.endIndex + 1, this.__htmlMod.__source.length)
    );

    this.__htmlMod.__flushed = false;

    return this;
  }

  replaceWith(html: string) {
    this.__htmlMod.__s.overwrite(
      this.__element.source.openTag.startIndex,
      // if the item we are replacinng is the last item in the document,
      // the +1 will cause an out of bounds error so we make sure
      // we don't go past the end of the document
      Math.min(this.__element.source.closeTag?.endIndex ?? this.__element.endIndex + 1, this.__htmlMod.__source.length),
      html
    );

    this.__htmlMod.__flushed = false;

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

    if (attribute) {
      /**
       * A value is already set, so we need to overwrite it
       */
      if (attribute?.value && attribute.value.startIndex <= attribute.value.endIndex) {
        this.__htmlMod.__s.overwrite(
          attribute.value?.startIndex + (hasQuote ? -1 : 0),
          attribute.value?.endIndex + 1 + (hasQuote ? 1 : 0),
          `${quoteChar}${escapedValue}${quoteChar}`
        );
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
          this.__htmlMod.__s.overwrite(
            attribute.value?.startIndex - 1,
            attribute.value?.endIndex + 2,
            `${quoteChar}${escapedValue}${quoteChar}`
          );
        } else {
          this.__htmlMod.__s.appendRight(attribute.value.startIndex, `${quoteChar}${escapedValue}${quoteChar}`);
        }
      } else {
        /**
         * No value is set, so we need to add it
         */
        this.__htmlMod.__s.appendRight(
          attribute.name.endIndex + 1,
          `=${quoteChar || '"'}${escapedValue}${quoteChar || '"'}`
        );
      }
    } else {
      /**
       * No attribute is set, so we need to add it
       */
      this.__htmlMod.__s.appendRight(
        this.__element.source.openTag.startIndex + this.__element.tagName.length + 1, // +1 for the <
        ` ${name}=${quoteChar || '"'}${escapedValue}${quoteChar || '"'}`
      );
    }

    this.__htmlMod.__flushed = false;

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

    this.__htmlMod.__flushed = false;

    return this;
  }

  removeAttribute(name: string) {
    const remainingAttributesCount = this.__element.source.attributes.filter(a => a.name.data !== name).length;
    for (const [index, attribute] of this.__element.source.attributes.entries()) {
      if (attribute.name.data !== name) {
        continue;
      }

      const isLastAttribute = attribute === this.__element.source.attributes.at(-1);
      const isPreviousRemoved = index > 0 && this.__element.source.attributes[index - 1].name.data === name;

      this.__htmlMod.__s.remove(
        attribute.source.startIndex -
          (remainingAttributesCount === 0
            ? 1 // -1 for the leading space if there are no more attributes
            : isLastAttribute
              ? 1 // -1 for the leading space if we are removing the last attribute
              : isPreviousRemoved // -1 for the leading space if the previous attribute was removed
                ? 1
                : 0),
        attribute.source.endIndex + 1
      );
    }

    this.__htmlMod.__flushed = false;

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
    clone.__isClone = true;

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

  set textContent(text: string) {
    if (!this.__text.endIndex) {
      return;
    }

    this.__htmlMod.__s.overwrite(this.__text.startIndex, this.__text.endIndex + 1, escapeHtml(text));
    this.__htmlMod.__flushed = false;
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
