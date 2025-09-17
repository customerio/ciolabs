import findConditionalComments from '@ciolabs/html-find-conditional-comments';
import { preserve, restore } from '@ciolabs/html-preserve-comment-whitespace';
import jsBeautify from 'js-beautify';
import MagicString from 'magic-string';
import pretty from 'pretty';

export default function emailFormatter(
  html: string,
  options?: Parameters<typeof pretty>[1] & jsBeautify.HTMLBeautifyOptions
): string {
  const id = Math.random();
  const opener = `<!--${id}`;
  const closer = `${id}-->`;

  html = closeConditionalComments(html, { opener, closer });

  const cache = preserve(html);
  html = pretty(html, options);
  html = restore(html, cache);
  html = openConditionalComments(html, { opener, closer });
  html = alignOpenAndCloseOfConditionalComments(html);

  return html;
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
  const s = new MagicString(html);

  for (const comment of comments) {
    const contentStartIndex = comment.range[0] + comment.open.length;
    const contentEndIndex = comment.range[1] - comment.close.length;

    s.appendLeft(contentStartIndex, closer);
    s.appendLeft(contentEndIndex, opener);
  }

  return s.toString();
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
  const s = new MagicString(html);

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
      s.overwrite(comment.range[0] - openLeadingWhitespace.length, comment.range[0], closeLeadingWhitespace);
    } else {
      s.overwrite(
        comment.range[1] - comment.close.length - closeLeadingText.length - closeLeadingWhitespace.length,
        comment.range[1] - comment.close.length - closeLeadingText.length,
        openLeadingWhitespace
      );
    }
  }

  return s.toString();
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
