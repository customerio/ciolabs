import {
  parseDocument,
  SourceDocument,
  SourceElement,
  Options,
  DomUtils,
  nodeToString,
  SourceText,
} from '@ciolabs/htmlparser2-source';
import { select } from 'cheerio-select';
import escapeHtml from 'escape-html';
import { decode } from 'html-entities';

import * as AstManipulator from './ast-manipulator';
import { AstUpdater } from './ast-updater';
import { applyEditsToAstPositions, buildBatchedSource, finalizerShifts, type QueuedEdit } from './batch';
import {
  getContentStart,
  getContentEnd,
  getOuterEnd,
  makeClosingTag,
  isSelfClosing,
  hasTrailingSlash,
} from './element-utils';
import {
  calculateAppendRightDelta,
  calculateOverwriteDelta,
  calculatePrependLeftDelta,
  calculateRemoveDelta,
  type PositionDelta,
} from './position-delta';
import { atomicOverwrite, atomicAppendRight, atomicPrependLeft, atomicRemove } from './string-operations';

/** Sort rank for same-position batched edits — see __flushBatch. */
function batchAnchorRank(edit: QueuedEdit): number {
  return edit.delta.operationType === 'appendRight' ? 0 : edit.delta.operationType === 'overwrite' ? 1 : 2;
}

export type HtmlModOptions = Options & {
  HtmlModElement?: typeof HtmlModElement; // allow for custom HtmlModElement
};

export class HtmlMod {
  /**
   * Raw source storage. Internal batch machinery reads/writes this
   * directly; everything else goes through the `__source` accessor, which
   * flushes any pending batched edits first so no reader can observe a
   * stale string.
   */
  __sourceRaw: string;
  __dom: SourceDocument;

  get __source(): string {
    this.__flushBatch();
    return this.__sourceRaw;
  }

  set __source(value: string) {
    // Same corruption tripwire as the raw splices: replacing the source
    // with batched edits still pending would silently drop them.
    this.__assertNoPendingBatchEdits();
    this.__sourceRaw = value;
  }

  __HtmlMod: typeof HtmlMod;
  __HtmlModElement: typeof HtmlModElement;
  __HtmlModText: typeof HtmlModText;
  __options: HtmlModOptions;
  __astUpdater: AstUpdater;
  __cachedInnerHTML: WeakMap<SourceElement, string> = new WeakMap();
  __cachedOuterHTML: WeakMap<SourceElement, string> = new WeakMap();

  constructor(source: string, options?: HtmlModOptions) {
    this.__sourceRaw = source;
    this.__options = {
      recognizeSelfClosing: true,
      ...options,
    };
    this.__dom = parseDocument(source, this.__options);
    this.__HtmlModElement = options?.HtmlModElement || HtmlModElement;
    this.__HtmlModText = HtmlModText;
    this.__HtmlMod = HtmlMod;
    this.__astUpdater = new AstUpdater();
  }

  /**
   * Direct string manipulation methods
   * Public but marked with __ to indicate internal use
   */
  __overwrite(start: number, end: number, content: string): void {
    this.__assertNoPendingBatchEdits();
    this.__sourceRaw = this.__sourceRaw.slice(0, start) + content + this.__sourceRaw.slice(end);
  }

  __appendRight(index: number, content: string): void {
    this.__assertNoPendingBatchEdits();
    this.__sourceRaw = this.__sourceRaw.slice(0, index) + content + this.__sourceRaw.slice(index);
  }

  __prependLeft(index: number, content: string): void {
    this.__assertNoPendingBatchEdits();
    this.__sourceRaw = this.__sourceRaw.slice(0, index) + content + this.__sourceRaw.slice(index);
  }

  __remove(start: number, end: number): void {
    this.__assertNoPendingBatchEdits();
    this.__sourceRaw = this.__sourceRaw.slice(0, start) + this.__sourceRaw.slice(end);
  }

  /**
   * Raw splices operate on coordinates the caller computed BEFORE calling —
   * if batched edits are still pending at that point, those coordinates are
   * stale and applying them would corrupt the document. Every non-batched
   * mutator flushes at entry (before reading positions); reaching here with
   * pending edits means a flush guard is missing. Throw loudly rather than
   * corrupt source.
   */
  __assertNoPendingBatchEdits(): void {
    if (this.__batchEdits.length > 0) {
      throw new Error('html-mod: string operation with pending batched edits — missing flush guard');
    }
  }

  // -------------------------------------------------------------------------
  // Batched write mode (see batch.ts for the cost/correctness model)
  // -------------------------------------------------------------------------

  __batchDepth = 0;
  __batchEdits: QueuedEdit[] = [];
  /**
   * Edit kinds queued per element: 'before' | 'after' | 'prepend' |
   * 'append' | 'attr:<name>'. Used for precise conflict detection — e.g.
   * one `before` + one `after` + several distinct-name attribute writes on
   * the same element coexist safely (disjoint ranges, order-independent),
   * while a repeated `after` or a same-name attribute rewrite must flush.
   */
  __batchedElementKinds: Map<SourceElement, Set<string>> = new Map();
  /**
   * Positions with a queued appendRight insert. Sequential execution
   * applies same-position appendRights LIFO (the second call's position
   * does not shift), which a stable position sort cannot reproduce — so a
   * second appendRight at an occupied position flushes first.
   */
  __batchAppendRightPositions: Set<number> = new Set();
  /**
   * Anchor element per queued prependLeft position. Same-position
   * prependLefts from the SAME element (several new attributes) are FIFO
   * both sequentially and under the stable sort — safe to batch. From
   * DIFFERENT elements (`prepend(parent)` + `before(firstChild)` share the
   * content-start position) the sequential order depends on which anchor
   * shifted, which the sort cannot reproduce — flush and retry.
   */
  __batchPrependLeftPositions: Map<number, SourceElement> = new Map();
  /**
   * Whether any queued edit inserts nodes (before/after/prepend/append).
   * Structural READS (`children`) must flush when true — the AST tree
   * mutation is deferred to the finalizer, so the child list is stale until
   * then. Attribute-only batches never set this, keeping the hot
   * query-then-write loops flush-free.
   */
  __batchHasStructuralEdits = false;

  /**
   * Run `fn` with attribute writes batched: `setAttribute`/`removeAttribute`
   * (and everything built on them — `dataset`, `id`/`className` setters,
   * `toggleAttribute`) queue their edits and apply them in ONE string
   * rebuild + ONE AST position pass when the batch ends, instead of paying
   * O(document) per write.
   *
   * Semantics are identical to unbatched execution: reads that could
   * observe pending state flush the batch first (source/serialization
   * reads, selector queries, attribute reads on an edited element, any
   * non-attribute mutation, a second write to an already-edited element).
   * The one observable difference: position fields (`startIndex`,
   * `sourceRange`, …) read inside the batch reflect pre-batch coordinates —
   * mutually consistent, but not final until the batch ends.
   */
  batch<T>(callback: () => T): T {
    this.__batchDepth++;
    try {
      return callback();
    } finally {
      this.__batchDepth--;
      if (this.__batchDepth === 0) {
        this.__flushBatch();
      }
    }
  }

  get __isBatching(): boolean {
    return this.__batchDepth > 0;
  }

  __queueBatchEdit(edit: QueuedEdit, kind: string): void {
    if (edit.delta.operationType === 'appendRight') {
      this.__batchAppendRightPositions.add(edit.delta.mutationStart);
    } else if (edit.delta.operationType === 'prependLeft') {
      this.__batchPrependLeftPositions.set(edit.delta.mutationStart, edit.element);
    }
    this.__batchEdits.push(edit);
    let kinds = this.__batchedElementKinds.get(edit.element);
    if (!kinds) {
      kinds = new Set();
      this.__batchedElementKinds.set(edit.element, kinds);
    }
    kinds.add(kind);
  }

  __queueStructuralBatchEdit(edit: QueuedEdit, kind: string): void {
    this.__batchHasStructuralEdits = true;
    this.__queueBatchEdit(edit, kind);
  }

  /**
   * Flush when the incoming edit cannot safely coexist with queued edits:
   *  - the same kind already queued on this element (repeat after/before/
   *    same-name attribute — sequential execution is order-sensitive there)
   *  - prepend/append mixed with ANYTHING on the same element (they touch
   *    the open-tag region and, for empty elements, share positions)
   * (Same-position appendRight conflicts — sequential LIFO — are handled at
   * queue time with a flush-and-retry, since the flush invalidates the
   * positions already computed by the caller.)
   */
  __flushBatchIfConflicting(element: SourceElement, kind: string): void {
    const kinds = this.__batchedElementKinds.get(element);
    if (!kinds) return;
    const incomingIsContent = kind === 'prepend' || kind === 'append';
    const queuedHasContent = kinds.has('prepend') || kinds.has('append');
    if (kinds.has(kind) || incomingIsContent || queuedHasContent) {
      this.__flushBatch();
    }
  }

  /**
   * True when a queued prependLeft at this position anchors to a DIFFERENT
   * element — sequential ordering then depends on anchor shifting, which
   * the batch sort cannot reproduce. Callers flush and retry.
   */
  __hasPrependLeftCollision(position: number, element: SourceElement): boolean {
    const anchor = this.__batchPrependLeftPositions.get(position);
    return anchor !== undefined && anchor !== element;
  }

  /** Flush when queued edits would make this element's attribute state stale. */
  __flushBatchIfAttributesPending(element: SourceElement): void {
    const kinds = this.__batchedElementKinds.get(element);
    if (!kinds) return;
    for (const kind of kinds) {
      if (kind.startsWith('attr:') || kind === 'prepend' || kind === 'append') {
        this.__flushBatch();
        return;
      }
    }
  }

  /** Flush when deferred node insertions would make the child list stale. */
  __flushBatchIfStructuralPending(): void {
    if (this.__batchHasStructuralEdits) {
      this.__flushBatch();
    }
  }

  /** Flush if this element has ANY queued edits (coarse write/read guard). */
  __flushBatchIfElementPending(element: SourceElement): void {
    if (this.__batchedElementKinds.has(element)) {
      this.__flushBatch();
    }
  }

  /**
   * Apply every queued edit: one string rebuild, one AST position walk,
   * then the deferred per-edit AST metadata writes. No-op when empty.
   */
  __flushBatch(): void {
    if (this.__batchEdits.length === 0) {
      return;
    }

    const edits = this.__batchEdits;
    this.__batchEdits = [];
    this.__batchedElementKinds = new Map();
    this.__batchAppendRightPositions = new Set();
    this.__batchPrependLeftPositions = new Map();
    this.__batchHasStructuralEdits = false;

    // Sort by position; at equal positions, appendRight sorts before
    // prependLeft — appendRight anchors to the content on its LEFT (an
    // `after(A)` stays adjacent to A) while prependLeft anchors to the
    // content on its RIGHT (a `before(B)` stays adjacent to B), which is
    // exactly the order sequential execution produces when two inserts from
    // adjacent elements land on the same boundary, regardless of call
    // order. Array.prototype.sort is stable, so same-position same-kind
    // edits keep queue order (they can only come from the same call site).
    const sorted = [...edits].sort((a, b) => a.start - b.start || batchAnchorRank(a) - batchAnchorRank(b));
    for (let index = 1; index < sorted.length; index++) {
      if (sorted[index].start < sorted[index - 1].end) {
        // Invariant check — the conflict guards make this unreachable. Note
        // the queue was already cleared above, so on this path the queued
        // edits are dropped rather than applied against unknown state.
        throw new Error('html-mod: overlapping batched edits');
      }
    }

    this.__sourceRaw = buildBatchedSource(this.__sourceRaw, sorted);
    applyEditsToAstPositions(this.__dom, sorted);

    const shifts = finalizerShifts(sorted);
    for (const [index, edit] of sorted.entries()) {
      edit.finalize(shifts[index]);
    }
  }

  /**
   * Track a delta and immediately update AST positions
   * With direct string manipulation, we don't need to recreate anything!
   */
  __trackDelta(delta: PositionDelta, affectedElement?: SourceElement) {
    // Apply delta to AST positions immediately
    if (affectedElement) {
      // Targeted update - only update affected subtrees (ancestors + descendants + following siblings)
      this.__astUpdater.updateFromElement(affectedElement, this.__dom, delta);
    } else {
      // Full tree walk fallback (for operations without element context like trim())
      this.__astUpdater.updateNodePositions(this.__dom, delta);
    }
    // Note: __source is already up-to-date from string operations
  }

  /**
   * Reconcile the AST after leading characters were stripped from the source.
   *
   * The removed region (always whitespace for the trim methods) is a contiguous
   * prefix occupied by root-level text node(s). Fully-removed text nodes are
   * dropped from the AST; a straddling node has its leading data trimmed. Must
   * run BEFORE the corresponding remove delta so the delta then fixes the
   * straddling node's endIndex (its startIndex stays at the front).
   */
  __reconcileLeadingTrim(count: number): void {
    let remaining = count;
    const children = this.__dom.children;
    while (remaining > 0 && children.length > 0) {
      const node = children[0];
      if (node.type !== 'text') break;
      const dataLength = node.data.length;
      if (dataLength <= remaining) {
        children.shift();
        remaining -= dataLength;
      } else {
        node.data = node.data.slice(remaining);
        remaining = 0;
      }
    }
  }

  /**
   * Reconcile the AST after trailing characters were stripped from the source.
   *
   * Mirror of __reconcileLeadingTrim for a contiguous suffix. A straddling node
   * keeps its startIndex, so we fix its endIndex here (the remove delta won't —
   * the node sits before the delta's mutation start).
   */
  __reconcileTrailingTrim(count: number): void {
    let remaining = count;
    const children = this.__dom.children;
    while (remaining > 0 && children.length > 0) {
      const node = children.at(-1);
      if (!node || node.type !== 'text') break;
      const dataLength = node.data.length;
      if (dataLength <= remaining) {
        children.pop();
        remaining -= dataLength;
      } else {
        node.data = node.data.slice(0, dataLength - remaining);
        if (node.startIndex != null) {
          node.endIndex = node.startIndex + node.data.length - 1;
        }
        remaining = 0;
      }
    }
  }

  trim() {
    const beforeSource = this.__source;
    const afterSource = beforeSource.trim();
    this.__source = afterSource;

    // Queue deltas for removed characters
    const trimmedTotal = beforeSource.length - afterSource.length;
    if (trimmedTotal > 0) {
      const trimmedStart = beforeSource.length - beforeSource.trimStart().length;
      const trimmedEnd = trimmedTotal - trimmedStart;

      // Handle the trailing removal first so its delta is expressed in the
      // original coordinate space; the leading delta then shifts everything
      // (including the trailing-adjusted nodes) left uniformly.
      if (trimmedEnd > 0) {
        this.__reconcileTrailingTrim(trimmedEnd);
        this.__trackDelta(calculateRemoveDelta(beforeSource.length - trimmedEnd, beforeSource.length));
      }
      if (trimmedStart > 0) {
        this.__reconcileLeadingTrim(trimmedStart);
        this.__trackDelta(calculateRemoveDelta(0, trimmedStart));
      }
    }

    return this;
  }

  trimStart() {
    const beforeSource = this.__source;
    const afterSource = beforeSource.trimStart();
    this.__source = afterSource;

    // Queue delta for removed characters at start
    const trimmed = beforeSource.length - afterSource.length;
    if (trimmed > 0) {
      this.__reconcileLeadingTrim(trimmed);
      this.__trackDelta(calculateRemoveDelta(0, trimmed));
    }

    return this;
  }

  trimEnd() {
    const beforeSource = this.__source;
    const afterSource = beforeSource.trimEnd();
    this.__source = afterSource;

    // Queue delta for removed characters at end
    const trimmed = beforeSource.length - afterSource.length;
    if (trimmed > 0) {
      this.__reconcileTrailingTrim(trimmed);
      this.__trackDelta(calculateRemoveDelta(beforeSource.length - trimmed, beforeSource.length));
    }

    return this;
  }

  trimLines() {
    const beforeSource = this.__source;
    const beforeLines = beforeSource.split('\n');

    let trimmedStartLines = 0;
    for (const beforeLine of beforeLines) {
      if (beforeLine.trim() === '') {
        trimmedStartLines++;
      } else {
        break;
      }
    }

    let trimmedEndLines = 0;
    for (let index = beforeLines.length - 1; index >= 0; index--) {
      if (beforeLines[index].trim() === '' && index > trimmedStartLines) {
        trimmedEndLines++;
      } else {
        break;
      }
    }

    // Apply trimming to source
    if (trimmedStartLines > 0 || trimmedEndLines > 0) {
      const keepLines = beforeLines.slice(trimmedStartLines, beforeLines.length - trimmedEndLines);
      this.__source = keepLines.join('\n');
    }

    // Track deltas. Trailing first (original coordinates), then leading, so the
    // leading delta shifts everything uniformly and the two removals don't
    // interfere with each other's coordinates.
    if (trimmedEndLines > 0) {
      const startPos = beforeLines.slice(0, beforeLines.length - trimmedEndLines).join('\n').length;
      this.__reconcileTrailingTrim(beforeSource.length - startPos);
      this.__trackDelta(calculateRemoveDelta(startPos, beforeSource.length));
    }

    if (trimmedStartLines > 0) {
      const trimmedChars = beforeLines.slice(0, trimmedStartLines).join('\n').length + 1; // +1 for final newline
      this.__reconcileLeadingTrim(trimmedChars);
      this.__trackDelta(calculateRemoveDelta(0, trimmedChars));
    }

    return this;
  }

  isEmpty() {
    return this.__source.length === 0;
  }

  toString() {
    if (this.__options.autofix) {
      return nodeToString(parseDocument(this.__source, this.__options));
    }

    return this.__source;
  }

  clone() {
    return new HtmlMod(this.__source);
  }

  querySelector(selector: string): HtmlModElement | null {
    // Attribute selectors read attribs, which are stale for batch-edited
    // elements — flush before matching.
    this.__flushBatch();
    // If selector contains :scope, use querySelectorAll and return first result
    // This ensures :scope handling is consistent between querySelector and querySelectorAll
    if (selector.includes(':scope')) {
      const results = this.querySelectorAll(selector);
      return results[0] || null;
    }

    const result = select(selector, this.__dom)?.[0];
    if (!result) {
      return null;
    }

    return new this.__HtmlModElement(result as unknown as SourceElement, this);
  }

  querySelectorAll(selector: string): HtmlModElement[] {
    // Attribute selectors read attribs, which are stale for batch-edited
    // elements — flush before matching.
    this.__flushBatch();
    // Handle :scope selector on root document
    // When :scope is used on the document root, it should refer to the document itself
    // cheerio-select doesn't support :scope on document nodes, so we need to handle it manually
    if (selector.includes(':scope')) {
      // Handle comma-separated selectors: ":scope > div, :scope > p"
      if (selector.includes(',')) {
        const parts = selector.split(',').map(s => s.trim());
        const uniqueElements = new Set<SourceElement>();

        for (const part of parts) {
          const results = this.querySelectorAll(part); // Recursive call
          for (const result of results) {
            uniqueElements.add((result as any).__element);
          }
        }

        return [...uniqueElements].map(element => {
          return new this.__HtmlModElement(element, this);
        });
      }

      // Handle :scope > selector patterns
      const scopeDirectChildMatch = selector.match(/^:scope\s*>\s*(.+)$/);
      if (scopeDirectChildMatch) {
        const afterScopeArrow = scopeDirectChildMatch[1];

        // Get all direct children of the document (only tag elements)
        const directChildren: SourceElement[] = [];
        for (const node of this.__dom.children) {
          if (node.type === 'tag') {
            directChildren.push(node as SourceElement);
          }
        }

        // Check if there's more selector after the first part
        // Pattern: "firstPart [combinator rest]"
        // Combinators: space (descendant), > (child), + (adjacent sibling), ~ (general sibling)
        const nextCombinatorMatch = afterScopeArrow.match(/^([^\s+>~]+)([\s+>~].+)$/);

        if (nextCombinatorMatch) {
          // Complex pattern: ":scope > firstPart [combinator rest]"
          // Example: ":scope > div span" or ":scope > div > span"
          const firstPart = nextCombinatorMatch[1]; // e.g., "div"
          const restSelector = nextCombinatorMatch[2]; // e.g., " span" or "> span"

          // Step 1: Get direct children matching firstPart
          let matchingDirectChildren: SourceElement[];

          if (firstPart === '*') {
            matchingDirectChildren = directChildren;
          } else {
            const matchingElements = select(firstPart, this.__dom);
            const matchingSet = new Set(matchingElements);
            matchingDirectChildren = directChildren.filter(element => matchingSet.has(element as any));
          }

          // Step 2: For each matching direct child, apply rest of selector
          const uniqueResults = new Set<SourceElement>();
          for (const element of matchingDirectChildren) {
            const results = select(restSelector.trim(), element);
            for (const result of results) {
              uniqueResults.add(result as SourceElement);
            }
          }

          return [...uniqueResults].map(element => {
            return new this.__HtmlModElement(element, this);
          });
        } else {
          // Simple pattern: ":scope > selector" with no additional combinators
          // Example: ":scope > div" or ":scope > .foo"

          if (afterScopeArrow === '*') {
            // Return all direct children
            const result: HtmlModElement[] = [];
            for (const element of directChildren) {
              result.push(new this.__HtmlModElement(element, this));
            }
            return result;
          }

          // Filter direct children by the selector
          const matchingElements = select(afterScopeArrow, this.__dom);
          const matchingSet = new Set(matchingElements);

          const result: HtmlModElement[] = [];
          for (const element of directChildren) {
            if (matchingSet.has(element as any)) {
              result.push(new this.__HtmlModElement(element, this));
            }
          }
          return result;
        }
      }

      // Handle :scope without > (descendant selector)
      // ":scope div" means "all divs in the document" which is just "div"
      // Since we're already at the document root, :scope is redundant
      const descendantPattern = /^:scope\s+(.+)$/;
      if (descendantPattern.test(selector)) {
        selector = selector.replace(/^:scope\s+/, '');
        return select(selector, this.__dom).map(element => {
          return new this.__HtmlModElement(element as unknown as SourceElement, this);
        });
      }

      // If we get here, it's an unsupported :scope pattern
      // Fall through to regular select (will likely return empty results)
    }

    return select(selector, this.__dom).map(element => {
      return new this.__HtmlModElement(element as unknown as SourceElement, this);
    });
  }
}

export class HtmlModElement {
  __element: SourceElement;
  __htmlMod: HtmlMod;
  __isClone = false;
  __removed = false;

  constructor(element: SourceElement, htmlModule: HtmlMod) {
    this.__element = element;
    this.__htmlMod = htmlModule;
  }

  get sourceRange() {
    // Flush BEFORE reading positions: this getter mixes AST positions with
    // the source string, and the `__source` accessor below flushes — reading
    // positions first would measure pre-batch positions against the
    // post-flush string (mixed coordinates, wrong line/column).
    this.__htmlMod.__flushBatch();
    const startIndex = this.__element.source.openTag.startIndex;
    const endIndex = getOuterEnd(this.__element);
    const html = this.__htmlMod.__source;

    // count the lines before this element
    const startLines: string[] = html.slice(0, Math.max(0, startIndex)).split(/\n/);
    const startLineNumber = startLines.length;
    // count the characters before this element on the start line
    const startColumn = startLines.at(-1)!.length + 1; // add one for the space

    // count the lines before the end of element
    const endLines = html.slice(0, Math.max(0, endIndex)).split(/\n/);
    const endLineNumber = endLines.length;
    // count the characters before the end of element on the last line
    const endColumn = endLines.at(-1)!.length + 1; // add one for the space

    return {
      startLineNumber,
      startColumn,
      endLineNumber,
      endColumn,
    };
  }

  get tagName() {
    return this.__element.tagName;
  }

  set tagName(tagName: string) {
    this.__htmlMod.__flushBatch();
    if (!this.__element.endIndex) {
      return;
    }

    tagName = tagName.toLowerCase();

    const currentTagName = this.__element.tagName;

    const openTagStart = this.__element.source.openTag.startIndex + 1;
    const openTagEnd = this.__element.source.openTag.startIndex + 1 + currentTagName.length;
    atomicOverwrite(this.__htmlMod, openTagStart, openTagEnd, tagName, this.__element);

    if (this.__element.source.closeTag) {
      const closeTagStart = this.__element.source.closeTag.startIndex + 2;
      const closeTagEnd = this.__element.source.closeTag.startIndex + 2 + currentTagName.length;
      atomicOverwrite(this.__htmlMod, closeTagStart, closeTagEnd, tagName, this.__element);
    }

    AstManipulator.setTagName(this.__element, tagName);
  }

  get id() {
    this.__htmlMod.__flushBatchIfAttributesPending(this.__element);
    return this.__element.attribs.id ?? '';
  }

  set id(value: string) {
    this.setAttribute('id', value);
  }

  get classList() {
    this.__htmlMod.__flushBatchIfAttributesPending(this.__element);
    const classes = this.__element.attribs.class ?? '';
    const result: string[] = [];

    // Single loop: split, trim, and filter in one pass
    for (const cls of classes.split(' ')) {
      const trimmed = cls.trim();
      if (trimmed) {
        result.push(trimmed);
      }
    }

    return result;
  }

  get className() {
    this.__htmlMod.__flushBatchIfAttributesPending(this.__element);
    return this.__element.attribs.class ?? '';
  }

  set className(value: string) {
    this.setAttribute('class', value);
  }

  get dataset(): DOMStringMap {
    return new Proxy(
      {},
      {
        get: (_target, prop: string) => {
          if (typeof prop !== 'string') return;
          const attributeName = `data-${camelToKebab(prop)}`;
          return this.getAttribute(attributeName);
        },

        set: (_target, prop: string, value: string) => {
          if (typeof prop !== 'string') return false;
          const attributeName = `data-${camelToKebab(prop)}`;
          this.setAttribute(attributeName, String(value));
          return true;
        },

        deleteProperty: (_target, prop: string) => {
          if (typeof prop !== 'string') return false;
          const attributeName = `data-${camelToKebab(prop)}`;
          this.removeAttribute(attributeName);
          return true;
        },

        has: (_target, prop: string) => {
          if (typeof prop !== 'string') return false;
          const attributeName = `data-${camelToKebab(prop)}`;
          return this.hasAttribute(attributeName);
        },

        ownKeys: _target => {
          // Return all data-* attributes as camelCase
          // Single loop combining filter and map
          const result: string[] = [];
          for (const name of this.getAttributeNames()) {
            if (name.startsWith('data-')) {
              result.push(kebabToCamel(name.slice(5))); // Remove 'data-' prefix
            }
          }
          return result;
        },

        getOwnPropertyDescriptor: (_target, prop: string) => {
          if (typeof prop !== 'string') return;
          const attributeName = `data-${camelToKebab(prop)}`;
          if (!this.hasAttribute(attributeName)) return;

          return {
            configurable: true,
            enumerable: true,
            value: this.getAttribute(attributeName),
            writable: true,
          };
        },
      }
    );
  }

  get attributes() {
    this.__htmlMod.__flushBatchIfAttributesPending(this.__element);
    return this.__element.source.attributes.map(attribute => {
      return {
        name: attribute.name.data,
        value: unescapeQuote(attribute.value?.data, attribute.quote ?? null),
      };
    });
  }

  get innerHTML() {
    // Check if innerHTML is cached (element was removed/replaced)
    const cached = this.__htmlMod.__cachedInnerHTML.get(this.__element);
    if (cached !== undefined) {
      return cached;
    }

    if (!this.__element.endIndex) {
      return '';
    }

    return this.__htmlMod.__source.slice(getContentStart(this.__element), getContentEnd(this.__element));
  }

  set innerHTML(html: string) {
    this.__htmlMod.__flushBatch();
    if (!this.__element.endIndex) {
      return;
    }

    const contentStart = getContentStart(this.__element);
    const contentEnd = getContentEnd(this.__element);
    const isEmpty = this.innerHTML.length === 0;
    const selfClosing = isSelfClosing(this.__element);
    const hasSlash = hasTrailingSlash(this.__element, this.__htmlMod.__source);

    const originalContentStart = contentStart;
    const originalContentEnd = contentEnd;
    const originalOpenTagEnd = this.__element.source.openTag.endIndex;

    if (selfClosing) {
      const closingTag = makeClosingTag(this.__element.source.openTag.name);
      const combined = html + closingTag;

      if (hasSlash) {
        const slashStart = this.__element.source.openTag.endIndex - 1;
        const tagEnd = this.__element.source.openTag.endIndex + 1;
        atomicOverwrite(this.__htmlMod, slashStart, tagEnd, `>${combined}`, this.__element);
      } else {
        // No trailing slash (e.g. void elements like <br>, <img src="a">):
        // insert AFTER the `>` (endIndex + 1), not before it, or the content
        // and synthesized close tag land inside the open tag.
        const insertPos = this.__element.source.openTag.endIndex + 1;
        atomicAppendRight(this.__htmlMod, insertPos, combined, this.__element);
      }
    } else if (isEmpty) {
      atomicPrependLeft(this.__htmlMod, contentEnd, html, this.__element);
    } else {
      atomicOverwrite(this.__htmlMod, contentStart, contentEnd, html, this.__element);
    }

    if (html.length > 0) {
      let parsePos: number;
      if (selfClosing) {
        const openTagEnd = hasSlash ? originalOpenTagEnd - 1 : originalOpenTagEnd;
        parsePos = openTagEnd + 1;
      } else if (isEmpty) {
        parsePos = originalContentEnd;
      } else {
        parsePos = originalContentStart;
      }
      const newChildren = AstManipulator.parseHtmlAtPosition(html, parsePos, this.__htmlMod.__options);
      AstManipulator.replaceChildren(this.__element, newChildren);
    } else {
      AstManipulator.replaceChildren(this.__element, []);
    }

    if (selfClosing) {
      const closingTag = makeClosingTag(this.__element.source.openTag.name);
      const openTagEnd = hasSlash ? this.__element.source.openTag.endIndex - 1 : this.__element.source.openTag.endIndex;

      if (html.length > 0) {
        const closeTagStart = openTagEnd + 1 + html.length;
        // endIndex is exclusive (one past the `>`), matching the parser's convention
        const closeTagEnd = closeTagStart + closingTag.length;
        AstManipulator.convertToRegularTag(this.__element, openTagEnd, closeTagStart, closeTagEnd);
      } else {
        const closeTagStart = openTagEnd + 1;
        // endIndex is exclusive (one past the `>`), matching the parser's convention
        const closeTagEnd = closeTagStart + closingTag.length;
        AstManipulator.convertToRegularTag(this.__element, openTagEnd, closeTagStart, closeTagEnd);
      }
    }
  }

  get textContent() {
    // Pending node inserts are invisible to the AST walk until flush.
    this.__htmlMod.__flushBatchIfStructuralPending();
    const text = DomUtils.textContent(this.__element);

    return decode(text);
  }

  set textContent(text: string) {
    this.__htmlMod.__flushBatch();
    if (!this.__element.endIndex) {
      return;
    }

    this.innerHTML = escapeHtml(text);
  }

  get outerHTML() {
    // Check if outerHTML is cached (element was removed/replaced)
    const cached = this.__htmlMod.__cachedOuterHTML.get(this.__element);
    if (cached !== undefined) {
      return cached;
    }

    return this.__htmlMod.__source.slice(this.__element.source.openTag.startIndex, getOuterEnd(this.__element));
  }

  /**
   * Whether this element is self-closing (`<tag />` with no close tag).
   */
  get isSelfClosing(): boolean {
    // A queued prepend() converts a self-closing element at flush time.
    this.__htmlMod.__flushBatchIfStructuralPending();
    return isSelfClosing(this.__element);
  }

  /**
   * Expand a self-closing element to have an explicit close tag.
   * `<x-image src="..." />` becomes `<x-image src="..."></x-image>`
   *
   * No-op if the element already has a close tag.
   *
   * This is needed because browser innerHTML parsing only treats HTML
   * void elements (img, br, hr, etc.) as self-closing. Any other
   * self-closing tag becomes an opening tag that swallows subsequent
   * siblings.
   */
  expandSelfClosing(): this {
    this.__htmlMod.__flushBatch();
    if (!isSelfClosing(this.__element)) return this;

    // Invalidate cached outerHTML since we're changing the element's structure
    this.__htmlMod.__cachedOuterHTML.delete(this.__element);

    const endIndex = this.__element.source.openTag.endIndex;
    // Use the open tag's source casing for the close tag. The parser pairs
    // open/close tags case-sensitively, so a synthesized lowercase close tag
    // on a mixed-case element (`<X-Image/>` -> `<X-Image></x-image>`) would not
    // re-pair on the next parse, leaving an orphaned close tag.
    const closeTag = makeClosingTag(this.__element.source.openTag.name);

    let openTagEnd: number;
    if (hasTrailingSlash(this.__element, this.__htmlMod.__source)) {
      // Replace ` />` or `/>` with `></tag>`
      // Walk back from `/` to skip whitespace before the slash
      let start = endIndex; // endIndex points to `>`
      start--; // now at `/`
      while (start > 0 && this.__htmlMod.__source[start - 1] === ' ') {
        start--;
      }
      atomicOverwrite(this.__htmlMod, start, endIndex + 1, `>${closeTag}`, this.__element);
      // The new `>` lands where the `/` (and any preceding spaces) began.
      openTagEnd = start;
    } else {
      atomicAppendRight(this.__htmlMod, endIndex + 1, closeTag, this.__element);
      // The `>` is unchanged.
      openTagEnd = endIndex;
    }

    // Fully sync the AST to reflect the new explicit close tag: update the
    // open-tag end, attach the close tag, and fix element.endIndex. Leaving any
    // of these stale corrupts a later before()/after()/append()/innerHTML.
    const closeTagStart = openTagEnd + 1;
    const closeTagEnd = closeTagStart + closeTag.length; // exclusive, matches parser
    AstManipulator.convertToRegularTag(this.__element, openTagEnd, closeTagStart, closeTagEnd);

    return this;
  }

  get children() {
    this.__htmlMod.__flushBatchIfStructuralPending();
    return this.__element.children;
  }

  get parent(): HtmlModElement | null {
    const { parent } = this.__element;

    if (parent?.type === 'tag') {
      return new this.__htmlMod.__HtmlModElement(parent as unknown as SourceElement, this.__htmlMod);
    }

    return null;
  }

  before(html: string) {
    this.__htmlMod.__flushBatchIfConflicting(this.__element, 'before');
    const element = this.__element;
    const htmlMod = this.__htmlMod;
    const insertPos = element.source.openTag.startIndex;

    const finalize = (shift: number) => {
      const newNodes = AstManipulator.parseHtmlAtPosition(html, insertPos + shift, htmlMod.__options);
      // eslint-disable-next-line unicorn/prefer-modern-dom-apis -- AST helper, not a DOM node
      AstManipulator.insertBefore(element, newNodes);
    };

    if (htmlMod.__isBatching) {
      htmlMod.__queueStructuralBatchEdit(
        {
          start: insertPos,
          end: insertPos,
          content: html,
          delta: calculatePrependLeftDelta(insertPos, html),
          element,
          finalize,
        },
        'before'
      );
      return this;
    }

    atomicPrependLeft(htmlMod, insertPos, html, element);
    finalize(0);

    return this;
  }

  after(html: string): this {
    this.__htmlMod.__flushBatchIfConflicting(this.__element, 'after');
    const element = this.__element;
    const htmlMod = this.__htmlMod;
    const insertPos = getOuterEnd(element);

    const finalize = (shift: number) => {
      const newNodes = AstManipulator.parseHtmlAtPosition(html, insertPos + shift, htmlMod.__options);
      AstManipulator.insertAfter(element, newNodes);
    };

    if (htmlMod.__isBatching) {
      if (htmlMod.__batchAppendRightPositions.has(insertPos)) {
        // Same-position appendRights apply LIFO sequentially — flush and
        // re-run so the position is recomputed against the flushed state.
        htmlMod.__flushBatch();
        return this.after(html);
      }
      htmlMod.__queueStructuralBatchEdit(
        {
          start: insertPos,
          end: insertPos,
          content: html,
          delta: calculateAppendRightDelta(insertPos, html),
          element,
          finalize,
        },
        'after'
      );
      return this;
    }

    atomicAppendRight(htmlMod, insertPos, html, element);
    finalize(0);

    return this;
  }

  prepend(html: string): this {
    this.__htmlMod.__flushBatchIfConflicting(this.__element, 'prepend');
    const element = this.__element;
    const htmlMod = this.__htmlMod;
    const selfClosing = isSelfClosing(element);
    // Raw read is safe mid-batch: this element has no queued edits (the
    // guard above flushed if it did), and the slash belongs to its own tag.
    const hadSlash = hasTrailingSlash(element, htmlMod.__sourceRaw);
    const originalEndIndex = element.source.openTag.endIndex;

    /** The single string operation this call performs. */
    let operation: { type: 'overwrite' | 'appendRight' | 'prependLeft'; start: number; end: number; content: string };
    if (selfClosing) {
      const closingTag = makeClosingTag(element.source.openTag.name);

      if (hadSlash) {
        const slashStart = originalEndIndex - 1;
        const gtEnd = originalEndIndex + 1;
        operation = { type: 'overwrite', start: slashStart, end: gtEnd, content: `>${html}${closingTag}` };
      } else {
        const insertPos = originalEndIndex + 1;
        operation = { type: 'appendRight', start: insertPos, end: insertPos, content: html + closingTag };
      }
    } else {
      const insertPos = originalEndIndex + 1;
      operation = { type: 'prependLeft', start: insertPos, end: insertPos, content: html };
    }

    const finalize = (shift: number) => {
      if (selfClosing) {
        // When the tag had a trailing slash, the overwrite replaced `/>` with a
        // single `>`, shifting the `>` (and therefore the inserted content) left
        // by one. parsePos must be derived from the post-overwrite open-tag end,
        // not the original `>` position, or every inserted position drifts.
        const openTagEnd = (hadSlash ? originalEndIndex - 1 : originalEndIndex) + shift;
        const parsePos = openTagEnd + 1;

        const newNodes = AstManipulator.parseHtmlAtPosition(html, parsePos, htmlMod.__options);
        AstManipulator.prependChild(element, newNodes);

        const closingTag = makeClosingTag(element.source.openTag.name);
        const closeTagStart = parsePos + html.length;
        // endIndex is exclusive (one past the `>`), matching the parser's convention
        const closeTagEnd = closeTagStart + closingTag.length;
        AstManipulator.convertToRegularTag(element, openTagEnd, closeTagStart, closeTagEnd);
      } else {
        const insertPos = originalEndIndex + 1 + shift;
        const newNodes = AstManipulator.parseHtmlAtPosition(html, insertPos, htmlMod.__options);
        AstManipulator.prependChild(element, newNodes);
      }
    };

    if (htmlMod.__isBatching) {
      if (
        (operation.type === 'appendRight' && htmlMod.__batchAppendRightPositions.has(operation.start)) ||
        (operation.type === 'prependLeft' && htmlMod.__hasPrependLeftCollision(operation.start, element))
      ) {
        htmlMod.__flushBatch();
        return this.prepend(html);
      }
      htmlMod.__queueStructuralBatchEdit(
        {
          start: operation.start,
          end: operation.end,
          content: operation.content,
          delta:
            operation.type === 'overwrite'
              ? calculateOverwriteDelta(operation.start, operation.end, operation.content)
              : operation.type === 'appendRight'
                ? calculateAppendRightDelta(operation.start, operation.content)
                : calculatePrependLeftDelta(operation.start, operation.content),
          element,
          finalize,
        },
        'prepend'
      );
      return this;
    }

    if (operation.type === 'overwrite') {
      atomicOverwrite(htmlMod, operation.start, operation.end, operation.content, element);
    } else if (operation.type === 'appendRight') {
      atomicAppendRight(htmlMod, operation.start, operation.content, element);
    } else {
      atomicPrependLeft(htmlMod, operation.start, operation.content, element);
    }
    finalize(0);

    return this;
  }

  append(html: string): this {
    this.__htmlMod.__flushBatchIfConflicting(this.__element, 'append');
    if (isSelfClosing(this.__element)) {
      return this.prepend(html);
    }

    const element = this.__element;
    const htmlMod = this.__htmlMod;
    const insertPos = getContentEnd(element);

    const finalize = (shift: number) => {
      const newNodes = AstManipulator.parseHtmlAtPosition(html, insertPos + shift, htmlMod.__options);
      AstManipulator.appendChild(element, newNodes);
    };

    if (htmlMod.__isBatching) {
      if (htmlMod.__batchAppendRightPositions.has(insertPos)) {
        // Same-position appendRights apply LIFO sequentially — flush and
        // re-run so the position is recomputed against the flushed state.
        htmlMod.__flushBatch();
        return this.append(html);
      }
      htmlMod.__queueStructuralBatchEdit(
        {
          start: insertPos,
          end: insertPos,
          content: html,
          delta: calculateAppendRightDelta(insertPos, html),
          element,
          finalize,
        },
        'append'
      );
      return this;
    }

    atomicAppendRight(htmlMod, insertPos, html, element);
    finalize(0);

    return this;
  }

  private __cacheDescendantsInnerHTML() {
    // Cache innerHTML and outerHTML for this element and all descendants
    const cacheNode = (node: SourceElement) => {
      // Only cache if not already cached
      if (!this.__htmlMod.__cachedInnerHTML.has(node)) {
        // Read innerHTML directly from source before it changes
        const innerHTML = this.__htmlMod.__source.slice(getContentStart(node), getContentEnd(node));
        this.__htmlMod.__cachedInnerHTML.set(node, innerHTML);

        // Also cache outerHTML
        const outerHTML = this.__htmlMod.__source.slice(node.source.openTag.startIndex, getOuterEnd(node));
        this.__htmlMod.__cachedOuterHTML.set(node, outerHTML);

        this.__removed = true;
      }

      // Recursively cache children
      if (node.children) {
        for (const child of node.children) {
          if (child.type === 'tag') {
            cacheNode(child as SourceElement);
          }
        }
      }
    };

    cacheNode(this.__element);
  }

  remove() {
    this.__htmlMod.__flushBatch();
    if (this.__removed) {
      return this;
    }

    this.__cacheDescendantsInnerHTML();

    const removeStart = this.__element.source.openTag.startIndex;
    const removeEnd = Math.min(getOuterEnd(this.__element), this.__htmlMod.__source.length);

    atomicRemove(this.__htmlMod, removeStart, removeEnd, this.__element);

    AstManipulator.removeNode(this.__element);

    return this;
  }

  replaceWith(html: string) {
    this.__htmlMod.__flushBatch();
    if (this.__removed) {
      return this;
    }

    this.__cacheDescendantsInnerHTML();

    const replaceStart = this.__element.source.openTag.startIndex;
    const replaceEnd = Math.min(getOuterEnd(this.__element), this.__htmlMod.__source.length);

    atomicOverwrite(this.__htmlMod, replaceStart, replaceEnd, html, this.__element);

    const newNodes = AstManipulator.parseHtmlAtPosition(html, replaceStart, this.__htmlMod.__options);
    AstManipulator.replaceNode(this.__element, newNodes);

    return this;
  }

  hasAttribute(name: string) {
    this.__htmlMod.__flushBatchIfAttributesPending(this.__element);
    return name in this.__element.attribs;
  }

  hasAttributes() {
    this.__htmlMod.__flushBatchIfAttributesPending(this.__element);
    return Object.keys(this.__element.attribs).length > 0;
  }

  getAttribute(name: string): string | null {
    this.__htmlMod.__flushBatchIfAttributesPending(this.__element);
    const attribute = this.__element.source.attributes.find(a => a.name.data === name);

    const value = this.__element.attribs[name] ?? null;

    if (!value) {
      return value;
    }

    return unescapeQuote(value, attribute?.quote ?? null) ?? null;
  }

  getAttributeNames() {
    this.__htmlMod.__flushBatchIfAttributesPending(this.__element);
    return Object.keys(this.__element.attribs);
  }

  setAttribute(name: string, value: string): this {
    // A conflicting queued edit (same attribute, or content ops that touch
    // the open-tag region) would make the positions read below stale —
    // flush first. Distinct-name attribute writes and before/after inserts
    // on the same element coexist safely.
    this.__htmlMod.__flushBatchIfConflicting(this.__element, `attr:${name}`);

    const attribute = this.__element.source.attributes.find(a => a.name.data === name);
    /** The single string operation this call performs, applied at the end. */
    let operation: { type: 'overwrite' | 'appendRight' | 'prependLeft'; start: number; end: number; content: string };

    // Process the value and determine the quote
    const [escapedValue, quoteChar] = processValueAndQuote(attribute?.quote ?? null, value);
    const hasQuote = !!attribute?.quote;

    // Variables to track attribute positions
    let nameStart: number;
    let valueStart: number;
    let sourceStart: number;
    let sourceEnd: number;

    // Track the actual quote character used in the source
    // (may differ from quoteChar due to fallback logic)
    let actualQuoteUsed = quoteChar;

    if (attribute) {
      /**
       * A value is already set, so we need to overwrite it
       */
      if (attribute?.value && attribute.value.startIndex <= attribute.value.endIndex) {
        const overwriteStart = attribute.value?.startIndex + (hasQuote ? -1 : 0);
        const overwriteEnd = attribute.value?.endIndex + 1 + (hasQuote ? 1 : 0);
        const content = `${quoteChar}${escapedValue}${quoteChar}`;

        operation = { type: 'overwrite', start: overwriteStart, end: overwriteEnd, content };

        nameStart = attribute.name.startIndex;
        valueStart = overwriteStart + (quoteChar ? 1 : 0);
        sourceStart = attribute.source.startIndex;
        sourceEnd =
          attribute.source.startIndex +
          (attribute.source.endIndex - attribute.source.startIndex) +
          (content.length - (overwriteEnd - overwriteStart));
      } else if (
        /**
         * The value is empty so we need to add it
         */
        attribute?.value &&
        attribute.value.startIndex > attribute.value.endIndex &&
        attribute.value.data === ''
      ) {
        if (hasQuote) {
          const overwriteStart = attribute.value?.startIndex - 1;
          const overwriteEnd = attribute.value?.endIndex + 2;
          const content = `${quoteChar}${escapedValue}${quoteChar}`;

          operation = { type: 'overwrite', start: overwriteStart, end: overwriteEnd, content };

          nameStart = attribute.name.startIndex;
          valueStart = overwriteStart + (quoteChar ? 1 : 0);
          sourceStart = attribute.source.startIndex;
          sourceEnd =
            attribute.source.startIndex +
            (attribute.source.endIndex - attribute.source.startIndex) +
            (content.length - (overwriteEnd - overwriteStart));
        } else {
          const insertPos = attribute.value.startIndex;
          const content = `${quoteChar}${escapedValue}${quoteChar}`;

          operation = { type: 'appendRight', start: insertPos, end: insertPos, content };

          nameStart = attribute.name.startIndex;
          valueStart = insertPos + (quoteChar ? 1 : 0);
          sourceStart = attribute.source.startIndex;
          sourceEnd = attribute.source.endIndex + content.length;
        }
      } else {
        actualQuoteUsed = quoteChar || '"';
        const insertPos = attribute.name.endIndex + 1;
        const content = `=${actualQuoteUsed}${escapedValue}${actualQuoteUsed}`;

        operation = { type: 'appendRight', start: insertPos, end: insertPos, content };

        nameStart = attribute.name.startIndex;
        valueStart = insertPos + 2; // +1 for =, +1 for quote
        sourceStart = attribute.source.startIndex;
        sourceEnd = attribute.source.endIndex + content.length;
      }
    } else {
      /**
       * No attribute is set, so we need to add it
       */
      actualQuoteUsed = quoteChar || '"';
      // Insert before the '>' of the opening tag
      let insertPos = this.__element.source.openTag.endIndex;
      let content = ` ${name}=${actualQuoteUsed}${escapedValue}${actualQuoteUsed}`;

      // For self-closing tags with trailing slash, insert before the '/' and add space after attribute
      if (isSelfClosing(this.__element)) {
        // The space heuristic below reads the element's own open-tag chars.
        // The top-of-method conflict guard deliberately lets DISTINCT-name
        // attribute writes coexist on one element — but a queued write's
        // trailing space is invisible in the pre-batch string, and missing
        // it here would add a second space (batched ≠ eager). Flush this
        // element's pending edits and re-read the insert position.
        if (this.__htmlMod.__isBatching) {
          this.__htmlMod.__flushBatchIfElementPending(this.__element);
          insertPos = this.__element.source.openTag.endIndex;
        }
        const charBeforeGt = this.__htmlMod.__sourceRaw.charAt(insertPos - 1);
        if (charBeforeGt === '/') {
          // Check if there's already a space before the '/'
          const charBeforeSlash = this.__htmlMod.__sourceRaw.charAt(insertPos - 2);
          if (charBeforeSlash === ' ') {
            // There's already a space, don't add another leading space
            content = `${name}=${actualQuoteUsed}${escapedValue}${actualQuoteUsed} `;
            insertPos = insertPos - 1; // Insert before the '/'
          } else {
            // No space before '/', keep the leading space and add trailing space
            content = ` ${name}=${actualQuoteUsed}${escapedValue}${actualQuoteUsed} `;
            insertPos = insertPos - 1; // Insert before the '/'
          }
        }
      }

      operation = { type: 'prependLeft', start: insertPos, end: insertPos, content };

      // Positions are calculated relative to where content is inserted
      // prependLeft inserts BEFORE insertPos, so content starts at insertPos
      const contentStart = insertPos;
      const hasLeadingSpace = content.startsWith(' ');
      const hasTrailingSpace = content.endsWith(' ');

      nameStart = contentStart + (hasLeadingSpace ? 1 : 0);
      valueStart = nameStart + name.length + 2; // +1 for =, +1 for quote
      sourceStart = contentStart + (hasLeadingSpace ? 1 : 0);
      // sourceEnd should point to the LAST character of the attribute (inclusive), not past it
      sourceEnd = contentStart + content.length - 1 - (hasTrailingSpace ? 1 : 0);
    }

    // 3. Apply the string operation and AST metadata. Positions were
    // calculated against pre-operation state, so they are correct after the
    // operation applies (eager) — or after the batch flush shifts them by
    // the cumulative delta of preceding edits (batched).
    const element = this.__element;
    const quoteForAst = actualQuoteUsed as '"' | "'" | null;
    const applyMetadata = (shift: number) =>
      AstManipulator.setAttribute(
        element,
        name,
        escapedValue,
        quoteForAst,
        nameStart + shift,
        valueStart + shift,
        sourceStart + shift,
        sourceEnd + shift,
        value // unescaped value for attribs
      );

    if (this.__htmlMod.__isBatching) {
      if (
        (operation.type === 'appendRight' && this.__htmlMod.__batchAppendRightPositions.has(operation.start)) ||
        (operation.type === 'prependLeft' && this.__htmlMod.__hasPrependLeftCollision(operation.start, element))
      ) {
        // Same-position inserts whose sequential order the batch sort cannot
        // reproduce (appendRight LIFO; cross-anchor prependLeft) — flush and
        // re-run against the flushed state, where every position captured
        // above is recomputed (no pending edits ⇒ no recursion loop).
        this.__htmlMod.__flushBatch();
        return this.setAttribute(name, value);
      }
      this.__htmlMod.__queueBatchEdit(
        {
          start: operation.start,
          end: operation.end,
          content: operation.content,
          delta:
            operation.type === 'overwrite'
              ? calculateOverwriteDelta(operation.start, operation.end, operation.content)
              : operation.type === 'appendRight'
                ? calculateAppendRightDelta(operation.start, operation.content)
                : calculatePrependLeftDelta(operation.start, operation.content),
          element,
          finalize: applyMetadata,
        },
        `attr:${name}`
      );
    } else {
      if (operation.type === 'overwrite') {
        atomicOverwrite(this.__htmlMod, operation.start, operation.end, operation.content, element);
      } else if (operation.type === 'appendRight') {
        atomicAppendRight(this.__htmlMod, operation.start, operation.content, element);
      } else {
        atomicPrependLeft(this.__htmlMod, operation.start, operation.content, element);
      }
      applyMetadata(0);
    }

    return this;
  }

  toggleAttribute(name: string, force?: boolean) {
    if (force === true) {
      this.setAttribute(name, '');
    } else if (force === false) {
      this.removeAttribute(name);
    } else {
      if (this.hasAttribute(name)) {
        this.removeAttribute(name);
      } else {
        this.setAttribute(name, '');
      }
    }

    return this;
  }

  removeAttribute(name: string) {
    // Same conflict rules as setAttribute — a queued edit on the same
    // attribute (or content ops) must land first.
    this.__htmlMod.__flushBatchIfConflicting(this.__element, `attr:${name}`);

    const element = this.__element;
    for (const attribute of element.source.attributes) {
      if (attribute.name.data !== name) {
        continue;
      }

      // Always remove the space before the attribute
      const removeStart = attribute.source.startIndex - 1;
      const removeEnd = attribute.source.endIndex + 1;

      if (this.__htmlMod.__isBatching) {
        this.__htmlMod.__queueBatchEdit(
          {
            start: removeStart,
            end: removeEnd,
            content: '',
            delta: calculateRemoveDelta(removeStart, removeEnd),
            element,
            // AstManipulator.removeAttribute is position-free.
            finalize: () => AstManipulator.removeAttribute(element, name),
          },
          `attr:${name}`
        );
        return this;
      }

      atomicRemove(this.__htmlMod, removeStart, removeEnd, element);
    }

    // 3. Modify AST: Remove attribute from element
    AstManipulator.removeAttribute(element, name);

    return this;
  }

  querySelector(selector: string): HtmlModElement | null {
    this.__htmlMod.__flushBatch();
    const result = select(selector, this.__element)?.[0] ?? null;
    if (!result) {
      return null;
    }

    return new this.__htmlMod.__HtmlModElement(result as unknown as SourceElement, this.__htmlMod);
  }

  querySelectorAll(selector: string): HtmlModElement[] {
    this.__htmlMod.__flushBatch();
    return select(selector, this.__element).map(element => {
      return new this.__htmlMod.__HtmlModElement(element as unknown as SourceElement, this.__htmlMod);
    });
  }

  toString() {
    if (this.__isClone) {
      return this.__htmlMod.toString();
    }

    return this.outerHTML;
  }

  clone() {
    const HtmlModule = this.__htmlMod.__HtmlMod;

    const clone = new HtmlModule(this.outerHTML).querySelector('*') as this;
    if (clone) {
      clone.__isClone = true;
    }

    return clone;
  }
}

export class HtmlModText {
  __text: SourceText;
  __htmlMod: HtmlMod;

  constructor(text: SourceText, htmlModule: HtmlMod) {
    this.__text = text;
    this.__htmlMod = htmlModule;
  }

  get textContent() {
    return decode(this.__text.data);
  }

  get innerHTML() {
    return this.__text.data;
  }

  set innerHTML(html: string) {
    // Non-batched mutation: positions read below must be post-flush.
    this.__htmlMod.__flushBatch();
    // Guard against an unpositioned node, but allow endIndex === 0 (a one-char
    // text node at the very start of the document) — `!0` would drop the write.
    if (this.__text.endIndex == null) {
      return;
    }

    const originalStart = this.__text.startIndex;
    atomicOverwrite(this.__htmlMod, originalStart, this.__text.endIndex + 1, html);

    // Modify AST: Update text node data
    AstManipulator.setTextData(this.__text, html);

    // Manually update endIndex - text node is inside the overwritten region
    this.__text.endIndex = originalStart + html.length - 1;
  }

  set textContent(text: string) {
    this.__htmlMod.__flushBatch();
    // Allow endIndex === 0 (one-char text node at index 0); `!0` would drop it.
    if (this.__text.endIndex == null) {
      return;
    }

    const escapedText = escapeHtml(text);
    const originalStart = this.__text.startIndex;
    atomicOverwrite(this.__htmlMod, originalStart, this.__text.endIndex + 1, escapedText);

    // Modify AST: Update text node data
    AstManipulator.setTextData(this.__text, escapedText);

    // Manually update endIndex - text node is inside the overwritten region
    this.__text.endIndex = originalStart + escapedText.length - 1;
  }

  toString() {
    return this.__text.data;
  }
}

function processValueAndQuote(quote: '"' | "'" | null, value: string) {
  //  " ' ` = < > or whitespace then we need to use quotes
  const valueNeedsQuotes = /[\s"'<=>`]/.test(value);

  // If no quotes are needed we return the value as is
  if (!valueNeedsQuotes) {
    return [value, quote || ''];
  }

  // If the attribute has single quotes and the value only contains single quotes,
  // we flip the quotes to double quotes
  if ((quote === "'" || !quote) && value.includes("'") && !value.includes('"')) {
    return [value, '"'];
  }

  // If the attribute has double quotes and the value only contains double quotes,
  // we flip the quotes to single quotes
  if ((quote === '"' || !quote) && value.includes('"') && !value.includes("'")) {
    return [value, "'"];
  }

  // For mixed quotes content, we need to escape
  return [quote === "'" ? value.replaceAll("'", '&#39;') : value.replaceAll('"', '&quot;'), quote || '"'];
}

function unescapeQuote(value: string | undefined, quote: '"' | "'" | null) {
  if (!value) return value;
  return quote === "'" ? value.replaceAll('&#39;', "'") : value.replaceAll('&quot;', '"');
}

// Helper to convert camelCase to kebab-case
function camelToKebab(string_: string): string {
  return string_.replaceAll(/([A-Z])/g, '-$1').toLowerCase();
}

// Helper to convert kebab-case to camelCase
function kebabToCamel(string_: string): string {
  return string_.replaceAll(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}
