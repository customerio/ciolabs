/**
 * Atomic string operations that automatically track deltas
 *
 * These utilities combine string manipulation with delta tracking to prevent
 * bugs where developers forget to call __trackDelta after string operations.
 */
import type { SourceElement } from '@ciolabs/htmlparser2-source';

import {
  calculateOverwriteDelta,
  calculateAppendRightDelta,
  calculatePrependLeftDelta,
  calculateRemoveDelta,
} from './position-delta';

import type { HtmlMod } from './index';

/**
 * Atomically overwrite a range in the source string and track the delta
 */
export function atomicOverwrite(
  htmlMod: HtmlMod,
  start: number,
  end: number,
  content: string,
  affectedElement?: SourceElement
): void {
  htmlMod.__overwrite(start, end, content);
  htmlMod.__trackDelta(calculateOverwriteDelta(start, end, content), affectedElement);
}

/**
 * Atomically append content after a position and track the delta
 */
export function atomicAppendRight(
  htmlMod: HtmlMod,
  index: number,
  content: string,
  affectedElement?: SourceElement
): void {
  htmlMod.__appendRight(index, content);
  htmlMod.__trackDelta(calculateAppendRightDelta(index, content), affectedElement);
}

/**
 * Atomically prepend content before a position and track the delta
 */
export function atomicPrependLeft(
  htmlMod: HtmlMod,
  index: number,
  content: string,
  affectedElement?: SourceElement
): void {
  htmlMod.__prependLeft(index, content);
  htmlMod.__trackDelta(calculatePrependLeftDelta(index, content), affectedElement);
}

/**
 * Atomically remove a range from the source string and track the delta
 */
export function atomicRemove(htmlMod: HtmlMod, start: number, end: number, affectedElement?: SourceElement): void {
  htmlMod.__remove(start, end);
  htmlMod.__trackDelta(calculateRemoveDelta(start, end), affectedElement);
}
