/**
 * Position delta tracking for incremental AST updates
 *
 * This module calculates how string manipulation operations affect position indices
 * in the AST, allowing us to update node positions without reparsing.
 */

export type OperationType = 'overwrite' | 'appendRight' | 'prependLeft' | 'remove';

export interface PositionDelta {
  /**
   * Type of string manipulation operation
   */
  operationType: OperationType;

  /**
   * Starting index of the mutation in the original source
   */
  mutationStart: number;

  /**
   * Ending index of the mutation in the original source
   */
  mutationEnd: number;

  /**
   * Net change in string length (positive for growth, negative for shrinkage)
   */
  delta: number;
}

/**
 * Calculate position delta for an overwrite operation
 *
 * Example: overwrite(10, 15, "hello") replaces 5 chars with 5 chars (delta = 0)
 * Example: overwrite(10, 15, "hi") replaces 5 chars with 2 chars (delta = -3)
 */
export function calculateOverwriteDelta(start: number, end: number, content: string): PositionDelta {
  const oldLength = end - start;
  const newLength = content.length;

  return {
    operationType: 'overwrite',
    mutationStart: start,
    mutationEnd: end,
    delta: newLength - oldLength,
  };
}

/**
 * Calculate position delta for an appendRight operation
 *
 * Example: appendRight(10, "hello") inserts 5 chars after position 10 (delta = 5)
 * Positions > 10 are shifted right by 5
 */
export function calculateAppendRightDelta(index: number, content: string): PositionDelta {
  return {
    operationType: 'appendRight',
    mutationStart: index,
    mutationEnd: index,
    delta: content.length,
  };
}

/**
 * Calculate position delta for a prependLeft operation
 *
 * Example: prependLeft(10, "hello") inserts 5 chars before position 10 (delta = 5)
 * Positions >= 10 are shifted right by 5
 */
export function calculatePrependLeftDelta(index: number, content: string): PositionDelta {
  return {
    operationType: 'prependLeft',
    mutationStart: index,
    mutationEnd: index,
    delta: content.length,
  };
}

/**
 * Calculate position delta for a remove operation
 *
 * Example: remove(10, 15) removes 5 chars (delta = -5)
 * Positions >= 15 are shifted left by 5
 */
export function calculateRemoveDelta(start: number, end: number): PositionDelta {
  return {
    operationType: 'remove',
    mutationStart: start,
    mutationEnd: end,
    delta: -(end - start),
  };
}

/**
 * Check if a position should be updated based on the delta
 *
 * Rules:
 * - overwrite: positions > mutationStart are affected (not the start position itself)
 * - appendRight: positions > mutationStart are affected
 * - prependLeft: positions >= mutationStart are affected
 * - remove: positions >= mutationEnd are affected
 */
export function shouldUpdatePosition(position: number, delta: PositionDelta): boolean {
  switch (delta.operationType) {
    case 'overwrite': {
      // Only positions at or after the END of the overwritten region are affected
      // Positions within [mutationStart, mutationEnd) are being overwritten and become invalid
      return position >= delta.mutationEnd;
    }

    case 'appendRight': {
      // Positions at or after the insertion point are affected
      // appendRight(pos, content) inserts content before position pos, pushing it right
      return position >= delta.mutationStart;
    }

    case 'prependLeft': {
      // Positions at or after the insertion point are affected
      return position >= delta.mutationStart;
    }

    case 'remove': {
      // Positions at or after the end of removed region are affected
      return position >= delta.mutationEnd;
    }

    default: {
      return false;
    }
  }
}

/**
 * Apply a delta to a position if it should be updated
 */
export function applyDeltaToPosition(position: number, delta: PositionDelta): number {
  if (!shouldUpdatePosition(position, delta)) {
    return position;
  }

  return position + delta.delta;
}
