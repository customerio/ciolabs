/* eslint-disable unicorn/prefer-dom-node-dataset -- raw attribute APIs are the surface under test */
import { describe, expect, test } from 'vitest';

import { HtmlMod } from './index';

/**
 * Batched write mode. The contract: running any sequence of attribute
 * operations inside `batch()` produces EXACTLY the same source string and
 * AST state as running them unbatched — the batch only changes when the
 * work happens, never the result.
 */

/** Snapshot every position field in the AST for deep comparison. */
function positionSnapshot(h: HtmlMod): string {
  const parts: string[] = [];
  const walk = (element: ReturnType<HtmlMod['querySelectorAll']>[number]): void => {
    const raw = element.__element;
    parts.push(
      `${raw.tagName}[${raw.startIndex},${raw.endIndex}]` +
        `(open:${raw.source?.openTag?.startIndex},${raw.source?.openTag?.endIndex})` +
        `(close:${raw.source?.closeTag?.startIndex ?? '-'},${raw.source?.closeTag?.endIndex ?? '-'})` +
        (raw.source?.attributes ?? [])
          .map(
            a =>
              `{${a.name.data}:n[${a.name.startIndex},${a.name.endIndex}]v[${a.value?.startIndex},${a.value?.endIndex}]s[${a.source?.startIndex},${a.source?.endIndex}]}`
          )
          .join('')
    );
  };
  for (const element of h.querySelectorAll('*')) walk(element);
  return parts.join('\n');
}

type Operation =
  | { kind: 'set'; selector: string; index: number; name: string; value: string }
  | { kind: 'remove'; selector: string; index: number; name: string };

function applyOperations(h: HtmlMod, operations: Operation[]): void {
  // Materialize targets first (mirrors the real loop pattern: query once,
  // then write per element).
  for (const op of operations) {
    const target = h.querySelectorAll(op.selector)[op.index];
    if (!target) continue;
    if (op.kind === 'set') {
      target.setAttribute(op.name, op.value);
    } else {
      target.removeAttribute(op.name);
    }
  }
}

function expectBatchEquivalence(source: string, operations: Operation[]): void {
  const eager = new HtmlMod(source);
  applyOperations(eager, operations);

  const batched = new HtmlMod(source);
  batched.batch(() => {
    // Query BEFORE the writes (queries flush) — write against captured
    // elements like the real loops do.
    const targets = operations.map(op => batched.querySelectorAll(op.selector)[op.index]);
    for (const [index, op] of operations.entries()) {
      const target = targets[index];
      if (!target) continue;
      if (op.kind === 'set') {
        target.setAttribute(op.name, op.value);
      } else {
        target.removeAttribute(op.name);
      }
    }
  });

  expect(batched.toString()).toBe(eager.toString());
  expect(positionSnapshot(batched)).toBe(positionSnapshot(eager));
}

const DOC = [
  '<x-section padding="16px 8px">',
  '<x-row gap="16">',
  '<x-column><x-heading level="2">Title</x-heading>',
  "<x-paragraph font-size='14'>Body copy that wraps</x-paragraph>",
  '<x-button href="https://example.com">Go</x-button></x-column>',
  '<x-column><x-image src="x.gif" width="100%"></x-image>',
  '<x-spacer height=16></x-spacer></x-column>',
  '</x-row>',
  '</x-section>',
].join('\n');

describe('batch equivalence with eager execution', () => {
  test('setting new attributes on many elements', () => {
    const operations: Operation[] = [
      'x-section',
      'x-row',
      'x-column',
      'x-heading',
      'x-paragraph',
      'x-button',
      'x-image',
      'x-spacer',
    ].map((selector, index) => ({
      kind: 'set' as const,
      selector,
      index: 0,
      name: 'data-carta-key',
      value: `key${index}`,
    }));
    expectBatchEquivalence(DOC, operations);
  });

  test('overwriting existing attribute values', () => {
    expectBatchEquivalence(DOC, [
      { kind: 'set', selector: 'x-section', index: 0, name: 'padding', value: '0' },
      { kind: 'set', selector: 'x-row', index: 0, name: 'gap', value: '32' },
      { kind: 'set', selector: 'x-paragraph', index: 0, name: 'font-size', value: '18' },
      { kind: 'set', selector: 'x-spacer', index: 0, name: 'height', value: '99' },
    ]);
  });

  test('removing attributes', () => {
    expectBatchEquivalence(DOC, [
      { kind: 'remove', selector: 'x-section', index: 0, name: 'padding' },
      { kind: 'remove', selector: 'x-image', index: 0, name: 'width' },
      { kind: 'remove', selector: 'x-button', index: 0, name: 'href' },
    ]);
  });

  test('mixed sets and removes across quote styles', () => {
    expectBatchEquivalence(DOC, [
      { kind: 'set', selector: 'x-heading', index: 0, name: 'data-x', value: 'a"b' },
      { kind: 'remove', selector: 'x-row', index: 0, name: 'gap' },
      { kind: 'set', selector: 'x-paragraph', index: 0, name: 'data-y', value: "c'd" },
      { kind: 'set', selector: 'x-column', index: 1, name: 'data-z', value: '' },
      { kind: 'remove', selector: 'x-spacer', index: 0, name: 'height' },
    ]);
  });

  test('property: random operation sequences match eager execution', () => {
    const tags = ['x-section', 'x-row', 'x-column', 'x-heading', 'x-paragraph', 'x-button', 'x-image', 'x-spacer'];
    const names = ['data-a', 'data-b', 'padding', 'gap', 'href', 'width', 'height'];
    // Deterministic PRNG so failures reproduce.
    let seed = 424_242;
    const rand = () => {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
      return seed / 2_147_483_648;
    };
    for (let round = 0; round < 25; round++) {
      const operations: Operation[] = [];
      const opCount = 1 + Math.floor(rand() * 8);
      for (let index = 0; index < opCount; index++) {
        const selector = tags[Math.floor(rand() * tags.length)];
        const name = names[Math.floor(rand() * names.length)];
        operations.push(
          rand() < 0.7
            ? { kind: 'set', selector, index: Math.floor(rand() * 2), name, value: `v${Math.floor(rand() * 100)}` }
            : { kind: 'remove', selector, index: Math.floor(rand() * 2), name }
        );
      }
      expectBatchEquivalence(DOC, operations);
    }
  });
});

describe('batch consistency guards', () => {
  test('a second write to the same element flushes and stays correct', () => {
    const h = new HtmlMod('<div a="1"><span>x</span></div>');
    h.batch(() => {
      const div = h.querySelectorAll('div')[0];
      div.setAttribute('b', '2');
      // Same element again — must flush the queued edit first, then apply.
      div.setAttribute('c', '3');
      div.setAttribute('b', '9');
    });
    expect(h.toString()).toBe('<div a="1" b="9" c="3"><span>x</span></div>');
  });

  test('attribute reads on an edited element see the queued write', () => {
    const h = new HtmlMod('<div><span>x</span></div>');
    h.batch(() => {
      const div = h.querySelectorAll('div')[0];
      div.setAttribute('data-key', 'abc');
      expect(div.getAttribute('data-key')).toBe('abc');
      expect(div.hasAttribute('data-key')).toBe(true);
    });
  });

  test('dataset round-trip inside a batch (the key-injection pattern)', () => {
    const h = new HtmlMod('<x-a></x-a><x-b></x-b><x-c data-carta-key="kept"></x-c>');
    h.batch(() => {
      let n = 0;
      for (const element of h.querySelectorAll('*')) {
        if (!element.dataset.cartaKey) {
          element.dataset.cartaKey = `gen${n++}`;
        }
      }
    });
    expect(h.toString()).toBe(
      '<x-a data-carta-key="gen0"></x-a><x-b data-carta-key="gen1"></x-b><x-c data-carta-key="kept"></x-c>'
    );
  });

  test('selector queries mid-batch observe queued edits', () => {
    const h = new HtmlMod('<x-a></x-a><x-b></x-b>');
    h.batch(() => {
      h.querySelectorAll('x-a')[0].setAttribute('data-k', '1');
      // Attribute selector must see the queued write (query flushes).
      expect(h.querySelectorAll('[data-k]')).toHaveLength(1);
      h.querySelectorAll('x-b')[0].setAttribute('data-k', '2');
    });
    expect(h.querySelectorAll('[data-k]')).toHaveLength(2);
  });

  test('toString mid-batch observes queued edits', () => {
    const h = new HtmlMod('<div></div>');
    h.batch(() => {
      h.querySelectorAll('div')[0].setAttribute('a', '1');
      expect(h.toString()).toBe('<div a="1"></div>');
    });
  });

  test('non-attribute mutations mid-batch flush first', () => {
    const h = new HtmlMod('<div><span>old</span></div>');
    h.batch(() => {
      const div = h.querySelectorAll('div')[0];
      div.setAttribute('a', '1');
      const span = h.querySelectorAll('span')[0];
      span.innerHTML = 'new';
    });
    expect(h.toString()).toBe('<div a="1"><span>new</span></div>');
  });

  test('nested batches flush once at the outermost exit', () => {
    const h = new HtmlMod('<x-a></x-a><x-b></x-b>');
    h.batch(() => {
      h.querySelectorAll('x-a')[0].setAttribute('a', '1');
      h.batch(() => {
        h.querySelectorAll('x-b')[0].setAttribute('b', '2');
      });
      expect(h.__batchDepth).toBe(1);
    });
    expect(h.toString()).toBe('<x-a a="1"></x-a><x-b b="2"></x-b>');
  });

  test('batch returns the callback result and flushes on throw', () => {
    const h = new HtmlMod('<div></div>');
    expect(h.batch(() => 42)).toBe(42);

    expect(() =>
      h.batch(() => {
        h.querySelectorAll('div')[0].setAttribute('a', '1');
        throw new Error('boom');
      })
    ).toThrow('boom');
    // The queued edit still landed (flush in finally).
    expect(h.toString()).toBe('<div a="1"></div>');
  });

  test('positions after a flushed batch support further eager edits', () => {
    const h = new HtmlMod('<x-a></x-a><x-b w="1"></x-b><x-c></x-c>');
    h.batch(() => {
      h.querySelectorAll('x-a')[0].setAttribute('data-long-attribute', 'a very long value indeed');
      h.querySelectorAll('x-c')[0].setAttribute('z', '9');
    });
    // Eager edits after the batch must land at correct (shifted) positions.
    h.querySelectorAll('x-b')[0].setAttribute('w', '22');
    h.querySelectorAll('x-c')[0].removeAttribute('z');
    expect(h.toString()).toBe(
      '<x-a data-long-attribute="a very long value indeed"></x-a><x-b w="22"></x-b><x-c></x-c>'
    );
  });

  test('self-closing elements match eager behavior when edited in a batch', () => {
    const source = '<x-a /><x-b/><x-c />';

    const eager = new HtmlMod(source);
    for (const element of eager.querySelectorAll('*')) {
      element.setAttribute('data-k', element.tagName);
    }

    const batched = new HtmlMod(source);
    batched.batch(() => {
      for (const element of batched.querySelectorAll('*')) {
        element.setAttribute('data-k', element.tagName);
      }
    });

    expect(batched.toString()).toBe(eager.toString());
    expect(positionSnapshot(batched)).toBe(positionSnapshot(eager));
  });
});
