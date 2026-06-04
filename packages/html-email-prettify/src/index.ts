import findConditionalComments from '@ciolabs/html-find-conditional-comments';
import { HtmlMod, HtmlModElement, HtmlModText } from '@ciolabs/html-mod';
import type { SourceElement, SourceText, SourceChildNode } from '@ciolabs/htmlparser2-source';
import { isComment, isTag, isText } from '@ciolabs/htmlparser2-source';

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
  const mod = input instanceof HtmlMod ? input : new HtmlMod(input);
  const indent = (options?.indentChar ?? ' ').repeat(options?.indentSize ?? 2);

  // Collect comment data strings for single-line bubble/revealed
  // conditionals.  Position-independent — survives formatting mutations.
  const bubbleCommentData = buildSingleLineBubbleCommentData(mod.__source);

  // Format the document tree.
  // Depth -1 so that top-level elements sit at indent 0.
  formatChildren(mod, mod.__dom.children as Iterable<SourceElement | SourceText>, -1, indent, bubbleCommentData);

  // Trim trailing whitespace on the document
  mod.trimEnd();
  // Trim leading empty lines
  mod.trimStart();

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
  indent: string,
  bubbleCommentData: Set<string>
): void {
  const childArray = [...children];

  // Determine if this list contains any block-level content.
  // If it's all inline / text we leave it alone.
  // Preserved elements (pre, code, textarea) count as block — we format
  // whitespace *around* them, just not inside them.
  // Multi-line conditional comments also count — they need internal formatting.
  const hasBlock = childArray.some(
    child => (isTag(child) && !isInline(child as SourceElement)) || (isComment(child) && isMultiLineConditional(child))
  );

  if (!hasBlock) return;

  // Check if any sibling is a bubble comment — if so, text nodes between
  // bubble comment pairs are protected (position-independent check).
  const hasBubbleSibling = childArray.some(
    child => isComment(child) && bubbleCommentData.has((child as { data?: string }).data ?? '')
  );

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
    // Skip text nodes that sit between bubble comment pairs — those are
    // inside a single-line conditional and must not be touched.
    if (isText(child)) {
      const textNode = child as SourceText;
      if (
        isWhitespaceOnly(textNode.data) &&
        !(hasBubbleSibling && isTextBetweenBubbleComments(index, childArray, bubbleCommentData))
      ) {
        setTextContent(mod, textNode, `\n${isLast ? parentIndent : childIndent}`);
      }
      continue;
    }

    // --- Ensure leading whitespace before any non-text node ---------------
    if (isFirst) {
      // First child — insert whitespace after parent open tag.
      if (isTag(child)) {
        insertBeforeIfNeeded(mod, child as SourceElement, `\n${childIndent}`);
      } else if (isComment(child)) {
        insertBeforeComment(mod, child, `\n${childIndent}`);
      }
    } else if (
      previous &&
      !isText(previous) &&
      !(hasInlineBlockStyle(previous) && hasInlineBlockStyle(child)) &&
      !isBubbleCommentBoundary(previous, child, bubbleCommentData)
    ) {
      // Two non-text nodes directly adjacent — insert whitespace between
      // them.  Skip when:
      // - BOTH are display:inline-block (email column pattern)
      // - Either node is a comment belonging to a single-line bubble
      //   conditional (e.g. <!--[if !mso]><!-->...<![endif]-->)
      if (isTag(previous)) {
        insertAfterIfNeeded(mod, previous as SourceElement, `\n${childIndent}`);
      } else if (isComment(previous)) {
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
        formatChildren(
          mod,
          element.children as Iterable<SourceElement | SourceText>,
          depth + 1,
          indent,
          bubbleCommentData
        );
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
  const openMatch = /^\[if\s[^]*?]>/.exec(data);
  const closeMatch = /<!\[endif]$/.exec(data);
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
  const innerBubbleData = buildSingleLineBubbleCommentData(trimmedInnerHtml);
  formatChildren(
    innerMod,
    innerMod.__dom.children as Iterable<SourceElement | SourceText>,
    depth - 1,
    indent,
    innerBubbleData
  );

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
  return INLINE_ELEMENTS.has(element.tagName);
}

function isPreserved(element: SourceElement): boolean {
  return PRESERVE_CONTENT.has(element.tagName);
}

function hasInlineBlockStyle(node: SourceChildNode): boolean {
  if (!isTag(node)) return false;
  const style = (node as SourceElement).attribs?.style ?? '';
  return /display\s*:\s*inline-block/i.test(style);
}

function isWhitespaceOnly(string_: string): boolean {
  return /^\s*$/.test(string_);
}

function isMultiLineConditional(node: { data?: string }): boolean {
  if (!node.data) return false;
  const { data } = node;
  if (!data.startsWith('[if ')) return false;
  if (!data.endsWith('<![endif]')) return false;
  // Extract inner content
  const openMatch = /^\[if\s[^]*?]>/.exec(data);
  if (!openMatch) return false;
  const inner = data.slice(openMatch[0].length, data.length - '<![endif]'.length);
  return inner.includes('\n');
}

/**
 * Check whether a text node at `index` in `childArray` sits between
 * two comments that form a single-line bubble conditional.  This is a
 * position-independent check — it walks siblings by array index, so it
 * survives source mutations that shift absolute offsets.
 */
function isTextBetweenBubbleComments(
  index: number,
  childArray: Array<SourceElement | SourceText | SourceChildNode>,
  bubbleData: Set<string>
): boolean {
  // Scan backwards for a bubble open comment
  let foundOpen = false;
  for (let before = index - 1; before >= 0; before--) {
    const node = childArray[before];
    if (isComment(node) && bubbleData.has((node as { data?: string }).data ?? '')) {
      foundOpen = true;
      break;
    }
  }
  if (!foundOpen) return false;

  // Scan forwards for a bubble close comment
  for (let after = index + 1; after < childArray.length; after++) {
    const node = childArray[after];
    if (isComment(node) && bubbleData.has((node as { data?: string }).data ?? '')) {
      return true;
    }
  }
  return false;
}

/**
 * Check whether either adjacent node is a comment that belongs to a
 * single-line bubble/revealed conditional.  This protects patterns like
 * `<!--[if !mso]><!-->...<![endif]-->` where inserting whitespace next
 * to the comment would break inline-block layouts.
 *
 * Unlike position-range checks, this uses comment data strings which
 * don't shift during formatting.
 */
function isBubbleCommentBoundary(
  nodeA: SourceElement | SourceText | SourceChildNode,
  nodeB: SourceElement | SourceText | SourceChildNode,
  bubbleData: Set<string>
): boolean {
  if (bubbleData.size === 0) return false;
  for (const node of [nodeA, nodeB]) {
    if (isComment(node)) {
      const data = (node as { data?: string }).data ?? '';
      if (bubbleData.has(data)) return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Single-line bubble conditional comment detection
// ---------------------------------------------------------------------------

/**
 * Collect the comment data strings for comments that form single-line
 * bubble/revealed conditionals.  For `<!--[if !mso]><!-->...<![endif]-->`,
 * the opening comment has data `[if !mso]><!` and the closing comment
 * has data `<![endif]`.  Both are added to the set.
 *
 * These are used for position-independent checks that survive source
 * mutations during formatting.
 */
function buildSingleLineBubbleCommentData(html: string): Set<string> {
  const comments = findConditionalComments(html);
  const dataSet = new Set<string>();

  for (const comment of comments) {
    if (!comment.bubble) continue;
    const content = html.slice(comment.range[0] + comment.open.length, comment.range[1] - comment.close.length);
    if (content.includes('\n')) continue;

    // Extract the comment data from the open and close strings.
    // <!--[if !mso]><!--> has comment data "[if !mso]><!"
    // <!--<![endif]--> has comment data "<![endif]"
    const openData = comment.open.slice(4, -3); // strip "<!--" and "-->"
    const closeData = comment.close.slice(4, -3); // strip "<!--" and "-->"
    if (openData) dataSet.add(openData);
    if (closeData) dataSet.add(closeData);
  }

  return dataSet;
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
