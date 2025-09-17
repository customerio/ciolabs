export interface ConditionalComment {
  /**
   * Whether the item is a comment
   */
  isComment: boolean;

  /**
   * Opening portion of the conditional comment.
   */
  open: string;

  /**
   * Closing portion of the conditional comment.
   */
  close: string;

  /**
   * Whether the comment "bubbles" around the value.
   */
  bubble: boolean;

  /**
   * Either "revealed" or "hidden".
   */
  downlevel: 'revealed' | 'hidden';

  /**
   * A range array containing the start and end indices of the comment.
   */
  range: [number, number];
}

// Token regexes to support nested conditional comments
const OPEN_REGEX = /<!(--)?\[if\s[\s\w!&()|]+]>(?:<!--+>)?/gi;
// Capture whether the close carries trailing dashes ("--") before '>' to enforce symmetry
const CLOSE_REGEX = /(?:<!--)?<!\[endif](--)?>/gi;

/**
 * Finds the conditional comments in HTML.
 */
export default function findConditionalComments(string_: string): ConditionalComment[] {
  const comments: ConditionalComment[] = [];

  // Use a stack to handle nested conditional comments
  const stack: Array<{
    open: string;
    start: number;
    end: number;
    isComment: boolean;
    bubble: boolean;
  }> = [];
  let position = 0;

  while (position < string_.length) {
    // Find next open and next close from current position
    OPEN_REGEX.lastIndex = position;
    CLOSE_REGEX.lastIndex = position;

    const openMatch = OPEN_REGEX.exec(string_);
    const closeMatch = CLOSE_REGEX.exec(string_);

    // If neither token is found, we're done
    if (!openMatch && !closeMatch) {
      break;
    }

    // Choose the earliest token occurrence
    const nextOpenIndex = openMatch ? openMatch.index : Number.POSITIVE_INFINITY;
    const nextCloseIndex = closeMatch ? closeMatch.index : Number.POSITIVE_INFINITY;

    if (nextOpenIndex < nextCloseIndex && openMatch) {
      // Process opening token
      const openText = openMatch[0];
      const openStart = openMatch.index;
      const openEnd = OPEN_REGEX.lastIndex;

      const isComment = openText.startsWith('<!--');
      const bubble = openText.endsWith('-->');

      stack.push({
        open: openText,
        start: openStart,
        end: openEnd,
        isComment,
        bubble,
      });

      position = openEnd;
      continue;
    }

    // Process closing token
    if (closeMatch) {
      const closeText = closeMatch[0];
      const closeEnd = CLOSE_REGEX.lastIndex;

      if (stack.length > 0) {
        const openState = stack.at(-1)!;
        const closeHasDashes = Boolean(closeMatch[1]);
        const openRequiresDashes = openState.isComment; // HTML comment style requires '-->'

        if (closeHasDashes === openRequiresDashes) {
          // Valid matching close for the most recent open
          stack.pop();
          comments.push({
            isComment: openState.isComment,
            open: openState.open,
            close: closeText,
            bubble: openState.bubble,
            downlevel: openState.bubble || !openState.isComment ? 'revealed' : 'hidden',
            range: [openState.start, closeEnd],
          });
        }
      }

      position = closeEnd;
    }
  }

  return comments;
}
