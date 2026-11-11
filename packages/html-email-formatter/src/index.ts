import findConditionalComments from '@ciolabs/html-find-conditional-comments';
import { preserve, restore } from '@ciolabs/html-preserve-comment-whitespace';
import jsBeautify from 'js-beautify';
import { rApply as applyRanges } from 'ranges-apply';

export type EmailFormatterOptions = jsBeautify.HTMLBeautifyOptions & {
  /**
   * Condense blank lines, trim the start and end of the document, add a blank
   * line above each comment, and pull closing comments up to their tag.
   */
  ocd?: boolean;
  /** The line separator `ocd` condenses runs of blank lines into. Defaults to `\n`. */
  newlines?: string;
};

// The defaults the `pretty` package applied before this package called js-beautify directly.
/* eslint-disable camelcase -- js-beautify's option names */
const DEFAULT_OPTIONS: jsBeautify.HTMLBeautifyOptions = {
  unformatted: ['code', 'pre', 'em', 'strong', 'span'],
  indent_inner_html: true,
  indent_char: ' ',
  indent_size: 2,
  // js-beautify 1.14 started formatting custom elements (any tag with a dash)
  // as inline, which pulled Carta's <x-conditional> and similar tags onto one line.
  inline_custom_elements: false,
};
/* eslint-enable camelcase */

export default function emailFormatter(html: string, options?: EmailFormatterOptions): string {
  const id = Math.random();
  const opener = `<!--${id}`;
  const closer = `${id}-->`;

  html = closeConditionalComments(html, { opener, closer });

  const cache = preserve(html);
  html = beautify(html, options);
  html = restore(html, cache);
  html = openConditionalComments(html, { opener, closer });
  html = alignOpenAndCloseOfConditionalComments(html);

  return html;
}

function beautify(html: string, { ocd, newlines, ...options }: EmailFormatterOptions = {}) {
  const beautified = jsBeautify.html(html, { ...DEFAULT_OPTIONS, ...options });
  return ocd === true ? condense(beautified, newlines ?? '\n') : beautified;
}

const BLANK_LINE = /^[\s"\u180E]+$/;

/**
 * The `ocd` pass from the `pretty` package
 */
function condense(html: string, separator: string) {
  return (
    html
      // Trim lines that are only whitespace, so runs of them condense below.
      // `pretty` counted `"` and U+180E as whitespace too, so this does as well.
      .split('\n')
      .map(line => (BLANK_LINE.test(line) ? line.trim() : line))
      .join('\n')
      .replaceAll(/\s+$/g, '\n')
      .replaceAll(/(\r\n|\n|\u2424){2,}/g, separator)
      // Remove whitespace at the start of the document.
      .replaceAll(/^\s+/g, '')
      // Remove extra whitespace at the end of the document.
      .replaceAll(/\s+$/g, '\n')
      // Add a blank line above each comment.
      .replaceAll(/(\s*<!--)/g, '\n$1')
      // Bring closing comments up to the same line as the closing tag.
      .replaceAll(/>(\s*)(?=<!--\s*\/)/g, '> ')
  );
}

/**
 * Close downlevel-hidden conditional comments
 *
 * Example:
 * <!--[if mso]>
 *  <p>Content</p>
 * <![endif]-->
 *
 * Becomes:
 * <!--[if mso]>123456789-->
 * <p>Content</p>
 * <!--123456789<![endif]-->
 *
 * This opens the the MSO HTML to be formatted by the HTML formatter.
 */
function closeConditionalComments(html: string, { opener, closer }: { opener: string; closer: string }) {
  const comments = findConditionalComments(html);

  const ranges: Array<[number, number, string]> = [];
  for (const comment of comments) {
    const contentStartIndex = comment.range[0] + comment.open.length;
    const contentEndIndex = comment.range[1] - comment.close.length;

    ranges.push([contentStartIndex, contentStartIndex, closer], [contentEndIndex, contentEndIndex, opener]);
  }

  return applyRanges(html, ranges);
}

/**
 * Open downlevel-hidden conditional comments
 *
 * Example:
 * <!--[if mso]>123456789-->
 * <p>Content</p>
 * <!--123456789<![endif]-->
 *
 * Becomes:
 * <!--[if mso]>
 * <p>Content</p>
 * <![endif]-->
 *
 * This reverses the effect of `closeConditionalComments`. After the HTML
 * formatter has formatted the MSO HTML, we restore the original state.
 */
function openConditionalComments(html: string, { opener, closer }: { opener: string; closer: string }) {
  return html.replaceAll(new RegExp(`(${opener}|${closer})`, 'g'), '');
}

/**
 * Align open and close tags of conditional comments
 */
function alignOpenAndCloseOfConditionalComments(html: string) {
  const comments = findConditionalComments(html);

  const ranges: Array<[number, number, string]> = [];
  for (const comment of comments) {
    const code = new Set(html.slice(comment.range[0], comment.range[1]));
    if (!code.has('\n') && !code.has('\r')) {
      continue;
    }

    const { whitespace: openLeadingWhitespace } = parseWhitespaceAndTextOfLastLine(
      html.slice(0, Math.max(0, comment.range[0]))
    );
    const { whitespace: closeLeadingWhitespace, text: closeLeadingText } = parseWhitespaceAndTextOfLastLine(
      html.slice(comment.range[0], comment.range[1] - comment.close.length)
    );

    if (openLeadingWhitespace.length === closeLeadingWhitespace.length) {
      continue;
    }

    if (openLeadingWhitespace.length > closeLeadingWhitespace.length) {
      ranges.push([comment.range[0] - openLeadingWhitespace.length, comment.range[0], closeLeadingWhitespace]);
    } else {
      ranges.push([
        comment.range[1] - comment.close.length - closeLeadingText.length - closeLeadingWhitespace.length,
        comment.range[1] - comment.close.length - closeLeadingText.length,
        openLeadingWhitespace,
      ]);
    }
  }

  return applyRanges(html, ranges);
}

function parseWhitespaceAndTextOfLastLine(string_: string): {
  whitespace: string;
  text: string;
} {
  const lastLine = string_.split('\n').at(-1) ?? '';
  const match = /^[^\S\n\r]*/.exec(lastLine);
  const whitespace = match ? match[0] : '';
  const text = lastLine.slice(whitespace.length);

  return { whitespace, text };
}
