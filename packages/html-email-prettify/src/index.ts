import { HtmlMod, HtmlModElement, HtmlModText } from '@ciolabs/html-mod';
import type { SourceElement, SourceText, SourceChildNode } from '@ciolabs/htmlparser2-source';
import { isComment, isDirective, isTag, isText } from '@ciolabs/htmlparser2-source';

// Position delta helpers — matches the shape expected by HtmlMod.__trackDelta.
// Inlined to avoid sub-path import issues with moduleResolution: node.
const removeDelta = (start: number, end: number) => ({
  operationType: 'remove' as const,
  mutationStart: start,
  mutationEnd: end,
  delta: -(end - start),
});
const prependLeftDelta = (index: number, content: string) => ({
  operationType: 'prependLeft' as const,
  mutationStart: index,
  mutationEnd: index,
  delta: content.length,
});
const appendRightDelta = (index: number, content: string) => ({
  operationType: 'appendRight' as const,
  mutationStart: index,
  mutationEnd: index,
  delta: content.length,
});

// TODO: Replace with `isInlineElement` from `@ciolabs/html-element-display`
// once that package is merged. It covers the full WHATWG spec including
// table-related display types which this hardcoded set does not.
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

const PRESERVE_CONTENT = new Set(['pre', 'code', 'textarea']);

export interface PrettifyOptions {
  /** Number of spaces per indent level (default 2) */
  indentSize?: number;

  /** Character to use for indentation (default ' ') */
  indentChar?: string;

  /**
   * Maximum line length before attribute wrapping kicks in (default 0 = off).
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
}

interface ResolvedOptions {
  indent: string;
  maxLineLength: number;
  wrapAttributes: 'auto' | 'force' | 'force-aligned' | false;
  collapseBlankLines: boolean;
}

function resolveOptions(options?: PrettifyOptions): ResolvedOptions {
  const indentChar = options?.indentChar ?? ' ';
  const indentSize = options?.indentSize ?? 2;
  return {
    indent: indentChar.repeat(indentSize),
    maxLineLength: options?.maxLineLength ?? 0,
    wrapAttributes: options?.wrapAttributes ?? 'auto',
    collapseBlankLines: options?.collapseBlankLines ?? true,
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

  // Depth -1 so that top-level elements sit at indent 0.
  formatChildren(mod, mod.__dom.children as Iterable<SourceElement | SourceText>, -1, resolved);

  if (resolved.wrapAttributes !== false && resolved.maxLineLength > 0) {
    wrapLongAttributes(mod, resolved);
  }

  // Re-sync AST after formatting + wrapping.  formatChildren uses a mix of
  // AST-aware ops (HtmlModElement.before/after) and raw string ops (for
  // comments/directives) that track deltas but don't create text nodes.
  // wrapLongAttributes rewrites opening tags.  Re-parsing here ensures
  // positions are valid for collapse/trim, and that any HtmlModElement
  // handles captured before prettify() are detached cleanly.
  resetHtmlMod(mod, mod.__source);

  if (resolved.collapseBlankLines) {
    collapseConsecutiveBlankLines(mod);
  }

  trimFormattingWhitespace(mod);

  return mod;
}

// ---------------------------------------------------------------------------
// Core formatting
// ---------------------------------------------------------------------------

function formatChildren(
  mod: HtmlMod,
  children: Iterable<SourceElement | SourceText>,
  depth: number,
  options: ResolvedOptions
): void {
  const childArray = [...children];
  const { indent } = options;

  const hasBlock = childArray.some(
    child =>
      (isTag(child) && !isInline(child as SourceElement)) ||
      (isComment(child) && isMultiLineConditional(child)) ||
      isDirective(child)
  );

  if (!hasBlock) return;

  const protectedIndices = buildProtectedBubbleIndices(childArray);
  const childIndent = indent.repeat(Math.max(0, depth + 1));
  const parentIndent = indent.repeat(Math.max(0, depth));

  for (let index = 0; index < childArray.length; index++) {
    const child = childArray[index];
    const previous = childArray[index - 1];
    const isFirst = index === 0;
    const isLast = index === childArray.length - 1;

    // --- Whitespace text nodes -------------------------------------------
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

    // --- Leading whitespace for non-text nodes ---------------------------
    if (isFirst) {
      insertWhitespaceBefore(mod, child, `\n${childIndent}`);
    } else if (
      previous &&
      !isText(previous) &&
      !(hasInlineBlockStyle(previous) && hasInlineBlockStyle(child)) &&
      !protectedIndices.has(index)
    ) {
      insertWhitespaceAfter(mod, previous, `\n${childIndent}`);
    }

    // --- Element nodes ---------------------------------------------------
    if (isTag(child)) {
      const element = child as SourceElement;

      if (isInline(element)) {
        if (isLast) insertWhitespaceAfter(mod, element, `\n${parentIndent}`);
        continue;
      }

      if (!isPreserved(element) && element.children.length > 0) {
        formatChildren(mod, element.children as Iterable<SourceElement | SourceText>, depth + 1, options);
      }

      if (isLast) insertWhitespaceAfter(mod, element, `\n${parentIndent}`);
    }

    // --- Comment nodes ---------------------------------------------------
    if (isComment(child)) {
      if (isLast) insertWhitespaceAfter(mod, child, `\n${parentIndent}`);
      if (isMultiLineConditional(child)) {
        formatInsideConditionalComment(mod, child, depth + 1, options);
      }
    }

    // --- Directive nodes (<!DOCTYPE html>, etc.) -------------------------
    if (isDirective(child) && isLast) {
      insertWhitespaceAfter(mod, child, `\n${parentIndent}`);
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

  // When formatChildren was a no-op (e.g. closing tags parsed as text),
  // re-indent every line.  Otherwise use the formatter's output.
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

  const dataStart = startIndex + 4; // after '<!--'
  const dataEnd = endIndex - 2; // before '-->'
  const oldLength = dataEnd - dataStart;

  mod.__source = mod.__source.slice(0, dataStart) + newData + mod.__source.slice(dataStart + oldLength);

  // Update comment node before the full tree walk so it doesn't get
  // double-shifted.  Then shift everything after the original end.
  const netDelta = newData.length - oldLength;
  commentNode.data = newData;
  commentNode.endIndex += netDelta;

  if (netDelta !== 0) {
    mod.__trackDelta({
      operationType: 'appendRight',
      mutationStart: endIndex + 1,
      mutationEnd: endIndex + 1,
      delta: netDelta,
    });
  }
}

// ---------------------------------------------------------------------------
// Attribute wrapping
// ---------------------------------------------------------------------------

/**
 * Wrap attributes on opening tags that exceed `maxLineLength`.
 * Uses the "break before attribute" style:
 * ```
 * <p
 *   style="margin:1em 0">
 * ```
 *
 * Walks the AST to find elements (safe from comments/inline text),
 * then rewrites their opening tags.  A re-parse at the end of prettify()
 * syncs the AST.
 */
function wrapLongAttributes(mod: HtmlMod, options: ResolvedOptions): void {
  const { maxLineLength, wrapAttributes, indent } = options;

  // Collect elements that need wrapping, with their source positions.
  // Walk the AST so we only touch real element opening tags.
  const targets: Array<{ element: SourceElement; openTagSource: string; startIndex: number }> = [];

  const walk = (nodes: Iterable<SourceElement | SourceText | SourceChildNode>) => {
    for (const node of nodes) {
      if (!isTag(node)) continue;
      const element = node as SourceElement;

      // Check if this element's opening tag needs wrapping
      if (element.source.attributes.length > 0) {
        const openStart = element.source.openTag.startIndex;
        const openEnd = element.source.openTag.endIndex + 1;
        const openTagSource = mod.__source.slice(openStart, openEnd);

        const lineStart = mod.__source.lastIndexOf('\n', openStart) + 1;
        const leadingLength = openStart - lineStart;
        const tagLineLength = leadingLength + openTagSource.length;

        if (wrapAttributes !== 'auto' || tagLineLength > maxLineLength) {
          targets.push({ element, openTagSource, startIndex: openStart });
        }
      }

      // Always walk children
      if (element.children.length > 0) {
        walk(element.children as Iterable<SourceElement | SourceText | SourceChildNode>);
      }
    }
  };
  walk(mod.__dom.children as Iterable<SourceElement | SourceText | SourceChildNode>);

  if (targets.length === 0) return;

  // Process from end to start so earlier positions stay valid
  let newSource = mod.__source;
  for (let index = targets.length - 1; index >= 0; index--) {
    const { element, openTagSource, startIndex } = targets[index];
    const openEnd = element.source.openTag.endIndex + 1;

    // Parse tag name and attributes from the source
    const tagNameMatch = /^<([^\s/=>]+)/.exec(openTagSource);
    if (!tagNameMatch) continue;
    const tagName = tagNameMatch[0]; // e.g. "<table"

    // Extract individual attribute strings from source attributes
    const attributes: string[] = [];
    for (const attribute of element.source.attributes) {
      attributes.push(attribute.source.data);
    }
    if (attributes.length === 0) continue;

    // Get the closing part (> or />)
    const lastAttributeEnd = element.source.attributes.at(-1)!.source.endIndex + 1;
    const closing = openTagSource.slice(lastAttributeEnd - startIndex);

    // Derive indentation from the whitespace-only prefix on this line.
    // If the tag starts mid-line (e.g. <p>Hello <a ...), the prefix
    // contains non-whitespace content — skip wrapping for inline tags
    // that don't start at the beginning of a line.
    const lineStart = newSource.lastIndexOf('\n', startIndex) + 1;
    const linePrefix = newSource.slice(lineStart, startIndex);
    if (!/^[\t ]*$/.test(linePrefix)) continue;
    const leadingWhitespace = linePrefix;

    let replacement: string;
    if (wrapAttributes === 'force-aligned') {
      const alignIndent = ' '.repeat(leadingWhitespace.length + tagName.length + 1);
      replacement = `${tagName} ${attributes[0]}`;
      for (let attributeIndex = 1; attributeIndex < attributes.length; attributeIndex++) {
        replacement += `\n${alignIndent}${attributes[attributeIndex]}`;
      }
      replacement += closing;
    } else {
      const attributeIndent = leadingWhitespace + indent;
      replacement = tagName;
      for (const attribute of attributes) {
        replacement += `\n${attributeIndent}${attribute}`;
      }
      replacement += closing;
    }

    newSource = newSource.slice(0, startIndex) + replacement + newSource.slice(openEnd);
  }

  if (newSource !== mod.__source) {
    mod.__source = newSource;
  }
}

// ---------------------------------------------------------------------------
// Post-processing
// ---------------------------------------------------------------------------

/**
 * Collapse runs of 3+ consecutive newlines into 2 (one blank line).
 * Skips content inside preserved elements (pre, code, textarea).
 */
function collapseConsecutiveBlankLines(mod: HtmlMod): void {
  // Build a set of character ranges to protect
  const protectedRanges = buildPreservedContentRanges(mod);

  const matches = [...mod.__source.matchAll(/\n{3,}/g)];
  if (matches.length === 0) return;

  // Process from end to start so positions stay valid
  for (let index = matches.length - 1; index >= 0; index--) {
    const match = matches[index];
    const matchStart = match.index;

    // Skip if this match is inside a preserved element
    if (protectedRanges.some(([start, end]) => matchStart >= start && matchStart < end)) continue;

    const start = matchStart + 2;
    const end = matchStart + match[0].length;
    mod.__source = mod.__source.slice(0, start) + mod.__source.slice(end);
    mod.__trackDelta(removeDelta(start, end));
  }

  mod.__cachedInnerHTML = new WeakMap();
  mod.__cachedOuterHTML = new WeakMap();
}

/**
 * Collect source ranges of content inside preserved elements (pre, code,
 * textarea).  Used to protect these ranges from post-processing operations.
 */
function buildPreservedContentRanges(mod: HtmlMod): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  const walk = (nodes: Iterable<SourceElement | SourceText | SourceChildNode>) => {
    for (const node of nodes) {
      if (isTag(node)) {
        const element = node as SourceElement;
        if (isPreserved(element)) {
          const contentStart = element.source.openTag.endIndex + 1;
          const contentEnd = element.source.closeTag?.startIndex ?? element.endIndex;
          ranges.push([contentStart, contentEnd]);
        } else if (element.children.length > 0) {
          walk(element.children as Iterable<SourceElement | SourceText | SourceChildNode>);
        }
      }
    }
  };
  walk(mod.__dom.children as Iterable<SourceElement | SourceText | SourceChildNode>);
  return ranges;
}

function trimFormattingWhitespace(mod: HtmlMod): void {
  const leadingMatch = /^[\t\n\f\r ]+/.exec(mod.__source);
  if (leadingMatch) {
    const { length } = leadingMatch[0];
    mod.__source = mod.__source.slice(length);
    mod.__trackDelta(removeDelta(0, length));
  }

  const trailingMatch = /[\t\n\f\r ]+$/.exec(mod.__source);
  if (trailingMatch) {
    mod.__source = mod.__source.slice(0, -trailingMatch[0].length);
  }
}

// ---------------------------------------------------------------------------
// Whitespace insertion
// ---------------------------------------------------------------------------

function setTextContent(mod: HtmlMod, textNode: SourceText, content: string): void {
  if (textNode.data === content) return;
  new HtmlModText(textNode, mod).innerHTML = content;
}

function insertWhitespaceBefore(
  mod: HtmlMod,
  node: SourceElement | SourceText | SourceChildNode,
  whitespace: string
): void {
  const startPos = isTag(node)
    ? (node as SourceElement).source.openTag.startIndex
    : (node as { startIndex: number }).startIndex;
  const charBefore = mod.__source[startPos - 1];
  if (charBefore !== '>' && charBefore !== undefined) return;

  if (isTag(node)) {
    new HtmlModElement(node as SourceElement, mod).before(whitespace);
  } else {
    mod.__prependLeft(startPos, whitespace);
    mod.__trackDelta(prependLeftDelta(startPos, whitespace));
  }
}

function insertWhitespaceAfter(
  mod: HtmlMod,
  node: SourceElement | SourceText | SourceChildNode,
  whitespace: string
): void {
  const endPos = isTag(node)
    ? ((node as SourceElement).source.closeTag?.endIndex ?? (node as SourceElement).endIndex + 1)
    : (node as { endIndex: number }).endIndex + 1;
  const charAfter = mod.__source[endPos];
  if (charAfter !== '<' && charAfter !== undefined) return;

  if (isTag(node)) {
    new HtmlModElement(node as SourceElement, mod).after(whitespace);
  } else {
    mod.__appendRight(endPos, whitespace);
    mod.__trackDelta(appendRightDelta(endPos, whitespace));
  }
}

// ---------------------------------------------------------------------------
// Classification
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

function isBubbleOpenData(data: string): boolean {
  return /\[if\s/i.test(data) && data.endsWith('><!');
}

function isBubbleCloseData(data: string): boolean {
  return /\[endif]/i.test(data) && data.startsWith('<!');
}

function isWhitespaceOnly(string_: string): boolean {
  return /^[\t\n\f\r ]*$/.test(string_);
}

function trimFormatting(string_: string): string {
  return string_.replace(/^[\t\n\f\r ]+/, '').replace(/[\t\n\f\r ]+$/, '');
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

// ---------------------------------------------------------------------------
// Bubble conditional protection
// ---------------------------------------------------------------------------

/**
 * Build a set of child indices protected by single-line bubble conditional
 * pairs.  Identifies open/close structurally in the sibling list so a
 * single-line bubble doesn't accidentally protect a later multi-line one.
 */
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
        if (isBubbleOpenData(siblingData)) break;
      }
    }
  }

  return protectedSet;
}

// ---------------------------------------------------------------------------
// HtmlMod reset (for operations that must re-parse)
// ---------------------------------------------------------------------------

function resetHtmlMod(mod: HtmlMod, newSource: string): void {
  const fresh = new HtmlMod(newSource, mod.__options);
  mod.__source = fresh.__source;
  mod.__dom = fresh.__dom;
  mod.__astUpdater = fresh.__astUpdater;
  mod.__cachedInnerHTML = new WeakMap();
  mod.__cachedOuterHTML = new WeakMap();
}
