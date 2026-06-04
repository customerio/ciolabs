import findConditionalComments from '@ciolabs/html-find-conditional-comments';
import { HtmlMod } from '@ciolabs/html-mod';
import { preprocess, postprocess } from '@ciolabs/html-process-conditional-comments';
import jsBeautify from 'js-beautify';

/**
 * Inline HTML elements — a formatter must never introduce whitespace
 * between adjacent inline elements when none existed in the source.
 */
const INLINE_ELEMENTS = [
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
];

export type PrettifyOptions = jsBeautify.HTMLBeautifyOptions;

/**
 * Format and prettify HTML email content.
 *
 * Accepts an `HtmlMod` instance or a raw HTML string.
 * - If `HtmlMod`, the instance is mutated in place and returned.
 * - If `string`, a new `HtmlMod` is created from the formatted result.
 *
 * Email-safe: preserves whitespace inside single-line conditional
 * comments, `<pre>`, `<code>`, and between adjacent inline elements.
 */
export default function prettify(input: HtmlMod | string, options?: PrettifyOptions): HtmlMod {
  const isHtmlMod = input instanceof HtmlMod;
  let html = isHtmlMod ? input.__source : input;

  // Step 1: Record single-line conditional comments so we can restore them
  const originalComments = findConditionalComments(html);
  const singleLineSnapshots: SingleLineSnapshot[] = [];

  for (const [commentIndex, comment] of originalComments.entries()) {
    const content = html.slice(comment.range[0] + comment.open.length, comment.range[1] - comment.close.length);

    if (!content.includes('\n')) {
      singleLineSnapshots.push({
        index: commentIndex,
        content,
        open: comment.open,
        close: comment.close,
      });
    }
  }

  // Step 2: Preprocess conditional comments — expose inner HTML for formatting
  html = preprocess(html);

  // Step 3: Format with js-beautify
  // eslint-disable-next-line camelcase
  html = jsBeautify.html(html, {
    indent_size: 2, // eslint-disable-line camelcase
    indent_char: ' ', // eslint-disable-line camelcase
    wrap_line_length: 0, // eslint-disable-line camelcase
    preserve_newlines: true, // eslint-disable-line camelcase
    max_preserve_newlines: 1, // eslint-disable-line camelcase
    indent_inner_html: true, // eslint-disable-line camelcase
    extra_liners: [], // eslint-disable-line camelcase
    content_unformatted: ['pre', 'code', 'textarea'], // eslint-disable-line camelcase
    inline: INLINE_ELEMENTS,
    unformatted: [],
    ...options,
  });

  // Step 4: Postprocess conditional comments — close them back up
  html = postprocess(html);

  // Step 5: Restore single-line conditional comments to their original content
  html = restoreSingleLineComments(html, singleLineSnapshots);

  // Step 6: Align open/close indentation of multi-line conditional comments
  html = alignConditionalComments(html);

  // Step 7: Return HtmlMod
  if (isHtmlMod) {
    resetHtmlMod(input, html);
    return input;
  }

  return new HtmlMod(html);
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface SingleLineSnapshot {
  /** Index in the original findConditionalComments array */
  index: number;
  /** The HTML content between open and close (no newlines) */
  content: string;
  /** The opening syntax, e.g. `<!--[if mso]>` */
  open: string;
  /** The closing syntax, e.g. `<![endif]-->` */
  close: string;
}

// ---------------------------------------------------------------------------
// Restore single-line conditional comments
// ---------------------------------------------------------------------------

/**
 * After formatting, conditional comments that were originally on a single
 * line may have been expanded across multiple lines.  This puts them back.
 *
 * We match by index position in the `findConditionalComments` array and
 * verify the open/close strings still match before restoring.
 */
function restoreSingleLineComments(html: string, snapshots: SingleLineSnapshot[]): string {
  if (snapshots.length === 0) return html;

  const comments = findConditionalComments(html);

  // Process in reverse so earlier indices aren't shifted by replacements
  for (const snapshot of [...snapshots].reverse()) {
    if (snapshot.index >= comments.length) continue;
    const formatted = comments[snapshot.index];

    // Safety: make sure it's the same comment
    if (formatted.open !== snapshot.open || formatted.close !== snapshot.close) continue;

    const restored = snapshot.open + snapshot.content + snapshot.close;
    html = html.slice(0, formatted.range[0]) + restored + html.slice(formatted.range[1]);
  }

  return html;
}

// ---------------------------------------------------------------------------
// Align conditional comment indentation
// ---------------------------------------------------------------------------

/**
 * For multi-line conditional comments, ensure the opening and closing
 * tags sit at the same indentation level.
 */
function alignConditionalComments(html: string): string {
  const comments = findConditionalComments(html);

  // Collect alignment adjustments
  const adjustments: Array<[number, number, string]> = [];

  for (const comment of comments) {
    const commentChars = new Set(html.slice(comment.range[0], comment.range[1]));
    if (!commentChars.has('\n') && !commentChars.has('\r')) continue;

    const { whitespace: openWs } = parseLastLine(html.slice(0, Math.max(0, comment.range[0])));

    const { whitespace: closeWs, text: closeText } = parseLastLine(
      html.slice(comment.range[0], comment.range[1] - comment.close.length)
    );

    if (openWs.length === closeWs.length) continue;

    if (openWs.length > closeWs.length) {
      // Reduce opening indent to match closing
      adjustments.push([comment.range[0] - openWs.length, comment.range[0], closeWs]);
    } else {
      // Reduce closing indent to match opening
      const closeFullLength = closeWs.length + closeText.length;
      adjustments.push([
        comment.range[1] - comment.close.length - closeFullLength,
        comment.range[1] - comment.close.length - closeText.length,
        openWs,
      ]);
    }
  }

  // Apply adjustments from end to start so indices stay valid
  adjustments.sort((a, b) => b[0] - a[0]);
  for (const [start, end, replacement] of adjustments) {
    html = html.slice(0, start) + replacement + html.slice(end);
  }

  return html;
}

function parseLastLine(string_: string): { whitespace: string; text: string } {
  const lastLine = string_.split('\n').at(-1) ?? '';
  const match = /^[^\S\n\r]*/.exec(lastLine);
  const whitespace = match ? match[0] : '';
  const text = lastLine.slice(whitespace.length);
  return { whitespace, text };
}

// ---------------------------------------------------------------------------
// HtmlMod mutation
// ---------------------------------------------------------------------------

/**
 * Reset an existing HtmlMod so its internal state reflects `newSource`.
 * We create a throwaway HtmlMod to parse the source, then copy
 * the parsed DOM and bookkeeping into the original instance.
 */
function resetHtmlMod(mod: HtmlMod, newSource: string): void {
  const fresh = new HtmlMod(newSource, mod.__options);
  mod.__source = fresh.__source;
  mod.__dom = fresh.__dom;
  mod.__astUpdater = fresh.__astUpdater;
  mod.__cachedInnerHTML = new WeakMap();
  mod.__cachedOuterHTML = new WeakMap();
}
