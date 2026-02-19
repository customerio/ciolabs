import findConditionalComments from '@ciolabs/html-find-conditional-comments';
import { rApply as applyRanges } from 'ranges-apply';

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
  const comments = findConditionalComments(source);
  const ranges: Array<[number, number, string]> = [];

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
    ranges.push([contentStartIndex, contentStartIndex, CLOSER], [contentEndIndex, contentEndIndex, OPENER]);
  }

  return applyRanges(source, ranges);
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
  const comments = findConditionalComments(source);
  const ranges: Array<[number, number, string]> = [];

  for (const comment of comments) {
    // Skip conditional comments that are not actually comments
    if (!comment.isComment) {
      continue;
    }

    ranges.push(
      [comment.range[0], comment.range[0] + comment.open.length, ' '.repeat(comment.open.length)],
      [comment.range[1] - comment.close.length, comment.range[1], ' '.repeat(comment.close.length)]
    );
  }

  return applyRanges(source, ranges);
}
