/**
 * Element utility functions for common operations
 */
import type { SourceElement, SourceChildNode } from '@ciolabs/htmlparser2-source';

/**
 * Get the start position of an element's content (after opening tag)
 */
export function getContentStart(element: SourceElement): number {
  return element.source.openTag.endIndex + 1;
}

/**
 * Get the end position of an element's content (exclusive — one past the last
 * content character, i.e. where a closing tag would begin).
 *
 * For a properly closed element this is the close tag's start. For an element
 * with no close tag (an implicitly-closed <td>/<li>/<p>, or an unclosed tag)
 * the parser's element.endIndex can overshoot into a *following sibling*, so we
 * derive the boundary from the element's own last descendant instead. That
 * keeps innerHTML/append/textContent from reading or overwriting into the next
 * element and destroying it.
 */
export function getContentEnd(element: SourceElement): number {
  if (element.source.closeTag) {
    return element.source.closeTag.startIndex;
  }
  return lastDescendantEnd(element);
}

/**
 * Exclusive end position of an element's own content, computed from its last
 * child (recursively), ignoring the parser's possibly-overshooting endIndex.
 */
function lastDescendantEnd(element: SourceElement): number {
  const children = element.children as SourceChildNode[] | undefined;
  if (!children || children.length === 0) {
    // No content: the boundary is right after the open tag.
    return element.source.openTag.endIndex + 1;
  }

  const last = children.at(-1);
  if (!last) {
    return element.source.openTag.endIndex + 1;
  }

  if (last.type === 'tag') {
    const lastElement = last as SourceElement;
    if (lastElement.source?.closeTag) {
      return lastElement.source.closeTag.endIndex; // exclusive
    }
    // The last child is itself unclosed — recurse so we don't trust its endIndex.
    return lastDescendantEnd(lastElement);
  }

  // Text/comment/CDATA: endIndex is the inclusive last character.
  return (last.endIndex ?? element.source.openTag.endIndex) + 1;
}

/**
 * Get the content range of an element
 */
export function getContentRange(element: SourceElement): { start: number; end: number } {
  return {
    start: getContentStart(element),
    end: getContentEnd(element),
  };
}

/**
 * Get the exclusive end position of an element's *outer* HTML (one past the
 * final `>` of its close tag, or — for an element with no close tag — one past
 * its last content character). Like getContentEnd, this avoids the parser's
 * endIndex which can overshoot into a following sibling for implicitly-closed
 * elements, which would otherwise make remove()/replaceWith()/after()/outerHTML
 * swallow the next element.
 */
export function getOuterEnd(element: SourceElement): number {
  return element.source.closeTag?.endIndex ?? getContentEnd(element);
}

/**
 * Generate a closing tag string for an element
 */
export function makeClosingTag(tagName: string): string {
  return `</${tagName}>`;
}

/**
 * Check if element is self-closing
 */
export function isSelfClosing(element: SourceElement): boolean {
  return element.source.openTag.isSelfClosing;
}

/**
 * Check if element's opening tag has a trailing slash
 */
export function hasTrailingSlash(element: SourceElement, source: string): boolean {
  return isSelfClosing(element) && source.charAt(element.source.openTag.endIndex - 1) === '/';
}
