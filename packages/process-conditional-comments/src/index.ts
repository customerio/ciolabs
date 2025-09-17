import findConditionalComments from '@ciolabs/find-conditional-comments';
import MagicString from 'magic-string';

const OPENER = `<!--__PROCESS_CONDITIONAL_COMMENTS`;
const CLOSER = `__PROCESS_CONDITIONAL_COMMENTS-->`;

/**
 * Unwraps the HTML inside of MSO conditional comments
 * by closing the comment before the HTML and opening
 * the comment after the HTML.
 *
 * @example
 * ```
 * <!--[if mso]>HTML<![endif]-->
 * ```
 * becomes
 * ```
 * <!--[if mso]>__PROCESS_CONDITIONAL_COMMENTS-->HTML<!--__PROCESS_CONDITIONAL_COMMENTS<![endif]-->
 * ```
 */
export function preprocess(source: string): string {
  const magicSource = new MagicString(source);
  const comments = findConditionalComments(source);

  for (const comment of comments) {
    // Skip conditional comments that are not actually comments
    if (!comment.isComment) {
      continue;
    }

    // Skip comments are not targeting conditional-comment platforms
    if (comment.bubble) {
      continue;
    }

    const contentStartIndex = comment.range[0] + comment.open.length;
    const contentEndIndex = comment.range[1] - comment.close.length;
    magicSource.prependLeft(contentStartIndex, CLOSER);
    magicSource.appendRight(contentEndIndex, OPENER);
  }

  return magicSource.toString();
}

/**
 * Reverts the changes made by `preprocess`
 */
export function postprocess(source: string): string {
  return source.replaceAll(new RegExp(`(${OPENER}|${CLOSER})`, 'g'), '');
}

/**
 * Gets the full embedded document, replacing the conditional comments
 * with whitespace.
 */
export function getEmbeddedDocument(source: string): string {
  const magicSource = new MagicString(source);
  const comments = findConditionalComments(source);

  for (const comment of comments) {
    // Skip conditional comments that are not actually comments
    if (!comment.isComment) {
      continue;
    }

    magicSource.overwrite(comment.range[0], comment.range[0] + comment.open.length, ' '.repeat(comment.open.length));

    magicSource.overwrite(comment.range[1] - comment.close.length, comment.range[1], ' '.repeat(comment.close.length));
  }

  return magicSource.toString();
}
