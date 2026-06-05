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
  const indent = (options?.indentChar ?? ' ').repeat(options?.indentSize ?? 2);

  // Format the document tree.
  // Depth -1 so that top-level elements sit at indent 0.
  formatChildren(mod, mod.__dom.children as Iterable<SourceElement | SourceText>, -1, indent);

  // Trim only HTML formatting whitespace at document boundaries.
  // Preserve NBSP (\u00A0) and other semantic Unicode spaces.
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
  indent: string
): void {
  const childArray = [...children];

  // Determine if this list contains any block-level content.
  // If it's all inline / text we leave it alone.
  // Preserved elements (pre, code, textarea) count as block — we format
  // whitespace *around* them, just not inside them.
  // Multi-line conditional comments also count — they need internal formatting.
  const hasBlock = childArray.some(
    child =>
      (isTag(child) && !isInline(child as SourceElement)) ||
      (isComment(child) && isMultiLineConditional(child)) ||
      isDirective(child)
  );

  if (!hasBlock) return;

  // Build a set of child indices that are protected by single-line bubble
  // conditional pairs.  Computed per sibling list so a single-line bubble
  // doesn't accidentally protect a multi-line bubble later in the same list.
  const protectedIndices = buildProtectedBubbleIndices(childArray);

  const childIndent = indent.repeat(Math.max(0, depth + 1));
  const parentIndent = indent.repeat(Math.max(0, depth));

  for (let index = 0; index < childArray.length; index++) {
    const child = childArray[index];
    const previous = childArray[index - 1];
    const isFirst = index === 0;
    const isLast = index === childArray.length - 1;

    // --- Whitespace text nodes between siblings --------------------------
    // In a block context, normalize whitespace-only text nodes to the
    // correct indentation regardless of what follows (block or inline).
    // Skip when:
    // - The index is protected by a single-line bubble conditional pair
    // - The text separates two display:inline-block elements (column gap)
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
      // First child — insert whitespace after parent open tag.
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
      // Two non-text nodes directly adjacent — insert whitespace between
      // them.  Skip when:
      // - BOTH are display:inline-block (email column pattern)
      // - The index is protected by a single-line bubble conditional pair
      if (isTag(previous)) {
        insertAfterIfNeeded(mod, previous as SourceElement, `\n${childIndent}`);
      } else if (isComment(previous) || isDirective(previous)) {
        insertAfterComment(mod, previous, `\n${childIndent}`);
      }
    }

    // --- Element nodes ---------------------------------------------------
    if (isTag(child)) {
      const element = child as SourceElement;

      // Skip recursion for inline elements
      if (isInline(element)) {
        if (isLast) {
          insertAfterIfNeeded(mod, element, `\n${parentIndent}`);
        }
        continue;
      }

      // Recurse into children (unless content is preserved)
      if (!isPreserved(element) && element.children.length > 0) {
        formatChildren(mod, element.children as Iterable<SourceElement | SourceText>, depth + 1, indent);
      }

      // Ensure trailing whitespace if last child
      if (isLast) {
        insertAfterIfNeeded(mod, element, `\n${parentIndent}`);
      }
    }

    // --- Comment nodes ----------------------------------------------------
    if (isComment(child)) {
      // Ensure trailing whitespace if last child
      if (isLast) {
        insertAfterComment(mod, child, `\n${parentIndent}`);
      }

      // Format inside multi-line conditional comments
      if (isMultiLineConditional(child)) {
        formatInsideConditionalComment(mod, child, depth + 1, indent);
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

/**
 * Format the HTML content inside a multi-line conditional comment.
 *
 * The comment content looks like: `[if mso]>\n<table>...\n<![endif]`
 * We extract the inner HTML, format it in a temporary HtmlMod, and
 * splice the result back into the comment.
 */
function formatInsideConditionalComment(
  mod: HtmlMod,
  commentNode: { startIndex: number; endIndex: number; data: string },
  depth: number,
  indent: string
): void {
  const { data, startIndex, endIndex } = commentNode;

  // Extract the opening conditional (e.g., "[if mso]>") and closing (e.g., "<![endif]")
  const openMatch = /^\[if\s[^]*?]>/i.exec(data);
  const closeMatch = /<!\[endif]$/i.exec(data);
  if (!openMatch || !closeMatch) return;

  const rawInnerHtml = data.slice(openMatch[0].length, data.length - closeMatch[0].length);
  const trimmedInnerHtml = rawInnerHtml.trim();
  if (!trimmedInnerHtml) return;

  // Format the inner HTML in a scoped HtmlMod.
  // Trim first so the formatter sees clean HTML without leading/trailing
  // whitespace that would produce bad indentation at the top level.
  // Pass depth - 1 because formatChildren adds 1 for children — the
  // inner content should be indented at `depth` level (matching where
  // the comment sits in the outer document).
  const innerMod = new HtmlMod(trimmedInnerHtml);
  formatChildren(innerMod, innerMod.__dom.children as Iterable<SourceElement | SourceText>, depth - 1, indent);

  // Align the close tag (<![endif]) with the open tag (<!--[if).
  // The caller passes `depth + 1`, so `depth` here equals the comment's
  // own indentation level in the outer document.
  const commentIndent = indent.repeat(Math.max(0, depth));

  // When formatChildren was a no-op (e.g. closing tags like </td></tr></table>
  // which htmlparser2 parses as text), re-indent every line to the comment's
  // level.  Otherwise strip only the leading newline (formatChildren inserts
  // one before the first child) but keep the indent.
  const innerFormatted =
    innerMod.__source === trimmedInnerHtml
      ? trimmedInnerHtml
          .split('\n')
          .map(line => `${commentIndent}${line.trim()}`)
          .join('\n')
      : innerMod.__source.replace(/^\n/, '').trimEnd();

  const formatted = `\n${innerFormatted}\n${commentIndent}`;

  const newData = `${openMatch[0]}${formatted}${closeMatch[0]}`;
  if (newData === data) return;

  // Overwrite the comment content in the source string.
  // Comment source in htmlparser2: <!--DATA-->
  // startIndex points to '<', data starts at startIndex + 4 (after '<!--')
  const dataStart = startIndex + 4;
  const dataEnd = endIndex - 2; // before '-->'
  const oldLength = dataEnd - dataStart;
  const { length: newLength } = newData;

  mod.__source = mod.__source.slice(0, dataStart) + newData + mod.__source.slice(dataStart + oldLength);

  const delta = newLength - oldLength;

  // Shift sibling nodes BEFORE touching the comment itself.
  if (delta !== 0) {
    shiftPositionsAfter(mod.__dom.children, endIndex + 1, delta);
  }

  // Now update the comment node itself.
  commentNode.data = newData;
  commentNode.endIndex += delta;
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
  // Check if there's already whitespace before this element
  const charBefore = mod.__source[element.source.openTag.startIndex - 1];
  if (charBefore === '>' || charBefore === undefined) {
    // No whitespace — insert via element wrapper
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
    // Shift nodes after
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
  const style = (node as SourceElement).attribs?.style ?? '';
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

/**
 * Whether a string contains only HTML formatting whitespace (tab, newline,
 * form-feed, carriage return, space).  Does NOT match \u00A0 (NBSP) or
 * other Unicode spaces — those are semantic content.
 */
function isWhitespaceOnly(string_: string): boolean {
  return /^[\t\n\f\r ]*$/.test(string_);
}

/**
 * Trim only HTML formatting whitespace (tab, newline, form-feed, carriage
 * return, space) from the start and end of the document.  Unlike JS
 * String.trim(), this preserves NBSP and other Unicode spaces.
 */
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
  // Extract inner content
  const openMatch = /^\[if\s[^]*?]>/i.exec(data);
  if (!openMatch) return false;
  const closeMatch = /<!\[endif]$/i.exec(data);
  if (!closeMatch) return false;
  const inner = data.slice(openMatch[0].length, data.length - closeMatch[0].length);
  return inner.includes('\n');
}

/**
 * Build a set of child indices that are protected by single-line bubble
 * conditional comment pairs.  Walks the sibling list to find bubble open
 * comments (data matches `[if ...`), then checks if the matching close
 * (data matches `[endif]`) appears without any newlines in between.
 * Only the indices between a matched single-line pair are protected.
 *
 * This per-sibling-list approach means a single-line bubble doesn't
 * accidentally protect a later multi-line bubble with the same data.
 */
function buildProtectedBubbleIndices(childArray: Array<SourceElement | SourceText | SourceChildNode>): Set<number> {
  const protectedSet = new Set<number>();

  for (let index = 0; index < childArray.length; index++) {
    const node = childArray[index];
    if (!isComment(node)) continue;
    const data = (node as { data?: string }).data ?? '';
    // Bubble open comments end with "><!": <!--[if !mso]><!-->
    // Downlevel-hidden comments contain the full content and end with <![endif]
    if (!isBubbleOpenData(data)) continue;

    // Found a bubble open — scan forward for the matching close
    let hasNewline = false;
    for (let after = index + 1; after < childArray.length; after++) {
      const sibling = childArray[after];

      // Check for newlines in text nodes between open and close
      if (isText(sibling) && (sibling as SourceText).data.includes('\n')) {
        hasNewline = true;
      }

      if (isComment(sibling)) {
        const siblingData = (sibling as { data?: string }).data ?? '';
        if (isBubbleCloseData(siblingData)) {
          // Found matching close — protect everything between if single-line
          if (!hasNewline) {
            for (let protect = index; protect <= after; protect++) {
              protectedSet.add(protect);
            }
          }
          break;
        }
        if (isBubbleOpenData(siblingData)) {
          // Hit another open before finding close — stop
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

/**
 * After a raw string mutation, shift all AST node positions that come
 * after `afterPos` by `delta` characters.
 */
function shiftPositionsAfter(nodes: Iterable<AstNode>, afterPos: number, delta: number): void {
  for (const node of nodes) {
    if (node.startIndex == null || node.endIndex == null) {
      // Recurse into children even if this node has no position
      if (node.children) {
        shiftPositionsAfter(node.children, afterPos, delta);
      }
      continue;
    }

    if (node.startIndex >= afterPos) {
      node.startIndex += delta;
      node.endIndex += delta;

      // For tag elements, shift source positions too
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
      // Node spans the edit point — only shift endIndex
      node.endIndex += delta;
      if (node.source?.closeTag && node.source.closeTag.startIndex >= afterPos) {
        node.source.closeTag.startIndex += delta;
        node.source.closeTag.endIndex += delta;
      }
    }

    // Recurse into children
    if (node.children) {
      shiftPositionsAfter(node.children, afterPos, delta);
    }
  }
}
