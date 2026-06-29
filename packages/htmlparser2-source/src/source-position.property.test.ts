/**
 * Property-based source-position invariants for the parser.
 *
 * Everything built on this package (notably @ciolabs/html-mod's incremental
 * mutation engine) trusts two guarantees:
 *
 *   1. Round-trip — `nodeToString(parseDocument(s)) === s`. The recorded source
 *      ranges + serializer must reproduce the input byte-for-byte.
 *   2. Position correctness — for every node, `source.slice(...)` at the tracked
 *      indices equals what the node claims (open tag, close tag, attribute
 *      name/value/source, comment delimiters, text data).
 *
 * These are exercised over randomized (seeded, reproducible) well-formed inputs
 * so the parser never restructures the tree — any failure is a genuine
 * position/serialization bug in this package.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, test } from 'vitest';

import { nodeToString, parseDocument, type Options } from './index';

function makeRand(seed: number): () => number {
  let rng = seed;
  return () => {
    rng = (rng * 1_103_515_245 + 12_345) & 0x7f_ff_ff_ff;
    return rng / 0x7f_ff_ff_ff;
  };
}

// Content model that never triggers HTML5 reparenting:
// block elements may contain block/inline/text; inline only inline/text.
const BLOCK = ['div', 'section', 'article', 'header'];
const INLINE = ['span', 'b', 'i', 'em', 'a', 'strong', 'u'];
const VOID = ['br', 'img', 'hr'];
const TEXTS = [
  'hello',
  'a b c',
  'x',
  '&amp; entity',
  'with <brackets escaped>'.replaceAll('<', '&lt;').replaceAll('>', '&gt;'),
  '',
];

function attributes(rand: () => number): string {
  const choices = [
    '',
    ' class="c1"',
    ' id="x" data-n="3"',
    " title='single'",
    ' hidden',
    ' data-empty=""',
    ' class="a b"',
  ];
  return choices[Math.floor(rand() * choices.length)];
}

function genInline(rand: () => number, depth: number): string {
  const r = rand();
  if (depth <= 0 || r < 0.4) return TEXTS[Math.floor(rand() * TEXTS.length)];
  if (r < 0.55) return `<${VOID[Math.floor(rand() * VOID.length)]}${attributes(rand)}>`;
  const tag = INLINE[Math.floor(rand() * INLINE.length)];
  let inner = '';
  const n = Math.floor(rand() * 3);
  for (let index = 0; index < n; index++) inner += genInline(rand, depth - 1);
  return `<${tag}${attributes(rand)}>${inner}</${tag}>`;
}

function genBlock(rand: () => number, depth: number): string {
  if (depth <= 0 || rand() < 0.3) return genInline(rand, 2);
  const useBlock = rand() < 0.5;
  const tag = useBlock ? BLOCK[Math.floor(rand() * BLOCK.length)] : INLINE[Math.floor(rand() * INLINE.length)];
  let inner = '';
  const n = Math.floor(rand() * 4);
  for (let index = 0; index < n; index++) inner += rand() < 0.5 ? genBlock(rand, depth - 1) : genInline(rand, 2);
  return `<${tag}${attributes(rand)}>${inner}</${tag}>`;
}

function assertPositions(source: string, node: any): void {
  if (node.type === 'tag' || node.type === 'script' || node.type === 'style') {
    const ot = node.source?.openTag;
    if (ot) {
      const slice = source.slice(ot.startIndex, ot.endIndex + 1);
      expect(slice, `openTag.data for <${node.name}>`).toBe(ot.data);
      expect(slice.startsWith(`<${node.name}`), `openTag slice ${JSON.stringify(slice)}`).toBe(true);
    }
    const ct = node.source?.closeTag;
    if (ct && ct.startIndex >= 0) {
      const slice = source.slice(ct.startIndex, ct.endIndex);
      expect(slice, `closeTag.data for <${node.name}>`).toBe(ct.data);
    }
    for (const a of node.source?.attributes ?? []) {
      expect(source.slice(a.name.startIndex, a.name.endIndex + 1), `attr name`).toBe(a.name.data);
      if (a.value) {
        expect(source.slice(a.value.startIndex, a.value.endIndex + 1), `attr value`).toBe(a.value.data);
      }
      expect(source.slice(a.source.startIndex, a.source.endIndex + 1), `attr source`).toBe(a.source.data);
    }
  } else if (node.type === 'text' && typeof node.startIndex === 'number') {
    expect(source.slice(node.startIndex, node.endIndex + 1), `text data`).toBe(node.data);
  } else if (node.type === 'comment' && typeof node.startIndex === 'number') {
    expect(source.slice(node.startIndex, node.endIndex + 1), `comment delimiters`).toBe(`<!--${node.data}-->`);
  }
  for (const c of node.children ?? []) assertPositions(source, c);
}

describe('parser source-position property invariants', () => {
  const options: Options = {};

  test('round-trips and tracks correct positions over random well-formed HTML', () => {
    for (let trial = 0; trial < 3000; trial++) {
      const rand = makeRand(trial * 2_654_435_761 + 1);
      let html = '';
      const roots = 1 + Math.floor(rand() * 3);
      for (let index = 0; index < roots; index++) html += genBlock(rand, 4);
      if (!html) html = '<div>x</div>';

      const document = parseDocument(html, options);
      try {
        expect(nodeToString(document)).toBe(html);
        assertPositions(html, document);
      } catch (error) {
        throw new Error(`trial=${trial}\nHTML: ${JSON.stringify(html)}\n\n${(error as Error).message}`);
      }
    }
  });

  test('round-trips comments, doctype, CDATA-like, and script/style content', () => {
    const samples = [
      '<!DOCTYPE html><html><body><p>hi</p></body></html>',
      '<div><!-- a comment --><span>x</span></div>',
      '<div><script>var a = "<b>not a tag</b>"; if (a < 3) {}</script></div>',
      '<div><style>.a > .b { color: red; content: "<x>"; }</style></div>',
      '<div><!-- multi\nline\ncomment --></div>',
      '<section><!--[if mso]><table><![endif]--></section>',
      '<div data-json=\'{"k": "v"}\'>x</div>',
      '<p>text &amp; more &lt;entities&gt; here</p>',
    ];
    for (const html of samples) {
      const document = parseDocument(html, options);
      expect(nodeToString(document), `round-trip ${JSON.stringify(html)}`).toBe(html);
      assertPositions(html, document);
    }
  });
});
