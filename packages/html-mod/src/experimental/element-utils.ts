/**
 * Element utility functions for common operations
 */
import type { SourceElement } from '@ciolabs/htmlparser2-source';

/**
 * Get the start position of an element's content (after opening tag)
 */
export function getContentStart(element: SourceElement): number {
  return element.source.openTag.endIndex + 1;
}

/**
 * Get the end position of an element's content (before closing tag)
 */
export function getContentEnd(element: SourceElement): number {
  return element.source.closeTag?.startIndex ?? element.endIndex;
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
