import MagicString from 'magic-string';

const COMMENT_REGEX = /<!--([\S\s]*?)-->/g;

const IS_WHITESPACE_REGEX = /\s+/;
const WHITESPACE_AT_START_REGEX = /^\s*/;
const WHITESPACE_AT_END_REGEX = /\s*$/;

export interface CommentData {
  leadingWhitespace: string;
  trailingWhitespace: string;
  hasLeadingWhitespace: boolean;
  hasTrailingWhitespace: boolean;
}

export interface RestoreOptions {
  restoreInline: boolean;
}

function last<T>(array: T[]): T {
  return array.at(-1)!;
}

function first<T>(array: T[]): T {
  return array[0];
}

function isWhitespace(string_: string): boolean {
  return IS_WHITESPACE_REGEX.test(string_);
}

function hasNewLine(string_: string): boolean {
  return string_.includes('\n');
}

const countMatches = (string_: string, regex: RegExp): number => {
  return (string_.match(regex) || []).length;
};

/**
 * Preserves whitespace information around HTML comments in a string.
 *
 * @param string_ - The HTML string to analyze
 * @returns Array of comment data containing whitespace information
 */
export function preserve(string_: string): CommentData[] {
  const comments: CommentData[] = [];

  let result: RegExpExecArray | null;
  while ((result = COMMENT_REGEX.exec(string_)) !== null) {
    const [match] = result;
    const startIndex = COMMENT_REGEX.lastIndex - match.length;
    const endIndex = COMMENT_REGEX.lastIndex;

    const [leadingWhitespace] = WHITESPACE_AT_END_REGEX.exec(string_.slice(0, startIndex)) || [''];
    const [trailingWhitespace] = WHITESPACE_AT_START_REGEX.exec(string_.slice(endIndex)) || [''];

    comments.push({
      leadingWhitespace,
      trailingWhitespace,
      hasLeadingWhitespace: Boolean(leadingWhitespace),
      hasTrailingWhitespace: Boolean(trailingWhitespace),
    });
  }

  return comments;
}

/**
 * Restores whitespace around HTML comments based on preserved data.
 *
 * @param string_ - The HTML string to restore
 * @param comments - Array of comment data from preserve()
 * @param options - Configuration options
 * @returns Restored HTML string with correct comment whitespace
 */
export function restore(string_: string, comments: CommentData[] = [], options?: RestoreOptions): string {
  const magicString = new MagicString(string_);
  let index = 0;
  const restoreOptions = options ?? { restoreInline: true };

  if (countMatches(string_, COMMENT_REGEX) !== comments.length) {
    return string_;
  }

  let result: RegExpExecArray | null;
  while ((result = COMMENT_REGEX.exec(string_)) !== null) {
    const [match] = result;
    const startIndex = COMMENT_REGEX.lastIndex - match.length;
    const endIndex = COMMENT_REGEX.lastIndex;
    const { hasLeadingWhitespace, hasTrailingWhitespace, leadingWhitespace, trailingWhitespace } = comments[index];
    const [newLeadingWhitespace] = WHITESPACE_AT_END_REGEX.exec(string_.slice(0, startIndex)) || [''];
    const [newTrailingWhitespace] = WHITESPACE_AT_START_REGEX.exec(string_.slice(endIndex)) || [''];

    /**
     * If this comment is not suppose to have leading whitespace
     * and it does, get the range of the whitespace before the
     * comment to be removed.
     */
    if (!hasLeadingWhitespace && isWhitespace(newLeadingWhitespace)) {
      magicString.remove(startIndex - newLeadingWhitespace.length, startIndex);
    }

    /**
     * restore correct leading whitespace
     */
    if (hasLeadingWhitespace) {
      // if it is now has no whitespace, restore the whitespace until the first new line
      if (!isWhitespace(newLeadingWhitespace)) {
        magicString.prependLeft(startIndex, last(leadingWhitespace.split('\n')));
      }

      // it is now on it's own line and it wasn't before, replace it the whitespace until the first new line
      else if (restoreOptions.restoreInline && hasNewLine(newLeadingWhitespace) && !hasNewLine(leadingWhitespace)) {
        magicString.overwrite(
          startIndex - newLeadingWhitespace.length,
          startIndex,
          last(leadingWhitespace.split('\n'))
        );
      } else {
        // it has ok whitespace so leave it alone
      }
    }

    /**
     * If this comment is not suppose to have trailing whitespace
     * and it does, get the range of the whitespace after the
     * comment to be removed.
     */
    if (!hasTrailingWhitespace && isWhitespace(newTrailingWhitespace)) {
      magicString.remove(endIndex, endIndex + newTrailingWhitespace.length);
    }

    /**
     * restore correct trailing whitespace
     */
    if (hasTrailingWhitespace) {
      // if it is now has no whitespace, restore the whitespace until the first new line
      if (!isWhitespace(newTrailingWhitespace)) {
        magicString.appendRight(endIndex, first(trailingWhitespace.split('\n')));
      }

      // it is now on it's own line and it wasn't before, replace it the whitespace until the first new line
      else if (restoreOptions.restoreInline && hasNewLine(newTrailingWhitespace) && !hasNewLine(trailingWhitespace)) {
        magicString.overwrite(endIndex, endIndex + newTrailingWhitespace.length, first(trailingWhitespace.split('\n')));
      } else {
        // it has ok whitespace so leave it alone
      }
    }

    index++;
  }

  return magicString.toString();
}
