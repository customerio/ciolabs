/* eslint-disable unicorn/prefer-dom-node-dataset -- raw attribute APIs are part of the surface under test */
import { describe, expect, test } from 'vitest';

import { HtmlMod } from './index';

/**
 * Structural batching (before/after/prepend/append) — same contract as
 * attribute batching: identical source string AND identical AST state to
 * unbatched execution, for every op mix and call order.
 */

function positionSnapshot(h: HtmlMod): string {
  const parts: string[] = [];
  for (const element of h.querySelectorAll('*')) {
    const raw = element.__element;
    parts.push(
      `${raw.tagName}[${raw.startIndex},${raw.endIndex}]` +
        `(open:${raw.source?.openTag?.startIndex},${raw.source?.openTag?.endIndex})` +
        `(close:${raw.source?.closeTag?.startIndex ?? '-'},${raw.source?.closeTag?.endIndex ?? '-'})` +
        (raw.source?.attributes ?? [])
          .map(a => `{${a.name.data}:[${a.source?.startIndex},${a.source?.endIndex}]}`)
          .join('')
    );
  }
  return parts.join('\n');
}

type Operation =
  | { kind: 'before' | 'after' | 'prepend' | 'append'; selector: string; index: number; html: string }
  | { kind: 'set'; selector: string; index: number; name: string; value: string }
  | { kind: 'remove'; selector: string; index: number; name: string };

function run(h: HtmlMod, op: Operation): void {
  const target = h.querySelectorAll(op.selector)[op.index];
  if (!target) return;
  switch (op.kind) {
    case 'before': {
      target.before(op.html);
      break;
    }
    case 'after': {
      target.after(op.html);
      break;
    }
    case 'prepend': {
      target.prepend(op.html);
      break;
    }
    case 'append': {
      target.append(op.html);
      break;
    }
    case 'set': {
      target.setAttribute(op.name, op.value);
      break;
    }
    case 'remove': {
      target.removeAttribute(op.name);
      break;
    }
  }
}

function expectEquivalence(source: string, operations: Operation[]): void {
  const eager = new HtmlMod(source);
  for (const op of operations) run(eager, op);

  const batched = new HtmlMod(source);
  batched.batch(() => {
    // Capture targets up front (queries flush) — the real loop pattern.
    const targets = operations.map(op => batched.querySelectorAll(op.selector)[op.index]);
    for (const [index, op] of operations.entries()) {
      const target = targets[index];
      if (!target) continue;
      switch (op.kind) {
        case 'before': {
          target.before(op.html);
          break;
        }
        case 'after': {
          target.after(op.html);
          break;
        }
        case 'prepend': {
          target.prepend(op.html);
          break;
        }
        case 'append': {
          target.append(op.html);
          break;
        }
        case 'set': {
          target.setAttribute(op.name, op.value);
          break;
        }
        case 'remove': {
          target.removeAttribute(op.name);
          break;
        }
      }
    }
  });

  expect(batched.toString()).toBe(eager.toString());
  expect(positionSnapshot(batched)).toBe(positionSnapshot(eager));
}

const DOC = [
  '<x-section padding="16px">',
  '<x-heading level="2">Title</x-heading>',
  '<x-paragraph>Alpha body</x-paragraph>',
  '<x-paragraph>Beta body</x-paragraph>',
  '<x-list><li>one</li><li>two</li></x-list>',
  '<x-image src="x.gif">',
  '<x-spacer />',
  '</x-section>',
].join('');

describe('structural batch equivalence', () => {
  test('before/after markers on distinct elements', () => {
    expectEquivalence(DOC, [
      { kind: 'before', selector: 'x-heading', index: 0, html: '<!--m:start-->' },
      { kind: 'after', selector: 'x-heading', index: 0, html: '<!--m:end-->' },
      { kind: 'before', selector: 'x-list', index: 0, html: '<!--l:start-->' },
      { kind: 'after', selector: 'x-list', index: 0, html: '<!--l:end-->' },
    ]);
  });

  test('the native-html marker pattern: before+after around every paragraph', () => {
    // Mirrors parcel's native-html transformer, which wraps every matched
    // element in comment markers — previously O(elements × document).
    const operations: Operation[] = [];
    for (const index of [0, 1]) {
      operations.push(
        { kind: 'before', selector: 'x-paragraph', index, html: `<!--carta:p${index}:start-->` },
        { kind: 'after', selector: 'x-paragraph', index, html: `<!--carta:p${index}:end-->` }
      );
    }
    expectEquivalence(DOC, operations);
  });

  test('adjacent siblings: after(A) then before(B) at the same boundary', () => {
    expectEquivalence(DOC, [
      { kind: 'after', selector: 'x-paragraph', index: 0, html: '<a-mark></a-mark>' },
      { kind: 'before', selector: 'x-paragraph', index: 1, html: '<b-mark></b-mark>' },
    ]);
  });

  test('adjacent siblings: before(B) then after(A) — reversed call order', () => {
    // Same boundary, reversed call order. Sequential execution puts the
    // after(A) content adjacent to A regardless of call order (the second
    // op's position computation sees the first insert's shift); the batch
    // tie-break must reproduce that.
    expectEquivalence(DOC, [
      { kind: 'before', selector: 'x-paragraph', index: 1, html: '<b-mark></b-mark>' },
      { kind: 'after', selector: 'x-paragraph', index: 0, html: '<a-mark></a-mark>' },
    ]);
  });

  test('prepend/append into slots (slot-wrapping pattern)', () => {
    expectEquivalence(DOC, [
      { kind: 'prepend', selector: 'x-section', index: 0, html: '<carta-slot-node data-slot="default">' },
      { kind: 'append', selector: 'x-section', index: 0, html: '</carta-slot-node>' },
      { kind: 'prepend', selector: 'x-list', index: 0, html: '<li>zero</li>' },
      { kind: 'append', selector: 'x-paragraph', index: 1, html: ' — appended' },
    ]);
  });

  test('prepend converts self-closing elements identically', () => {
    expectEquivalence('<x-a /><x-b/><x-c></x-c>', [
      { kind: 'prepend', selector: 'x-a', index: 0, html: '<i>1</i>' },
      { kind: 'prepend', selector: 'x-b', index: 0, html: '<i>2</i>' },
      { kind: 'prepend', selector: 'x-c', index: 0, html: '<i>3</i>' },
    ]);
  });

  test('append on a self-closing element delegates to prepend identically', () => {
    expectEquivalence('<x-a /><x-b></x-b>', [
      { kind: 'append', selector: 'x-a', index: 0, html: 'content' },
      { kind: 'append', selector: 'x-b', index: 0, html: 'content' },
    ]);
  });

  test('mixed attribute and structural edits', () => {
    expectEquivalence(DOC, [
      { kind: 'set', selector: 'x-heading', index: 0, name: 'data-carta-key', value: 'h1' },
      { kind: 'before', selector: 'x-paragraph', index: 0, html: '<!--start-->' },
      { kind: 'set', selector: 'x-paragraph', index: 1, name: 'data-carta-key', value: 'p2' },
      { kind: 'after', selector: 'x-paragraph', index: 0, html: '<!--end-->' },
      { kind: 'remove', selector: 'x-section', index: 0, name: 'padding' },
      { kind: 'append', selector: 'x-list', index: 0, html: '<li>three</li>' },
    ]);
  });

  test('property: random structural + attribute mixes match eager execution', () => {
    const selectors = ['x-section', 'x-heading', 'x-paragraph', 'x-list', 'x-image', 'x-spacer'];
    let seed = 987_654;
    const rand = () => {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
      return seed / 2_147_483_648;
    };
    for (let round = 0; round < 25; round++) {
      const operations: Operation[] = [];
      const count = 1 + Math.floor(rand() * 7);
      for (let index = 0; index < count; index++) {
        const selector = selectors[Math.floor(rand() * selectors.length)];
        const targetIndex = Math.floor(rand() * 2);
        const roll = rand();
        if (roll < 0.2) {
          operations.push({ kind: 'before', selector, index: targetIndex, html: `<m-${index}></m-${index}>` });
        } else if (roll < 0.4) {
          operations.push({ kind: 'after', selector, index: targetIndex, html: `<m-${index}></m-${index}>` });
        } else if (roll < 0.55) {
          operations.push({ kind: 'prepend', selector, index: targetIndex, html: `p${index} ` });
        } else if (roll < 0.7) {
          operations.push({ kind: 'append', selector, index: targetIndex, html: ` a${index}` });
        } else if (roll < 0.9) {
          operations.push({
            kind: 'set',
            selector,
            index: targetIndex,
            name: `data-r${index % 3}`,
            value: `v${index}`,
          });
        } else {
          operations.push({ kind: 'remove', selector, index: targetIndex, name: 'padding' });
        }
      }
      expectEquivalence(DOC, operations);
    }
  });
});

describe('structural batch guards', () => {
  test('children reads flush pending structural edits', () => {
    const h = new HtmlMod('<div><span>x</span></div>');
    h.batch(() => {
      const div = h.querySelectorAll('div')[0];
      div.append('<i>new</i>');
      // Deferred insert must become visible to the structural read.
      expect(div.children.filter(c => c.type === 'tag')).toHaveLength(2);
    });
  });

  test('attribute-only batches do NOT flush on children reads', () => {
    const h = new HtmlMod('<div><span>x</span></div>');
    h.batch(() => {
      const div = h.querySelectorAll('div')[0];
      div.setAttribute('a', '1');
      void div.children;
      // The queued attribute edit survived the structural read.
      expect(h.__batchEdits).toHaveLength(1);
    });
    expect(h.toString()).toBe('<div a="1"><span>x</span></div>');
  });

  test('two structural ops on the same element flush between', () => {
    const h = new HtmlMod('<ul><li>a</li></ul>');
    h.batch(() => {
      const ul = h.querySelectorAll('ul')[0];
      ul.prepend('<li>start</li>');
      ul.append('<li>end</li>');
    });
    expect(h.toString()).toBe('<ul><li>start</li><li>a</li><li>end</li></ul>');
  });

  test('innerHTML getter mid-batch observes structural edits', () => {
    const h = new HtmlMod('<div><span>x</span></div>');
    h.batch(() => {
      h.querySelectorAll('span')[0].before('<b>y</b>');
      expect(h.querySelectorAll('div')[0].innerHTML).toBe('<b>y</b><span>x</span>');
    });
  });

  test('cross-anchor prependLeft ties: before(child) + prepend(parent), both call orders (review finding)', () => {
    // prepend(parent) and before(firstChild) share the content-start
    // position but anchor differently: prepend's anchor (the open tag)
    // never shifts, before's anchor (the child) does — so sequential
    // execution puts the prepend content first in BOTH call orders, which
    // a stable queue-order sort cannot reproduce. The batch must flush and
    // retry.
    for (const order of ['before-first', 'prepend-first'] as const) {
      const source = '<div><span>x</span></div>';

      const eager = new HtmlMod(source);
      if (order === 'before-first') {
        eager.querySelectorAll('span')[0].before('Y');
        eager.querySelectorAll('div')[0].prepend('X');
      } else {
        eager.querySelectorAll('div')[0].prepend('X');
        eager.querySelectorAll('span')[0].before('Y');
      }

      const batched = new HtmlMod(source);
      batched.batch(() => {
        const span = batched.querySelectorAll('span')[0];
        const div = batched.querySelectorAll('div')[0];
        if (order === 'before-first') {
          span.before('Y');
          div.prepend('X');
        } else {
          div.prepend('X');
          span.before('Y');
        }
      });

      expect(batched.toString(), order).toBe(eager.toString());
      expect(batched.toString(), order).toBe('<div>XY<span>x</span></div>');
    }
  });

  test('same-element multi-attribute writes still batch flush-free (FIFO-safe tie)', () => {
    // Two NEW attributes on one element share the prependLeft position but
    // the same anchor — FIFO both sequentially and under the stable sort.
    // The cross-anchor guard must NOT deopt this.
    const h = new HtmlMod('<div><span>x</span></div>');
    h.batch(() => {
      // Capture targets first — selector queries flush pending edits.
      const div = h.querySelectorAll('div')[0];
      const span = h.querySelectorAll('span')[0];
      div.setAttribute('data-a', '1');
      span.setAttribute('data-b', '2');
      div.setAttribute('data-c', '3');
      // All three queued — no conflict flush for distinct names/positions.
      expect(h.__batchEdits).toHaveLength(3);
    });
    expect(h.toString()).toBe('<div data-a="1" data-c="3"><span data-b="2">x</span></div>');
  });

  test('id read mid-batch sees the queued write (review finding)', () => {
    const h = new HtmlMod('<div><span>x</span></div>');
    h.batch(() => {
      const div = h.querySelectorAll('div')[0];
      div.setAttribute('id', 'fresh');
      expect(div.id).toBe('fresh');
    });
  });

  test('textContent read mid-batch sees queued inserts (review finding)', () => {
    const h = new HtmlMod('<div><span>x</span></div>');
    h.batch(() => {
      const div = h.querySelectorAll('div')[0];
      div.append('tail');
      expect(div.textContent).toBe('xtail');
    });
  });

  test('sourceRange read mid-batch is coherent, not mixed-coordinate (review finding)', () => {
    const h = new HtmlMod('<x-a></x-a>\n<x-b></x-b>');
    let midBatch: unknown;
    h.batch(() => {
      h.querySelectorAll('x-a')[0].setAttribute('data-long', 'a long value that shifts positions');
      midBatch = h.querySelectorAll('x-b')[0].sourceRange;
    });
    const after = h.querySelectorAll('x-b')[0].sourceRange;
    expect(midBatch).toEqual(after);
  });

  test('isSelfClosing read mid-batch reflects a queued prepend conversion (review finding)', () => {
    const h = new HtmlMod('<x-a /><x-b></x-b>');
    h.batch(() => {
      const a = h.querySelectorAll('x-a')[0];
      expect(a.isSelfClosing).toBe(true);
      a.prepend('content');
      expect(a.isSelfClosing).toBe(false);
    });
    expect(h.toString()).toBe('<x-a >content</x-a><x-b></x-b>');
  });

  test('interleaved batches and eager ops keep positions coherent', () => {
    const h = new HtmlMod('<x-a></x-a><x-b></x-b><x-c></x-c>');
    h.batch(() => {
      h.querySelectorAll('x-a')[0].after('<m-1></m-1>');
      h.querySelectorAll('x-c')[0].setAttribute('k', 'v');
    });
    h.querySelectorAll('x-b')[0].before('<m-2></m-2>');
    h.batch(() => {
      h.querySelectorAll('m-2')[0].setAttribute('data-x', 'y');
      h.querySelectorAll('x-c')[0].after('<m-3></m-3>');
    });
    expect(h.toString()).toBe('<x-a></x-a><m-1></m-1><m-2 data-x="y"></m-2><x-b></x-b><x-c k="v"></x-c><m-3></m-3>');
  });
});
