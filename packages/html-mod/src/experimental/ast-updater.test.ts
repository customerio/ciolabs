import { parseDocument, isTag } from '@ciolabs/htmlparser2-source';
import { describe, expect, test } from 'vitest';

import { AstUpdater } from './ast-updater.js';
import {
  calculateOverwriteDelta,
  calculateAppendRightDelta,
  calculatePrependLeftDelta,
  calculateRemoveDelta,
  shouldUpdatePosition,
  applyDeltaToPosition,
} from './position-delta.js';

describe('position-delta', () => {
  describe('calculateOverwriteDelta', () => {
    test('calculates delta for same length replacement', () => {
      const delta = calculateOverwriteDelta(10, 15, 'hello');
      expect(delta.operationType).toBe('overwrite');
      expect(delta.mutationStart).toBe(10);
      expect(delta.mutationEnd).toBe(15);
      expect(delta.delta).toBe(0); // 5 chars replaced with 5 chars
    });

    test('calculates delta for shorter replacement', () => {
      const delta = calculateOverwriteDelta(10, 15, 'hi');
      expect(delta.delta).toBe(-3); // 5 chars replaced with 2 chars
    });

    test('calculates delta for longer replacement', () => {
      const delta = calculateOverwriteDelta(10, 15, 'hello world');
      expect(delta.delta).toBe(6); // 5 chars replaced with 11 chars
    });
  });

  describe('calculateAppendRightDelta', () => {
    test('calculates delta for insertion', () => {
      const delta = calculateAppendRightDelta(10, 'hello');
      expect(delta.operationType).toBe('appendRight');
      expect(delta.mutationStart).toBe(10);
      expect(delta.delta).toBe(5);
    });
  });

  describe('calculatePrependLeftDelta', () => {
    test('calculates delta for insertion', () => {
      const delta = calculatePrependLeftDelta(10, 'hello');
      expect(delta.operationType).toBe('prependLeft');
      expect(delta.mutationStart).toBe(10);
      expect(delta.delta).toBe(5);
    });
  });

  describe('calculateRemoveDelta', () => {
    test('calculates delta for removal', () => {
      const delta = calculateRemoveDelta(10, 15);
      expect(delta.operationType).toBe('remove');
      expect(delta.mutationStart).toBe(10);
      expect(delta.mutationEnd).toBe(15);
      expect(delta.delta).toBe(-5);
    });
  });

  describe('shouldUpdatePosition', () => {
    test('overwrite affects positions >= end', () => {
      const delta = calculateOverwriteDelta(10, 15, 'hello world');
      expect(shouldUpdatePosition(9, delta)).toBe(false);
      expect(shouldUpdatePosition(10, delta)).toBe(false);
      expect(shouldUpdatePosition(11, delta)).toBe(false); // Within overwritten region
      expect(shouldUpdatePosition(14, delta)).toBe(false); // Within overwritten region
      expect(shouldUpdatePosition(15, delta)).toBe(true); // At end of overwritten region
      expect(shouldUpdatePosition(20, delta)).toBe(true);
    });

    test('appendRight affects positions >= start', () => {
      const delta = calculateAppendRightDelta(10, 'hello');
      expect(shouldUpdatePosition(9, delta)).toBe(false);
      expect(shouldUpdatePosition(10, delta)).toBe(true);
      expect(shouldUpdatePosition(11, delta)).toBe(true);
    });

    test('prependLeft affects positions >= start', () => {
      const delta = calculatePrependLeftDelta(10, 'hello');
      expect(shouldUpdatePosition(9, delta)).toBe(false);
      expect(shouldUpdatePosition(10, delta)).toBe(true);
      expect(shouldUpdatePosition(11, delta)).toBe(true);
    });

    test('remove affects positions >= end', () => {
      const delta = calculateRemoveDelta(10, 15);
      expect(shouldUpdatePosition(9, delta)).toBe(false);
      expect(shouldUpdatePosition(14, delta)).toBe(false);
      expect(shouldUpdatePosition(15, delta)).toBe(true);
      expect(shouldUpdatePosition(20, delta)).toBe(true);
    });
  });

  describe('applyDeltaToPosition', () => {
    test('applies positive delta to affected position', () => {
      const delta = calculateAppendRightDelta(10, 'hello');
      expect(applyDeltaToPosition(15, delta)).toBe(20);
    });

    test('does not apply delta to unaffected position', () => {
      const delta = calculateAppendRightDelta(10, 'hello');
      expect(applyDeltaToPosition(5, delta)).toBe(5);
    });

    test('applies negative delta', () => {
      const delta = calculateRemoveDelta(10, 15);
      expect(applyDeltaToPosition(20, delta)).toBe(15);
    });
  });
});

describe('AstUpdater', () => {
  describe('updateNodePositions', () => {
    test('updates single element positions after overwrite', () => {
      const html = '<div>hello</div>';
      const doc = parseDocument(html);
      const updater = new AstUpdater();

      const div = doc.children[0];
      expect(div.startIndex).toBe(0);
      expect(div.endIndex).toBe(15); // Inclusive - last char is at index 15

      // Simulate overwrite that increases length by 6 chars at position 5
      const delta = calculateOverwriteDelta(5, 10, 'hello world');
      updater.updateNodePositions(doc, delta);

      // Positions before mutation (0-4) stay same, after mutation shift by +6
      expect(div.startIndex).toBe(0); // Before mutation
      expect(div.endIndex).toBe(21); // 15 + 6
    });

    test('updates nested elements correctly', () => {
      const html = '<div><span>text</span></div>';
      const doc = parseDocument(html);
      const updater = new AstUpdater();

      const div = doc.children[0];
      if (!isTag(div)) throw new Error('Expected element');
      const span = div.children[0];

      // Simulate insertion before the div
      const delta = calculatePrependLeftDelta(0, 'prefix');
      updater.updateNodePositions(doc, delta);

      // All positions should shift by +6
      expect(div.startIndex).toBe(6);
      expect(span.startIndex).toBe(11);
    });

    test('updates attribute positions', () => {
      const html = '<div class="foo">content</div>';
      const doc = parseDocument(html);
      const updater = new AstUpdater();

      const div = doc.children[0];
      if (!isTag(div)) throw new Error('Expected element');
      const classAttribute = div.source.attributes.find(a => a.name.data === 'class')!;

      const originalNameStart = classAttribute.name.startIndex;
      const originalValueStart = classAttribute.value!.startIndex;

      // Simulate insertion before the div
      const delta = calculatePrependLeftDelta(0, 'XX');
      updater.updateNodePositions(doc, delta);

      expect(classAttribute.name.startIndex).toBe(originalNameStart + 2);
      expect(classAttribute.value!.startIndex).toBe(originalValueStart + 2);
    });

    test('updates text node positions', () => {
      const html = '<div>hello world</div>';
      const doc = parseDocument(html);
      const updater = new AstUpdater();

      const div = doc.children[0];
      if (!isTag(div)) throw new Error('Expected element');
      const textNode = div.children[0];

      // Simulate insertion before text
      const delta = calculatePrependLeftDelta(5, 'XX');
      updater.updateNodePositions(doc, delta);

      expect(textNode.startIndex).toBe(7); // 5 + 2
      expect(textNode.endIndex).toBe(17); // Original 15 + 2
    });

    test('skips nodes before mutation (optimization)', () => {
      const html = '<div>first</div><span>second</span>';
      const doc = parseDocument(html);
      const updater = new AstUpdater();

      const div = doc.children[0];
      const span = doc.children[1];

      const originalDivEnd = div.endIndex;
      const originalSpanStart = span.startIndex;

      // Simulate insertion after both elements
      const delta = calculateAppendRightDelta(35, 'suffix');
      updater.updateNodePositions(doc, delta);

      // Elements before mutation should not change
      expect(div.endIndex).toBe(originalDivEnd);
      expect(span.startIndex).toBe(originalSpanStart);
    });

    test('handles zero delta (no-op)', () => {
      const html = '<div>hello</div>';
      const doc = parseDocument(html);
      const updater = new AstUpdater();

      const originalStartIndex = doc.children[0].startIndex;

      // Same length replacement
      const delta = calculateOverwriteDelta(5, 10, 'world');
      updater.updateNodePositions(doc, delta);

      expect(doc.children[0].startIndex).toBe(originalStartIndex);
    });

    test('handles negative delta (removal)', () => {
      const html = '<div>hello world</div>';
      const doc = parseDocument(html);
      const updater = new AstUpdater();

      const div = doc.children[0];

      // Remove 6 chars at position 5
      const delta = calculateRemoveDelta(5, 11);
      updater.updateNodePositions(doc, delta);

      expect(div.endIndex).toBe(15); // Original 21 - 6
    });

    test('updates closeTag positions independently', () => {
      const html = '<div>content</div>';
      const doc = parseDocument(html);
      const updater = new AstUpdater();

      const div = doc.children[0];
      if (!isTag(div)) throw new Error('Expected element');
      const originalCloseTagStart = div.source.closeTag!.startIndex;

      // Insert after opening tag
      const delta = calculateAppendRightDelta(5, 'XX');
      updater.updateNodePositions(doc, delta);

      expect(div.source.closeTag!.startIndex).toBe(originalCloseTagStart + 2);
    });

    test('handles multiple nested levels', () => {
      const html = '<div><section><p>text</p></section></div>';
      const doc = parseDocument(html);
      const updater = new AstUpdater();

      const div = doc.children[0];
      if (!isTag(div)) throw new Error('Expected element');
      const section = div.children[0];
      if (!isTag(section)) throw new Error('Expected element');
      const p = section.children[0];

      // Insert at beginning
      const delta = calculatePrependLeftDelta(0, 'PREFIX');
      updater.updateNodePositions(doc, delta);

      const shift = 6;
      expect(div.startIndex).toBe(0 + shift);
      expect(section.startIndex).toBe(5 + shift);
      expect(p.startIndex).toBe(14 + shift);
    });

    test('updates comment node positions', () => {
      const html = '<!-- comment --><div>content</div>';
      const doc = parseDocument(html);
      const updater = new AstUpdater();

      const comment = doc.children[0];
      const div = doc.children[1];

      expect(comment.type).toBe('comment');
      if (!('startIndex' in comment) || !('endIndex' in comment)) {
        throw new Error('Comment should have position tracking');
      }
      expect(comment.startIndex).toBe(0);
      expect(comment.endIndex).toBe(15);

      // Insert at beginning
      const delta = calculatePrependLeftDelta(0, 'XX');
      updater.updateNodePositions(doc, delta);

      // Comment positions should shift
      expect(comment.startIndex).toBe(2);
      expect(comment.endIndex).toBe(17);

      // Div should also shift
      expect(div.startIndex).toBe(18);
    });

    test('updates comment positions after elements', () => {
      const html = '<div>text</div><!-- comment -->';
      const doc = parseDocument(html);
      const updater = new AstUpdater();

      const div = doc.children[0];
      const comment = doc.children[1];

      if (!('startIndex' in comment) || !('endIndex' in comment)) {
        throw new Error('Comment should have position tracking');
      }
      expect(comment.startIndex).toBe(15);
      expect(comment.endIndex).toBe(30);

      // Insert in middle of div content
      const delta = calculateAppendRightDelta(10, 'INSERTED');
      updater.updateNodePositions(doc, delta);

      // Comment after modification should shift
      expect(comment.startIndex).toBe(23); // 15 + 8
      expect(comment.endIndex).toBe(38); // 30 + 8
    });
  });
});
