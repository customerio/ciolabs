/* eslint-disable unicorn/prefer-dom-node-dataset -- raw attribute APIs are part of the surface under test */
import { describe, expect, test } from 'vitest';

import { HtmlMod } from './index';

/**
 * Adversarial + large-scale property coverage for batched writes. Every
 * test asserts byte-equivalence (source) AND position-equivalence (AST)
 * against unbatched execution on hostile content: comments, conditional
 * comments, entities, unicode, quotes, script/style payloads, deep nesting,
 * and whitespace-heavy documents.
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

describe('batch on hostile content', () => {
  test('comments, conditional comments, and doctype survive batched edits', () => {
    const source = [
      '<!DOCTYPE html>',
      '<!-- top comment with <fake-tag attr="x"> inside -->',
      '<x-a><!--[if mso]><table><tr><td><![endif]--><span>x</span><!--[if mso]></td></tr></table><![endif]--></x-a>',
      '<x-b>after</x-b>',
    ].join('\n');
    expectEquivalence(source, [
      { kind: 'set', selector: 'x-a', index: 0, name: 'data-k', value: '1' },
      { kind: 'before', selector: 'x-b', index: 0, html: '<!--marker-->' },
      { kind: 'set', selector: 'span', index: 0, name: 'data-k', value: '2' },
      { kind: 'after', selector: 'x-b', index: 0, html: '<!--end-->' },
    ]);
  });

  test('entities, unicode, and emoji content positions stay exact', () => {
    const source = '<x-a title="a&amp;b &lt;c&gt;">café \u{1F680} 你好 &nbsp; &#8212;</x-a><x-b>plain</x-b>';
    expectEquivalence(source, [
      { kind: 'set', selector: 'x-a', index: 0, name: 'data-ü', value: '\u{1F680}\u{1F680}' },
      { kind: 'append', selector: 'x-a', index: 0, html: ' — more \u{1F680}' },
      { kind: 'before', selector: 'x-b', index: 0, html: '<x-é></x-é>' },
      { kind: 'set', selector: 'x-b', index: 0, name: 'title', value: 'quotes "and" \'mixed\'' },
    ]);
  });

  test('script and style payloads with angle brackets are untouched', () => {
    const source = [
      '<script>if (a < b && b > c) { document.write("<div>"); }</script>',
      '<style>.x > .y::before { content: "</div>"; }</style>',
      '<x-a>content</x-a>',
    ].join('');
    expectEquivalence(source, [
      { kind: 'set', selector: 'x-a', index: 0, name: 'data-k', value: 'v' },
      { kind: 'before', selector: 'x-a', index: 0, html: '<x-new></x-new>' },
      { kind: 'set', selector: 'script', index: 0, name: 'data-s', value: '1' },
    ]);
  });

  test('deeply nested structures (30 levels)', () => {
    let source = 'leaf';
    for (let index = 29; index >= 0; index--) {
      source = `<x-l${index} depth="${index}">${source}</x-l${index}>`;
    }
    expectEquivalence(source, [
      { kind: 'set', selector: 'x-l0', index: 0, name: 'data-k', value: 'root' },
      { kind: 'set', selector: 'x-l15', index: 0, name: 'data-k', value: 'mid' },
      { kind: 'set', selector: 'x-l29', index: 0, name: 'data-k', value: 'deep' },
      { kind: 'prepend', selector: 'x-l29', index: 0, html: '<i>in</i>' },
      { kind: 'remove', selector: 'x-l15', index: 0, name: 'depth' },
      { kind: 'after', selector: 'x-l29', index: 0, html: '<sibling-x></sibling-x>' },
    ]);
  });

  test('whitespace-heavy formatting is preserved byte-for-byte', () => {
    const source = '<x-a\n    padding = "16px"\n\t data-x =\'y\'  >\n\n  text  \n</x-a>\n\n<x-b   />';
    expectEquivalence(source, [
      { kind: 'set', selector: 'x-a', index: 0, name: 'padding', value: '0' },
      { kind: 'set', selector: 'x-b', index: 0, name: 'data-k', value: 'v' },
      { kind: 'remove', selector: 'x-a', index: 0, name: 'data-x' },
      { kind: 'append', selector: 'x-a', index: 0, html: '<i>tail</i>' },
    ]);
  });

  test('unquoted, single-quoted, and empty attribute values', () => {
    const source = '<x-a w=100 h=\'50\' empty="" bare></x-a>';
    expectEquivalence(source, [{ kind: 'set', selector: 'x-a', index: 0, name: 'w', value: '200' }]);
    expectEquivalence(source, [{ kind: 'set', selector: 'x-a', index: 0, name: 'empty', value: 'filled' }]);
    expectEquivalence(source, [{ kind: 'set', selector: 'x-a', index: 0, name: 'bare', value: 'now-set' }]);
    expectEquivalence(source, [{ kind: 'set', selector: 'x-a', index: 0, name: 'h', value: "it's" }]);
  });
});

function buildEmailDoc(sections: number): string {
  const blocks: string[] = [];
  for (let index = 0; index < sections; index++) {
    blocks.push(
      `<x-section padding="16px"><x-row gap="4"><x-column>` +
        `<x-heading level="2">Feature ${index}</x-heading>` +
        `<x-paragraph font-size="14">Body copy ${index} that wraps onto lines &amp; has <strong>marks</strong>.</x-paragraph>` +
        `<x-button href="https://example.com/${index}">Go</x-button>` +
        `</x-column><x-column><x-image src="i${index}.gif" width="100%"><x-spacer /></x-column></x-row></x-section>`
    );
  }
  return `<x-base font-family="Helvetica">${blocks.join('\n')}</x-base>`;
}

describe('batch at scale', () => {
  test('key injection across 800+ elements matches eager exactly', () => {
    const source = buildEmailDoc(100);

    const eager = new HtmlMod(source);
    let n = 0;
    for (const element of eager.querySelectorAll('*')) {
      if (element.tagName.startsWith('x-')) element.setAttribute('data-carta-key', `k${n++}`);
    }

    const batched = new HtmlMod(source);
    batched.batch(() => {
      let m = 0;
      for (const element of batched.querySelectorAll('*')) {
        if (element.tagName.startsWith('x-')) element.setAttribute('data-carta-key', `k${m++}`);
      }
    });

    expect(batched.toString()).toBe(eager.toString());
    expect(positionSnapshot(batched)).toBe(positionSnapshot(eager));
  });

  test('inject keys, serialize, strip keys — full round-trip returns the original', () => {
    const source = buildEmailDoc(40);

    const h = new HtmlMod(source);
    h.batch(() => {
      let n = 0;
      for (const element of h.querySelectorAll('*')) {
        if (element.tagName.startsWith('x-')) element.setAttribute('data-carta-key', `k${n++}`);
      }
    });
    const keyed = h.toString();
    expect(keyed).toContain('data-carta-key="k0"');

    const stripper = new HtmlMod(keyed);
    stripper.batch(() => {
      for (const element of stripper.querySelectorAll('[data-carta-key]')) {
        element.removeAttribute('data-carta-key');
      }
    });
    expect(stripper.toString()).toBe(source);
  });

  test('marker wrapping across 200 elements matches eager exactly', () => {
    const source = buildEmailDoc(50);

    const wrap = (h: HtmlMod) => {
      const paragraphs = h.querySelectorAll('x-paragraph');
      for (const [index, paragraph] of paragraphs.entries()) {
        paragraph.before(`<!--carta:start:${index}-->`);
        paragraph.after(`<!--carta:end:${index}-->`);
      }
    };

    const eager = new HtmlMod(source);
    wrap(eager);

    const batched = new HtmlMod(source);
    // before+after touch the same element — batch() still wins because each
    // pair flushes at most once (second op on the element flushes the first).
    batched.batch(() => wrap(batched));

    expect(batched.toString()).toBe(eager.toString());
    expect(positionSnapshot(batched)).toBe(positionSnapshot(eager));
  });

  test('property: 50 random large-scale mixes stay equivalent', () => {
    const source = buildEmailDoc(10);
    const selectors = [
      'x-section',
      'x-row',
      'x-column',
      'x-heading',
      'x-paragraph',
      'x-button',
      'x-image',
      'x-spacer',
      'strong',
    ];
    let seed = 13_371_337;
    const rand = () => {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
      return seed / 2_147_483_648;
    };
    for (let round = 0; round < 50; round++) {
      const operations: Operation[] = [];
      const count = 2 + Math.floor(rand() * 10);
      for (let index = 0; index < count; index++) {
        const selector = selectors[Math.floor(rand() * selectors.length)];
        const targetIndex = Math.floor(rand() * 6);
        const roll = rand();
        if (roll < 0.15) {
          operations.push({ kind: 'before', selector, index: targetIndex, html: `<!--b${index}-->` });
        } else if (roll < 0.3) {
          operations.push({ kind: 'after', selector, index: targetIndex, html: `<!--a${index}-->` });
        } else if (roll < 0.4) {
          operations.push({ kind: 'prepend', selector, index: targetIndex, html: `<pre-${index}></pre-${index}>` });
        } else if (roll < 0.5) {
          operations.push({ kind: 'append', selector, index: targetIndex, html: `<app-${index}></app-${index}>` });
        } else if (roll < 0.85) {
          operations.push({
            kind: 'set',
            selector,
            index: targetIndex,
            name: `data-p${index % 4}`,
            value: `v"quoted" ${index}`,
          });
        } else {
          operations.push({ kind: 'remove', selector, index: targetIndex, name: 'padding' });
        }
      }
      expectEquivalence(source, operations);
    }
  });
});
