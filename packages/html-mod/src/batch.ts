/**
 * Batched write mode (opt-in via `HtmlMod.prototype.batch`).
 *
 * Every eager mutation pays two O(document) costs: a full string splice and
 * a recursive AST position update over all following nodes. Loops that make
 * many small writes (key injection, attribute stripping) therefore scale
 * quadratically with document size — profiled at ~65% AST updates and ~27%
 * string splicing.
 *
 * Inside a batch, attribute writes queue edits expressed in PRE-BATCH
 * coordinates (the AST is untouched mid-batch, so every position read used
 * to compute an edit is consistent). The flush then pays each cost ONCE:
 *
 *  - one string rebuild from the sorted, non-overlapping edit list
 *  - one full-AST walk applying prefix-summed deltas per position
 *
 * turning O(edits × document) into O(document + edits log edits).
 *
 * Correctness model — batching is EXACTLY equivalent to sequential
 * application because:
 *  - queued edits never overlap (a second write touching an already-edited
 *    element flushes first),
 *  - reads that could observe stale state flush first (source reads,
 *    selector queries, metadata reads on edited elements, every non-batched
 *    mutation),
 *  - all four operation kinds shift positions with a uniform
 *    `position >= boundary` rule (see position-delta.ts), so evaluating
 *    every edit against original coordinates matches sequential
 *    application for non-overlapping edits.
 */
import { SourceDocument, SourceElement, SourceChildNode, isTag } from '@ciolabs/htmlparser2-source';

import { PositionDelta, shouldUpdatePosition } from './position-delta';

export type QueuedEdit = {
  /** Range start in pre-batch coordinates. */
  start: number;
  /** Range end in pre-batch coordinates (start === end for pure inserts). */
  end: number;
  /** Replacement/inserted content. */
  content: string;
  /** Delta descriptor, in pre-batch coordinates. */
  delta: PositionDelta;
  /** The element whose open tag this edit belongs to. */
  element: SourceElement;
  /**
   * AST metadata write, deferred to flush time. Receives the cumulative
   * length delta of all edits sorted before this one, so positions computed
   * at queue time (pre-batch + own edit) can be shifted into final
   * coordinates.
   */
  finalize: (shift: number) => void;
};

/**
 * The position boundary at/after which an edit shifts positions. Matches
 * `shouldUpdatePosition`: overwrite/remove shift positions >= mutationEnd,
 * prependLeft/appendRight shift positions >= mutationStart.
 */
function editBoundary(delta: PositionDelta): number {
  return delta.operationType === 'overwrite' || delta.operationType === 'remove'
    ? delta.mutationEnd
    : delta.mutationStart;
}

/**
 * Build the post-batch source string in one pass over the sorted edits.
 */
export function buildBatchedSource(source: string, sortedEdits: QueuedEdit[]): string {
  const parts: string[] = [];
  let cursor = 0;
  for (const edit of sortedEdits) {
    parts.push(source.slice(cursor, edit.start), edit.content);
    cursor = edit.end;
  }
  parts.push(source.slice(cursor));
  return parts.join('');
}

type PrefixDelta = {
  /** Sorted positions. */
  positions: number[];
  /** prefix[i] = cumulative delta of entries 0..i (inclusive). */
  prefix: number[];
};

function buildPrefix(entries: Array<{ position: number; delta: number }>): PrefixDelta {
  const positions: number[] = [];
  const prefix: number[] = [];
  let sum = 0;
  for (const entry of entries) {
    sum += entry.delta;
    positions.push(entry.position);
    prefix.push(sum);
  }
  return { positions, prefix };
}

/**
 * Cumulative delta of entries with position <= the given position (binary
 * search over the sorted positions).
 */
function deltaAt(position: number, { positions, prefix }: PrefixDelta): number {
  let low = 0;
  let high = positions.length - 1;
  let result = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (positions[mid] <= position) {
      result = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return result === -1 ? 0 : prefix[result];
}

/**
 * Apply all queued edits' position deltas to every position field in the
 * AST in a single walk. Equivalent to applying each edit's
 * `applyDeltaToPosition` sequentially, because edits never overlap.
 */
export function applyEditsToAstPositions(root: SourceDocument, sortedEdits: QueuedEdit[]): void {
  if (sortedEdits.length === 0) return;

  // Defensive: verify the uniform `>= boundary` rule still holds for every
  // queued operation type (see shouldUpdatePosition) — a new operation type
  // with different boundary semantics must not silently corrupt positions.
  for (const edit of sortedEdits) {
    const boundary = editBoundary(edit.delta);
    if (shouldUpdatePosition(boundary - 1, edit.delta) || !shouldUpdatePosition(boundary, edit.delta)) {
      throw new Error(`html-mod batch: unexpected boundary semantics for ${edit.delta.operationType}`);
    }
  }

  // Cumulative deltas by BOUNDARY (per-field shouldUpdatePosition rule).
  const boundaryPrefix = buildPrefix(
    sortedEdits.map(edit => ({ position: editBoundary(edit.delta), delta: edit.delta.delta }))
  );
  // Cumulative deltas of INSERT edits by position — used to replicate the
  // eager updater's node-level guard (see below). Insert edits have
  // mutationStart === boundary, and they are the only kind that can start
  // after a node's endIndex while their boundary still reaches one of the
  // node's fields.
  const insertPrefix = buildPrefix(
    sortedEdits
      .filter(edit => edit.delta.operationType === 'appendRight' || edit.delta.operationType === 'prependLeft')
      .map(edit => ({ position: edit.delta.mutationStart, delta: edit.delta.delta }))
  );

  const visit = (node: SourceChildNode): void => {
    // The eager updater skips a node ENTIRELY when
    // `node.endIndex < delta.mutationStart` — so an insert landing exactly
    // one past the node (e.g. `after(node)` at its exclusive
    // closeTag.endIndex) must NOT shift any of the node's fields, even
    // though the plain `>= boundary` rule would shift that one field. For
    // each field: take the boundary-rule delta, then subtract insert edits
    // that start strictly after this node's end (they were excluded by the
    // eager node-level guard).
    const nodeEnd = typeof node.endIndex === 'number' ? node.endIndex : Number.MAX_SAFE_INTEGER;
    const insertUpToNodeEnd = deltaAt(nodeEnd, insertPrefix);
    const shift = (position: number): number => {
      let delta = deltaAt(position, boundaryPrefix);
      if (position > nodeEnd) {
        delta -= deltaAt(position, insertPrefix) - insertUpToNodeEnd;
      }
      return position + delta;
    };

    if (typeof node.startIndex === 'number') node.startIndex = shift(node.startIndex);
    const newEndIndex = typeof node.endIndex === 'number' ? shift(node.endIndex) : null;

    if (isTag(node)) {
      const element = node as SourceElement;
      if (element.source?.openTag) {
        element.source.openTag.startIndex = shift(element.source.openTag.startIndex);
        element.source.openTag.endIndex = shift(element.source.openTag.endIndex);
      }
      if (element.source?.closeTag) {
        element.source.closeTag.startIndex = shift(element.source.closeTag.startIndex);
        element.source.closeTag.endIndex = shift(element.source.closeTag.endIndex);
      }
      if (element.source?.attributes) {
        for (const attribute of element.source.attributes) {
          if (attribute.name) {
            attribute.name.startIndex = shift(attribute.name.startIndex);
            attribute.name.endIndex = shift(attribute.name.endIndex);
          }
          if (attribute.value) {
            attribute.value.startIndex = shift(attribute.value.startIndex);
            attribute.value.endIndex = shift(attribute.value.endIndex);
          }
          if (attribute.source) {
            attribute.source.startIndex = shift(attribute.source.startIndex);
            attribute.source.endIndex = shift(attribute.source.endIndex);
          }
        }
      }
      for (const child of element.children) {
        visit(child as SourceChildNode);
      }
    }

    if (newEndIndex !== null) node.endIndex = newEndIndex;
  };

  for (const child of root.children) {
    visit(child);
  }
}

/**
 * Cumulative delta of every edit sorted strictly before each edit — the
 * `shift` passed to that edit's finalizer.
 */
export function finalizerShifts(sortedEdits: QueuedEdit[]): number[] {
  const shifts: number[] = [];
  let sum = 0;
  for (const edit of sortedEdits) {
    shifts.push(sum);
    sum += edit.delta.delta;
  }
  return shifts;
}
