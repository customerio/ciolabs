import findConditionalComments from '@ciolabs/html-find-conditional-comments';
import { HtmlMod, HtmlModElement, HtmlModText } from '@ciolabs/html-mod';
import type { SourceElement, SourceText, SourceChildNode } from '@ciolabs/htmlparser2-source';
import { isComment, isTag, isText } from '@ciolabs/htmlparser2-source';

/**
 * Inline HTML elements — we never add newlines around these.
 */
const INLINE_ELEMENTS = new Set([
  'a',
  'abbr',
  'b',
  'bdo',
  'br',
  'cite',
  'code',
  'del',
  'dfn',
  'em',
  'i',
  'img',
  'ins',
  'kbd',
  'label',
  'mark',
  'q',
  's',
  'samp',
  'small',
  'span',
  'strong',
  'sub',
  'sup',
  'time',
  'u',
  'var',
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

  // Build a set of character ranges for single-line conditional comments.
  // We must not touch whitespace inside these.
  const singleLineRanges = buildSingleLineConditionalRanges(mod.__source);

  // Format the document tree.
  // Depth -1 so that top-level elements sit at indent 0.
  formatChildren(mod, mod.__dom.children as Iterable<SourceElement | SourceText>, -1, indent, singleLineRanges);

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
  singleLineRanges: Array<[number, number]>
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
    if (isText(child)) {
      const textNode = child as SourceText;
      if (isWhitespaceOnly(textNode.data) && !isInsideSingleLineConditional(textNode, singleLineRanges)) {
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
    } else if (previous && !isText(previous) && !(hasInlineBlockStyle(previous) && hasInlineBlockStyle(child))) {
      // Two non-text nodes directly adjacent — insert whitespace between
      // them.  Skip only when BOTH are display:inline-block — that's the
      // email column pattern where any gap breaks the layout on iOS/Android.
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
          singleLineRanges
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
        formatInsideConditionalComment(mod, child, depth + 1, indent, singleLineRanges);
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
  indent: string,
  _singleLineRanges: Array<[number, number]>
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
  const innerSingleLineRanges = buildSingleLineConditionalRanges(trimmedInnerHtml);
  formatChildren(
    innerMod,
    innerMod.__dom.children as Iterable<SourceElement | SourceText>,
    depth - 1,
    indent,
    innerSingleLineRanges
  );

  // Align the close tag (<![endif]) with the open tag (<!--[if).
  // The caller passes `depth + 1`, so `depth` here equals the comment's
  // own indentation level in the outer document.
  const commentIndent = indent.repeat(Math.max(0, depth));
  let innerFormatted = innerMod.__source.trimEnd();

  // Ensure a leading newline so content starts on the line after <!--[if]>
  if (!innerFormatted.startsWith('\n')) {
    innerFormatted = `\n${commentIndent}${innerFormatted}`;
  }

  const formatted = `${innerFormatted}\n${commentIndent}`;

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
  // shiftPositionsAfter uses `endIndex + 1` as boundary — at this point
  // commentNode.endIndex is still the original value, so the walk won't
  // match the comment in the `startIndex >= afterPos` branch and can
  // only hit the `endIndex >= afterPos` branch.  But we're about to
  // set endIndex ourselves, so shift first to avoid double-counting.
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

function isInsideSingleLineConditional(textNode: SourceText, ranges: Array<[number, number]>): boolean {
  for (const [start, end] of ranges) {
    if (textNode.startIndex >= start && textNode.endIndex <= end) {
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Single-line conditional comment detection
// ---------------------------------------------------------------------------

function buildSingleLineConditionalRanges(html: string): Array<[number, number]> {
  const comments = findConditionalComments(html);
  const ranges: Array<[number, number]> = [];

  for (const comment of comments) {
    const content = html.slice(comment.range[0] + comment.open.length, comment.range[1] - comment.close.length);
    if (!content.includes('\n')) {
      ranges.push(comment.range);
    }
  }

  return ranges;
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
