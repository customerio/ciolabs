import * as DomHandlerUtils from 'domhandler';
import { ChildNode, Document } from 'domhandler';
import { DomHandler, DomHandlerOptions, ElementType, Parser, ParserOptions } from 'htmlparser2';

// From import { QuoteType } from "htmlparser2/lib/Tokenizer";
declare enum QuoteType {
  NoValue = 0,
  Unquoted = 1,
  Single = 2,
  Double = 3,
}

export type ElementSource = {
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
  attributes: {
    name: {
      startIndex: number;
      endIndex: number;
      data: string;
    };
    value: null | {
      startIndex: number;
      endIndex: number;
      data: string;
    };
    quote: '"' | "'" | null | undefined;
    source: {
      startIndex: number;
      endIndex: number;
      data: string;
    };
  }[];
};

export type SourceDocument = Omit<Document, 'children'> & {
  children: SourceChildNode[];
  get childNodes(): SourceChildNode[];
  set childNodes(children: SourceChildNode[]);
  offsetToPosition(offset: number): { line: number; character: number };
};

export type SourceChildNode =
  | DomHandlerUtils.Text
  | DomHandlerUtils.Comment
  | DomHandlerUtils.ProcessingInstruction
  | DomHandlerUtils.CDATA
  | DomHandlerUtils.Document
  | SourceElement;

export type SourceElement = Omit<DomHandlerUtils.Element, 'children'> & {
  source: ElementSource;
  children: SourceChildNode[];
  startIndex: number;
  endIndex: number;
};

export declare type Options = ParserOptions & DomHandlerOptions & { autofix?: boolean };

export function isCDATA(node: DomHandlerUtils.Node): node is DomHandlerUtils.CDATA {
  return DomHandlerUtils.isCDATA(node);
}
export function isComment(node: DomHandlerUtils.Node): node is DomHandlerUtils.Comment {
  return DomHandlerUtils.isComment(node);
}
export function isDirective(node: DomHandlerUtils.Node): node is DomHandlerUtils.ProcessingInstruction {
  return DomHandlerUtils.isDirective(node);
}
export function isDoctype(node: DomHandlerUtils.Node): node is DomHandlerUtils.ProcessingInstruction {
  return node.type === ElementType.Doctype;
}

export function isDocument(node: DomHandlerUtils.Node): node is SourceDocument {
  return DomHandlerUtils.isDocument(node);
}

export function isTag(node: DomHandlerUtils.Node): node is SourceElement {
  return DomHandlerUtils.isTag(node) && 'source' in node;
}

export function isText(node: DomHandlerUtils.Node): node is DomHandlerUtils.Text {
  return DomHandlerUtils.isText(node);
}

export class SourceDomHandler extends DomHandler {
  /** The root element for the DOM */
  declare root: SourceDocument;
  private extendedParser: SourceParser | null = null;

  public onparserinit(parser: SourceParser): void {
    super.onparserinit(parser);
    this.extendedParser = parser;
  }

  /**
   * Make the tag stack public
   */
  get publicTagStack() {
    return this.tagStack;
  }

  addNode(node: ChildNode) {
    if (
      (node.type === ElementType.Tag || node.type === ElementType.Script || node.type === ElementType.Style) &&
      this.extendedParser?.openTag
    ) {
      // here is where we take the ChildNode and make it into a SourceChildNode
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (node as any).source = {
        openTag: this.extendedParser.openTag,
        closeTag: null,
        attributes: this.extendedParser.attributes,
      };
    }

    super.addNode(node);
  }

  onclosetag(): void {
    // if there is a tag we are dealing with, and it has a source, and we have a close tag ready to be attached
    if (this.tagStack.length <= 0) {
      return super.onclosetag();
    }

    const lastTag = this.tagStack.at(-1);
    if (!lastTag) {
      return super.onclosetag();
    }

    if (!('source' in lastTag)) {
      return super.onclosetag();
    }

    const lastTagSource = lastTag.source as ElementSource;

    if (
      this.extendedParser?.closeTag && // if the close tag name matches the open tag name, then it's the close tag for the current element
      this.extendedParser.closeTag.name === lastTagSource.openTag.name
    ) {
      lastTagSource.closeTag = this.extendedParser?.closeTag;
      this.extendedParser.closeTag = null;
    }

    super.onclosetag();
  }
}

// there are some private properties that we need to access
// on the Parser class, so we need to force the type to allow it
type PrivateAccess = {
  attribvalue: string;
};

export class SourceParser extends Parser {
  private attributeSource: null | ElementSource['attributes'][number] = null;
  openTag: ElementSource['openTag'] | null = null;
  closeTag: ElementSource['closeTag'] | null = null;
  attributes: ElementSource['attributes'] | null = null;

  handler: SourceDomHandler;

  constructor(handler: SourceDomHandler, options?: Options) {
    super(handler, options);
    this.handler = handler;
  }

  /**
   * Get the open tag
   *
   * 1. onopentagname is called with the start index of the tag name
   * 2. onopentagend is called with the end index of the tag
   */
  onopentagname(start: number, endIndex: number) {
    const fullStartIndex = start - 1; // start is the index of the the name, minus 1 to get the index of the <

    this.openTag = {
      startIndex: fullStartIndex,
      endIndex: fullStartIndex,
      data: '',
      name: this.slice(start, endIndex),
      isSelfClosing: false,
    };
    this.attributes = [];
    super.onopentagname(start, endIndex);
  }
  onopentagend(endIndex: number): void {
    // modify the object to keep the reference used in the handler.addNode call
    this.openTag = {
      ...this.openTag!,
      endIndex,
      data: this.slice(this.openTag!.startIndex, endIndex + 1),
      // if the second to last character is a /, then it's self closing
      isSelfClosing: this.source[endIndex - 1] === '/' || this.isVoidElement(this.openTag!.name),
    };

    super.onopentagend(endIndex);
  }

  /**
   * Get the close tag
   *
   * 1. onclosetag is called with the start index and end index of the tag
   * 2. onselfclosingtag is called with the end index of the tag
   */
  onclosetag(start: number, endIndex: number): void {
    // loop backwards until we find the <
    let trueStartIndex = start;
    while (this.slice(trueStartIndex, trueStartIndex + 1) !== '<') {
      // Safeguard against infinite loop
      if (trueStartIndex <= 0) {
        break;
      }

      trueStartIndex -= 1;
    }

    // loop forwards until we find the >
    let trueEndIndex = endIndex;
    while (this.slice(trueEndIndex - 1, trueEndIndex) !== '>') {
      // Safeguard against infinite loop
      if (trueEndIndex >= this.source.length) {
        break;
      }

      trueEndIndex += 1;
    }

    // modify the object to keep the reference used in the handler.addNode call
    this.closeTag = {
      startIndex: trueStartIndex,
      endIndex: trueEndIndex,
      data: this.slice(trueStartIndex, trueEndIndex),
      name: this.slice(start, endIndex),
    };

    // check if we have a tag stack
    if (this.handler.publicTagStack.length > 0) {
      const lastTag = this.handler.publicTagStack
        .filter(tag => {
          return 'name' in tag && tag.name.toLowerCase() === this.closeTag!.name.toLowerCase();
        })
        .at(-1);
      if (lastTag == null) {
        this.handler.ontext(this.closeTag!.data);
      }
    } else {
      // if we don't have a tag stack, but we have a close tag, then add the close tag
      // as text
      this.handler.ontext(this.closeTag!.data);
    }

    super.onclosetag(start, endIndex);

    /**
     * FIX THE UNDERLYING PARSER
     *
     * htmlparser2 expects the character after the tag name (i.e. div)
     * to be `>` however it can be whitespace.
     *
     * It is expecting `</div>` but it could be `</ div    >`
     *
     * this makes the startIndex for the next node wrong by the number of
     * whitespace characters
     *
     * By setting the startIndex here, we fix this
     */
    this.startIndex = trueEndIndex;
  }
  onselfclosingtag(endIndex: number): void {
    // modify the object to keep the reference used in the handler.addNode call
    this.openTag = {
      ...this.openTag!,
      endIndex,
      data: this.slice(this.openTag!.startIndex, endIndex + 1),
      isSelfClosing: true,
    };
    this.closeTag = null;

    super.onselfclosingtag(endIndex);
  }

  /**
   * Get the attributes
   *
   * 1. onattribname - Grab start and end indexes of the attribute name
   * 2. onattribdata - Grab start and end indexes of the attribute value. If it already has a value, then extend the end index.
   * 3. onattribentity - If the attribute already has a value range, then extend the end index
   * 4. onattribend - Get the end index for the full source and attribute value, and store the type of quote used with the attribute
   *
   */
  onattribname(start: number, endIndex: number): void {
    const name = this.slice(start, endIndex);
    this.attributeSource = {
      name: {
        startIndex: start,
        endIndex: endIndex - 1,
        data: name,
      },
      value: null,
      quote: undefined,
      source: {
        startIndex: start,
        endIndex: endIndex - 1,
        data: name,
      },
    };

    super.onattribname(start, endIndex);
  }
  onattribdata(start: number, endIndex: number): void {
    if (this.attributeSource) {
      if (this.attributeSource?.value) {
        const value = this.slice(this.attributeSource.value.startIndex, endIndex);
        this.attributeSource.value.endIndex = endIndex - 1;
        this.attributeSource.value.data = value;
      } else {
        const value = this.slice(start, endIndex);
        this.attributeSource.value = {
          startIndex: start,
          endIndex: endIndex - 1,
          data: value,
        };
      }

      this.attributeSource.source.endIndex = endIndex - 1;
    }

    super.onattribdata(start, endIndex);
  }
  /**
   * TODO: verify this is correct and we don't need to handle
   * it being called as the first part of the value
   */
  onattribentity(cp: number): void {
    if (this.attributeSource) {
      const value = (this as unknown as PrivateAccess).attribvalue;
      if (this.attributeSource.value) {
        this.attributeSource.value.endIndex += 1;
        this.attributeSource.value.data = value;
        this.attributeSource.source.endIndex += 1;
      }
    }

    super.onattribentity(cp);
  }
  onattribend(quote: QuoteType, endIndex: number): void {
    // subtract 1 from the endIndex to be inclusive
    // if the quote is a double or single quote, then add 1 to the endIndex to include the quote
    const endIndexWithQuote = endIndex - 1 + (quote === 3 || quote === 2 ? 1 : 0);

    if (this.attributeSource) {
      this.attributeSource.source = {
        ...this.attributeSource.source,
        endIndex: endIndexWithQuote,
        data: this.slice(this.attributeSource.source.startIndex, endIndexWithQuote + 1),
      };
      this.attributeSource.quote = quote === 3 ? '"' : quote === 2 ? "'" : quote === 0 ? undefined : null;

      // modify the object to keep the reference used in the handler.addNode call
      this.attributes!.push(this.attributeSource);
    }

    // clear out the attribute once we are finished
    this.attributeSource = null;
    super.onattribend(quote, endIndex);
  }

  private source = '';
  private slice(startIndex: number, endIndex: number) {
    return this.source.slice(startIndex, endIndex);
  }

  /**
   * Parses a chunk of data and calls the corresponding callbacks.
   *
   * @param chunk Chunk to parse.
   */
  public write(chunk: string): void {
    this.source += chunk;
    super.write(chunk);
  }
}

/**
 * Parses the data, returns the resulting document.
 *
 * @param data The data that should be parsed.
 * @param options Optional options for the parser and DOM builder.
 */
export function parseDocument(data: string, options?: Options): SourceDocument {
  options = options || {};
  options = {
    withStartIndices: true,
    withEndIndices: true,
    decodeEntities: false,
    ...options,
  };

  const handler = new SourceDomHandler(undefined, options);
  new SourceParser(handler, options).end(data);

  const { root } = handler;

  const lines = data.split('\n');
  root.offsetToPosition = (offset: number) => {
    let containingLine = 0;

    offset = Math.min(offset, data.length);
    offset = Math.max(offset, 0);

    while (lines.length > containingLine && offset > lines[containingLine].length) {
      offset -= lines[containingLine].length + 1;
      containingLine += 1;
    }

    return {
      line: containingLine,
      character: offset,
    };
  };

  /**
   * FIX THE UNDERLYING PARSER
   *
   * htmlparser2 sets the endIndex to be the same as the parent endIndex
   * when the child tag is missing an end tag
   * i.e.
   * <span><div>inside the div</span>
   *
   * the div node will have an endIndex that is the same as the span endIndex
   *
   * This is not ideal because if we use the startIndex and endIndex of the div node
   * to get the source, we will get the source of the span node
   * i.e. <div>inside the div</span>
   *
   * Instead we want to get the source of _just_ the div node
   * i.e. <div>inside the div
   *
   * To fix this we do a walk of the tree and if we find a node that has an endIndex
   * that is the same as the parent endIndex we walk up the tree until we find
   * a node with a source.closeTag that is not null.
   *
   * Then we set the node.endIndex to be the source.closeTag.startIndex - 1
   */
  const stack: ChildNode[] = [root];
  // process each node
  while (stack.length > 0) {
    const node = stack.pop();

    // if we have a non-void tag that is missing a closeTag
    if (isTag(node!) && node.source.closeTag === null && !node.source.openTag.isSelfClosing) {
      // walk up it's parent until we find a node that has a closeTag
      let parent = node.parent !== null && isTag(node.parent) ? node.parent : undefined;
      while (
        parent?.source.closeTag === null &&
        parent?.parent &&
        isTag(parent?.parent) &&
        parent?.parent?.endIndex === node.endIndex
      ) {
        parent = parent.parent;
      }

      // if we found a parent element with a closeTag
      if (parent && isTag(parent) && parent.source.closeTag) {
        // calculate the new endIndex
        node.endIndex = parent.source.closeTag.startIndex - 1;

        // if the node has a text element as it's last child we need to chop off
        // the parent's close tag from the text element
        const lastChild = node.children.at(-1);
        if (
          lastChild &&
          isText(lastChild) &&
          new RegExp(`</\\s*${parent.source.openTag.name}\\s*>`).test(lastChild.data)
        ) {
          lastChild.endIndex = node.endIndex;

          lastChild.data = data.slice(lastChild.startIndex!, lastChild.endIndex + 1);
        }
      }

      if (options.autofix) {
        // autofix the source
        node.source.closeTag = {
          startIndex: -1,
          endIndex: -1,
          data: `</${node.source.openTag.name}>`,
          name: node.source.openTag.name,
        };
      }
    }

    if (node != null && (node.type === ElementType.Root || isTag(node))) {
      stack.push(...node.children);
    }
  }

  return root;
}

// todo export most utils from domhandler (exclude isTag, DomHandler, Parser, etc etc)
export * as DomUtils from 'domutils';

export class SourceText {
  constructor(private text: string) {}

  slice(startIndex: number, endIndex: number): string {
    return this.text.slice(startIndex, endIndex);
  }

  charAt(index: number): string {
    return this.text.charAt(index);
  }

  length(): number {
    return this.text.length;
  }

  toString(): string {
    return this.text;
  }

  offsetToPosition(offset: number): { line: number; character: number } {
    const lines = this.text.split('\n');
    let containingLine = 0;

    offset = Math.min(offset, this.text.length);
    offset = Math.max(offset, 0);

    while (lines.length > containingLine && offset > lines[containingLine].length) {
      offset -= lines[containingLine].length + 1;
      containingLine += 1;
    }

    return {
      line: containingLine,
      character: offset,
    };
  }
}

export function nodeToString(node: SourceChildNode): string {
  if (isDocument(node)) {
    return node.children.map(node => nodeToString(node)).join('');
  }

  if (isDirective(node) || isDoctype(node)) {
    return `<${node.data}>`;
  }

  if (isText(node)) {
    return node.data;
  }

  if (isCDATA(node)) {
    return '';
  }
  if (isComment(node)) {
    return `<!--${node.data}-->`;
  }

  if (isTag(node)) {
    return (
      node.source.openTag.data +
      node.children.map(element => nodeToString(element)).join('') +
      (node.source.closeTag?.data ?? '')
    );
  }

  return '';
}
