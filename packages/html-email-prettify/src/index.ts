import { HtmlMod, HtmlModElement, HtmlModText } from '@ciolabs/html-mod';
import type { SourceElement, SourceText, SourceChildNode } from '@ciolabs/htmlparser2-source';
import { isComment, isDirective, isTag, isText } from '@ciolabs/htmlparser2-source';

/**
 * Inline HTML elements — we never add newlines around these.
 * Includes legacy/deprecated tags still common in email HTML.
 */
const INLINE_ELEMENTS = new Set([
  'a',
  'abbr',
  'acronym',
  'b',
  'bdi',
  'bdo',
  'big',
  'br',
  'button',
  'cite',
  'code',
  'data',
  'del',
  'dfn',
  'em',
  'font',
  'i',
  'img',
  'input',
  'ins',
  'kbd',
  'label',
  'mark',
  'meter',
  'output',
  'progress',
  'q',
  'ruby',
  's',
  'samp',
  'select',
  'small',
  'span',
  'strike',
  'strong',
  'sub',
  'sup',
  'time',
  'tt',
  'u',
  'var',
  'wbr',
]);

/**
 * Elements whose content whitespace must never be touched.
 */
const PRESERVE_CONTENT = new Set(['pre', 'code', 'textarea']);

export interface PrettifyOptions {
  /** Number of spaces per indent level (default 2) */
  indentSize?: number;

  /** Character to use for indentation (default ' ') */
  indentChar?: string;

  /**
   * Maximum line length before attribute wrapping kicks in (default 0 = off).
   * When an opening tag exceeds this length, attributes are wrapped onto
   * new lines (one per line, indented to align or by one indent level).
   */
  maxLineLength?: number;

  /**
   * How to wrap attributes when a tag exceeds `maxLineLength`.
   * - `'auto'`          — wrap only when the line exceeds maxLineLength (default)
   * - `'force'`         — always wrap attributes, one per line
   * - `'force-aligned'` — always wrap, align to the first attribute
   * - `false`           — never wrap attributes
   */
  wrapAttributes?: 'auto' | 'force' | 'force-aligned' | false;

  /**
   * Collapse multiple consecutive blank lines to a single blank line
   * (default true).
   */
  collapseBlankLines?: boolean;

  /**
   * Whether to increase indentation depth for content that appears
   * after a conditional comment.  When `false`, content after
   * `<!--[if mso]>...<![endif]-->` stays at the same indent level
   * as the comment itself (default true).
   */
  indentAfterConditionalComments?: boolean;
}

/** Resolved options with defaults applied */
interface ResolvedOptions {
  indent: string;
  maxLineLength: number;
  wrapAttributes: 'auto' | 'force' | 'force-aligned' | false;
  collapseBlankLines: boolean;
  indentAfterConditionalComments: boolean;
}

function resolveOptions(options?: PrettifyOptions): ResolvedOptions {
  const indentChar = options?.indentChar ?? ' ';
  const indentSize = options?.indentSize ?? 2;
  return {
    indent: indentChar.repeat(indentSize),
    maxLineLength: options?.maxLineLength ?? 0,
    wrapAttributes: options?.wrapAttributes ?? 'auto',
    collapseBlankLines: options?.collapseBlankLines ?? true,
    indentAfterConditionalComments: options?.indentAfterConditionalComments ?? true,
  };
}

/**
 * Format and prettify HTML email content.
 *
 * Walks the html-mod AST and adjusts whitespace text nodes in place —
 * no re-parse, no full-string rewrite.  The `HtmlMod` instance stays
 * live with valid positions throughout.
 *
 * - If `HtmlMod`, the instance is mutated in place and returned.
 * - If `string`, a new `HtmlMod` is created, formatted, and returned.
 */
export default function prettify(input: HtmlMod | string, options?: PrettifyOptions): HtmlMod {
  const mod = typeof input === 'string' ? new HtmlMod(input) : input;
  const resolved = resolveOptions(options);

  // Format the document tree.
  // Depth -1 so that top-level elements sit at indent 0.
  formatChildren(mod, mod.__dom.children as Iterable<SourceElement | SourceText>, -1, resolved);

  // Wrap long opening tags by breaking attributes onto new lines.
  if (resolved.wrapAttributes !== false && resolved.maxLineLength > 0) {
    wrapLongAttributes(mod, resolved);
  }

  // Collapse consecutive blank lines.
  if (resolved.collapseBlankLines) {
    collapseConsecutiveBlankLines(mod);
  }

  // Trim only HTML formatting whitespace at document boundaries.
  trimFormattingWhitespace(mod);

  return mod;
}

// ---------------------------------------------------------------------------
// Core formatting
// ---------------------------------------------------------------------------

/**
 * Walk `children` and ensure correct indentation between block-level
 * siblings.  Operates entirely through HtmlMod text-node mutations so
 * the AST stays in sync.
 */
function formatChildren(
  mod: HtmlMod,
  children: Iterable<SourceElement | SourceText>,
  depth: number,
  options: ResolvedOptions
): void {
  const childArray = [...children];
  const { indent } = options;

  // Determine if this list contains any block-level content.
  const hasBlock = childArray.some(
    child =>
      (isTag(child) && !isInline(child as SourceElement)) ||
      (isComment(child) && isMultiLineConditional(child)) ||
      isDirective(child)
  );

  if (!hasBlock) return;

  // Build a set of child indices protected by single-line bubble conditionals.
  const protectedIndices = buildProtectedBubbleIndices(childArray);

  const childIndent = indent.repeat(Math.max(0, depth + 1));
  const parentIndent = indent.repeat(Math.max(0, depth));

  for (let index = 0; index < childArray.length; index++) {
    const child = childArray[index];
    const previous = childArray[index - 1];
    const isFirst = index === 0;
    const isLast = index === childArray.length - 1;

    // --- Whitespace text nodes between siblings --------------------------
    if (isText(child)) {
      const textNode = child as SourceText;
      const nextSibling = childArray[index + 1];
      const betweenInlineBlocks =
        previous && nextSibling && hasInlineBlockStyle(previous) && hasInlineBlockStyle(nextSibling);

      if (isWhitespaceOnly(textNode.data) && !betweenInlineBlocks && !protectedIndices.has(index)) {
        setTextContent(mod, textNode, `\n${isLast ? parentIndent : childIndent}`);
      }
      continue;
    }

    // --- Ensure leading whitespace before any non-text node ---------------
    if (isFirst) {
      if (isTag(child)) {
        insertBeforeIfNeeded(mod, child as SourceElement, `\n${childIndent}`);
      } else if (isComment(child) || isDirective(child)) {
        insertBeforeComment(mod, child, `\n${childIndent}`);
      }
    } else if (
      previous &&
      !isText(previous) &&
      !(hasInlineBlockStyle(previous) && hasInlineBlockStyle(child)) &&
      !protectedIndices.has(index)
    ) {
      if (isTag(previous)) {
        insertAfterIfNeeded(mod, previous as SourceElement, `\n${childIndent}`);
      } else if (isComment(previous) || isDirective(previous)) {
        insertAfterComment(mod, previous, `\n${childIndent}`);
      }
    }

    // --- Element nodes ---------------------------------------------------
    if (isTag(child)) {
      const element = child as SourceElement;

      if (isInline(element)) {
        if (isLast) {
          insertAfterIfNeeded(mod, element, `\n${parentIndent}`);
        }
        continue;
      }

      // Recurse into children (unless content is preserved)
      if (!isPreserved(element) && element.children.length > 0) {
        formatChildren(mod, element.children as Iterable<SourceElement | SourceText>, depth + 1, options);
      }

      if (isLast) {
        insertAfterIfNeeded(mod, element, `\n${parentIndent}`);
      }
    }

    // --- Comment nodes ----------------------------------------------------
    if (isComment(child)) {
      if (isLast) {
        insertAfterComment(mod, child, `\n${parentIndent}`);
      }

      if (isMultiLineConditional(child)) {
        formatInsideConditionalComment(mod, child, depth + 1, options);
      }
    }

    // --- Directive nodes (<!DOCTYPE html>, etc.) --------------------------
    if (isDirective(child) && isLast) {
      insertAfterComment(mod, child, `\n${parentIndent}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Multi-line conditional comment formatting
// ---------------------------------------------------------------------------

function formatInsideConditionalComment(
  mod: HtmlMod,
  commentNode: { startIndex: number; endIndex: number; data: string },
  depth: number,
  options: ResolvedOptions
): void {
  const { data, startIndex, endIndex } = commentNode;
  const { indent } = options;

  const openMatch = /^\[if\s[^]*?]>/i.exec(data);
  const closeMatch = /<!\[endif]$/i.exec(data);
  if (!openMatch || !closeMatch) return;

  const rawInnerHtml = data.slice(openMatch[0].length, data.length - closeMatch[0].length);
  const trimmedInnerHtml = trimFormatting(rawInnerHtml);
  if (!trimmedInnerHtml) return;

  const innerMod = new HtmlMod(trimmedInnerHtml);
  formatChildren(innerMod, innerMod.__dom.children as Iterable<SourceElement | SourceText>, depth - 1, options);

  const commentIndent = indent.repeat(Math.max(0, depth));

  const innerFormatted =
    innerMod.__source === trimmedInnerHtml
      ? trimmedInnerHtml
          .split('\n')
          .map(line => `${commentIndent}${trimFormatting(line)}`)
          .join('\n')
      : innerMod.__source.replace(/^\n/, '').replace(/[\t\n\f\r ]+$/, '');

  const formatted = `\n${innerFormatted}\n${commentIndent}`;

  const newData = `${openMatch[0]}${formatted}${closeMatch[0]}`;
  if (newData === data) return;

  const dataStart = startIndex + 4;
  const dataEnd = endIndex - 2;
  const oldLength = dataEnd - dataStart;
  const { length: newLength } = newData;

  mod.__source = mod.__source.slice(0, dataStart) + newData + mod.__source.slice(dataStart + oldLength);

  const delta = newLength - oldLength;

  if (delta !== 0) {
    shiftPositionsAfter(mod.__dom.children, endIndex + 1, delta);
  }

  commentNode.data = newData;
  commentNode.endIndex += delta;
}

// ---------------------------------------------------------------------------
// Attribute wrapping
// ---------------------------------------------------------------------------

/**
 * Wrap attributes on opening tags that exceed `maxLineLength`.
 * Breaks before each attribute onto a new line — saves one character
 * compared to breaking after, and keeps lines short without adding
 * a space character:
 * ```
 * <p
 *   style="margin:1em 0">
 * ```
 *
 * Uses regex on the source string after structural formatting.
 */
function wrapLongAttributes(mod: HtmlMod, options: ResolvedOptions): void {
  const { maxLineLength, wrapAttributes, indent } = options;

  // Match opening tags with attributes: <tagname attr1="val" attr2="val" ...>
  // Captures: (1) tag start `<tagname`, (2) attributes block, (3) closing `>` or `/>`
  const openTagRegex = /(<[a-z][\da-z-]*)((?:\s+[^\s/=>]+(?:=(?:"[^"]*"|'[^']*'|[^\s>]*))?)+)(\s*\/?>)/gi;

  let newSource = mod.__source;
  let offset = 0;

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  for (const match of mod.__source.matchAll(openTagRegex)) {
    const fullMatch = match[0];
    const tagStart = match[1]; // e.g. "<p"
    const attributesPart = match[2]; // e.g. ' class="x" style="y"'
    const closing = match[3]; // e.g. ">" or " />"
    const matchIndex = match.index;

    // Calculate the line this tag starts on to get indentation
    const lineStart = mod.__source.lastIndexOf('\n', matchIndex) + 1;
    const leadingWhitespace = mod.__source.slice(lineStart, matchIndex);
    const tagLineLength = leadingWhitespace.length + fullMatch.length;

    // For 'auto' mode, skip tags that fit on one line
    if (wrapAttributes === 'auto' && tagLineLength <= maxLineLength) {
      continue;
    }

    // Parse individual attributes
    const attributes: string[] = [];
    const attributeRegex = /\s+([^\s/=>]+(?:=(?:"[^"]*"|'[^']*'|[^\s>]*))?)/g;
    let attributeMatch;
    while ((attributeMatch = attributeRegex.exec(attributesPart)) !== null) {
      attributes.push(attributeMatch[1]);
    }

    if (attributes.length === 0) continue;

    // Build wrapped replacement
    let replacement: string;
    if (wrapAttributes === 'force-aligned') {
      const alignIndent = ' '.repeat(leadingWhitespace.length + tagStart.length + 1);
      replacement = `${tagStart} ${attributes[0]}`;
      for (let attributeIndex = 1; attributeIndex < attributes.length; attributeIndex++) {
        replacement += `\n${alignIndent}${attributes[attributeIndex]}`;
      }
      replacement += closing;
    } else {
      const attributeIndent = leadingWhitespace + indent;
      replacement = tagStart;
      for (const attribute of attributes) {
        replacement += `\n${attributeIndent}${attribute}`;
      }
      replacement += closing;
    }

    // Apply replacement at shifted position
    const shiftedIndex = matchIndex + offset;
    newSource = newSource.slice(0, shiftedIndex) + replacement + newSource.slice(shiftedIndex + fullMatch.length);
    offset += replacement.length - fullMatch.length;
  }

  if (newSource !== mod.__source) {
    const fresh = new HtmlMod(newSource, mod.__options);
    mod.__source = fresh.__source;
    mod.__dom = fresh.__dom;
    mod.__astUpdater = fresh.__astUpdater;
    mod.__cachedInnerHTML = new WeakMap();
    mod.__cachedOuterHTML = new WeakMap();
  }
}

// ---------------------------------------------------------------------------
// Whitespace collapsing
// ---------------------------------------------------------------------------

/**
 * Collapse runs of 2+ consecutive blank lines into a single blank line.
 */
function collapseConsecutiveBlankLines(mod: HtmlMod): void {
  const collapsed = mod.__source.replaceAll(/\n{3,}/g, '\n\n');
  if (collapsed !== mod.__source) {
    const fresh = new HtmlMod(collapsed, mod.__options);
    mod.__source = fresh.__source;
    mod.__dom = fresh.__dom;
    mod.__astUpdater = fresh.__astUpdater;
    mod.__cachedInnerHTML = new WeakMap();
    mod.__cachedOuterHTML = new WeakMap();
  }
}

// ---------------------------------------------------------------------------
// Text node helpers
// ---------------------------------------------------------------------------

function setTextContent(mod: HtmlMod, textNode: SourceText, content: string): void {
  if (textNode.data === content) return;
  const textWrapper = new HtmlModText(textNode, mod);
  textWrapper.innerHTML = content;
}

function insertBeforeIfNeeded(mod: HtmlMod, element: SourceElement, whitespace: string): void {
  const charBefore = mod.__source[element.source.openTag.startIndex - 1];
  if (charBefore === '>' || charBefore === undefined) {
    const wrapper = new HtmlModElement(element, mod);
    wrapper.before(whitespace);
  }
}

function insertAfterIfNeeded(mod: HtmlMod, element: SourceElement, whitespace: string): void {
  const endPos = element.source.closeTag?.endIndex ?? element.endIndex + 1;
  const charAfter = mod.__source[endPos];
  if (charAfter === '<' || charAfter === undefined) {
    const wrapper = new HtmlModElement(element, mod);
    wrapper.after(whitespace);
  }
}

function insertBeforeComment(
  mod: HtmlMod,
  commentNode: { startIndex: number; endIndex: number },
  whitespace: string
): void {
  const startPos = commentNode.startIndex;
  const charBefore = mod.__source[startPos - 1];
  if (charBefore === '>' || charBefore === undefined) {
    mod.__prependLeft(startPos, whitespace);
    shiftPositionsAfter(mod.__dom.children, startPos, whitespace.length);
  }
}

function insertAfterComment(
  mod: HtmlMod,
  commentNode: { startIndex: number; endIndex: number },
  whitespace: string
): void {
  const endPos = commentNode.endIndex + 1;
  const charAfter = mod.__source[endPos];
  if (charAfter === '<' || charAfter === undefined) {
    mod.__appendRight(endPos, whitespace);
    shiftPositionsAfter(mod.__dom.children, endPos, whitespace.length);
  }
}

// ---------------------------------------------------------------------------
// Classification helpers
// ---------------------------------------------------------------------------

function isInline(element: SourceElement): boolean {
  return INLINE_ELEMENTS.has(element.tagName.toLowerCase());
}

function isPreserved(element: SourceElement): boolean {
  return PRESERVE_CONTENT.has(element.tagName.toLowerCase());
}

function hasInlineBlockStyle(node: SourceChildNode): boolean {
  if (!isTag(node)) return false;
  const { attribs } = node as SourceElement;
  if (!attribs) return false;
  const styleKey = Object.keys(attribs).find(k => k.toLowerCase() === 'style');
  const style = styleKey ? attribs[styleKey] : '';
  return /display\s*:\s*inline-block/i.test(style);
}

/** Bubble open comment data ends with `><!`: e.g. `[if !mso]><!` */
function isBubbleOpenData(data: string): boolean {
  return /\[if\s/i.test(data) && data.endsWith('><!');
}

/** Bubble close comment data: e.g. `<![endif]` */
function isBubbleCloseData(data: string): boolean {
  return /\[endif]/i.test(data) && data.startsWith('<!');
}

function isWhitespaceOnly(string_: string): boolean {
  return /^[\t\n\f\r ]*$/.test(string_);
}

/** Strip leading and trailing HTML formatting whitespace, preserving NBSP. */
function trimFormatting(string_: string): string {
  return string_.replace(/^[\t\n\f\r ]+/, '').replace(/[\t\n\f\r ]+$/, '');
}

function trimFormattingWhitespace(mod: HtmlMod): void {
  const leadingMatch = /^[\t\n\f\r ]+/.exec(mod.__source);
  if (leadingMatch) {
    mod.__source = mod.__source.slice(leadingMatch[0].length);
    shiftPositionsAfter(mod.__dom.children, 0, -leadingMatch[0].length);
  }

  const trailingMatch = /[\t\n\f\r ]+$/.exec(mod.__source);
  if (trailingMatch) {
    mod.__source = mod.__source.slice(0, -trailingMatch[0].length);
  }
}

function isMultiLineConditional(node: { data?: string }): boolean {
  if (!node.data) return false;
  const { data } = node;
  if (!/^\[if\s/i.test(data)) return false;
  if (!/\[endif]$/i.test(data)) return false;
  const openMatch = /^\[if\s[^]*?]>/i.exec(data);
  if (!openMatch) return false;
  const closeMatch = /<!\[endif]$/i.exec(data);
  if (!closeMatch) return false;
  const inner = data.slice(openMatch[0].length, data.length - closeMatch[0].length);
  return inner.includes('\n');
}

function buildProtectedBubbleIndices(childArray: Array<SourceElement | SourceText | SourceChildNode>): Set<number> {
  const protectedSet = new Set<number>();

  for (let index = 0; index < childArray.length; index++) {
    const node = childArray[index];
    if (!isComment(node)) continue;
    const data = (node as { data?: string }).data ?? '';
    if (!isBubbleOpenData(data)) continue;

    let hasNewline = false;
    for (let after = index + 1; after < childArray.length; after++) {
      const sibling = childArray[after];

      if (isText(sibling) && (sibling as SourceText).data.includes('\n')) {
        hasNewline = true;
      }

      if (isComment(sibling)) {
        const siblingData = (sibling as { data?: string }).data ?? '';
        if (isBubbleCloseData(siblingData)) {
          if (!hasNewline) {
            for (let protect = index; protect <= after; protect++) {
              protectedSet.add(protect);
            }
          }
          break;
        }
        if (isBubbleOpenData(siblingData)) {
          break;
        }
      }
    }
  }

  return protectedSet;
}

// ---------------------------------------------------------------------------
// Position shifting
// ---------------------------------------------------------------------------

interface AstNode {
  startIndex: number | null;
  endIndex: number | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  children?: Iterable<any>;
  data?: string;
  source?: {
    openTag: { startIndex: number; endIndex: number };
    closeTag?: { startIndex: number; endIndex: number } | null;
    attributes?: Array<{
      name: { startIndex: number; endIndex: number };
      value?: { startIndex: number; endIndex: number } | null;
      source: { startIndex: number; endIndex: number };
    }>;
  };
}

function shiftPositionsAfter(nodes: Iterable<AstNode>, afterPos: number, delta: number): void {
  for (const node of nodes) {
    if (node.startIndex == null || node.endIndex == null) {
      if (node.children) {
        shiftPositionsAfter(node.children, afterPos, delta);
      }
      continue;
    }

    if (node.startIndex >= afterPos) {
      node.startIndex += delta;
      node.endIndex += delta;

      if (node.source?.openTag) {
        node.source.openTag.startIndex += delta;
        node.source.openTag.endIndex += delta;
        if (node.source.closeTag) {
          node.source.closeTag.startIndex += delta;
          node.source.closeTag.endIndex += delta;
        }
        for (const attribute of node.source.attributes ?? []) {
          attribute.name.startIndex += delta;
          attribute.name.endIndex += delta;
          if (attribute.value) {
            attribute.value.startIndex += delta;
            attribute.value.endIndex += delta;
          }
          attribute.source.startIndex += delta;
          attribute.source.endIndex += delta;
        }
      }
    } else if (node.endIndex >= afterPos) {
      node.endIndex += delta;
      if (node.source?.closeTag && node.source.closeTag.startIndex >= afterPos) {
        node.source.closeTag.startIndex += delta;
        node.source.closeTag.endIndex += delta;
      }
    }

    if (node.children) {
      shiftPositionsAfter(node.children, afterPos, delta);
    }
  }
}
