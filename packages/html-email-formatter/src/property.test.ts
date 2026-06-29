/**
 * Property-based invariants for the email formatter.
 *
 * Over randomized (seeded, reproducible) valid email HTML, formatting must:
 *
 *   1. Be idempotent — format(format(x)) === format(x). A formatter must reach a
 *      fixed point; non-idempotence means whitespace/conditional-comment drift.
 *   2. Preserve visible text — the formatter only re-indents, it must never drop,
 *      duplicate, or truncate content (tags stripped + whitespace collapsed).
 *   3. Preserve conditional comments — every `[if ...]` / `[endif]` survives.
 *   4. Never leak its internal marker — the Math.random()-keyed opener/closer
 *      used to expose MSO comment bodies to the formatter must be fully removed.
 *
 * Inputs use a block/inline content model and only non-nested downlevel-hidden
 * conditional comments (HTML comments cannot nest), matching real email HTML.
 */
import { describe, expect, test } from 'vitest';

import emailFormatter from './index';

function makeRand(seed: number): () => number {
  let rng = seed;
  return () => {
    rng = (rng * 1_103_515_245 + 12_345) & 0x7f_ff_ff_ff;
    return rng / 0x7f_ff_ff_ff;
  };
}

const BLOCK = ['div', 'section'];
const INLINE = ['span', 'b', 'i', 'a'];
const WORDS = ['hello', 'world', 'lorem', 'ipsum', 'x', 'foo bar'];

// Plain (conditional-comment-free) subtree respecting a block/inline content
// model: inline elements contain only inline/text, blocks contain either.
function genPlain(rand: () => number, depth: number, inlineOnly = false): string {
  if (depth <= 0 || rand() < 0.35) return WORDS[Math.floor(rand() * WORDS.length)];
  const useInline = inlineOnly || rand() < 0.5;
  const pool = useInline ? INLINE : BLOCK;
  const tag = pool[Math.floor(rand() * pool.length)];
  let inner = '';
  const count = Math.floor(rand() * 3);
  for (let index = 0; index < count; index++) inner += genPlain(rand, depth - 1, useInline);
  return `<${tag}>${inner}</${tag}>`;
}

// A node: a plain subtree, optionally wrapped in ONE downlevel-hidden
// conditional comment. Comments never nest, matching valid email HTML.
function gen(rand: () => number, depth: number): string {
  const node = genPlain(rand, depth);
  return rand() < 0.3 ? `<!--[if mso]>${node}<![endif]-->` : node;
}

const visibleText = (s: string) =>
  s
    .replaceAll(/<[^>]*>/g, ' ')
    .replaceAll(/\s+/g, ' ')
    .trim();

const conditionalCount = (s: string) => (s.match(/\[if\b/gi) ?? []).length + (s.match(/\[endif]/gi) ?? []).length;

// The internal marker is `<!--<number>` / `<number>-->` where number is Math.random().
const hasMarkerLeak = (s: string) => /<!--0?\.\d+|\b\d*\.\d+-->/.test(s);

describe('email formatter property invariants', () => {
  test('idempotent, content-preserving, and marker-free over random valid email HTML', () => {
    for (let trial = 0; trial < 2000; trial++) {
      const rand = makeRand(trial * 2_654_435_761 + 1);
      let html = '';
      const roots = 1 + Math.floor(rand() * 3);
      for (let index = 0; index < roots; index++) html += gen(rand, 4);
      if (!html) continue;

      const once = emailFormatter(html);
      const twice = emailFormatter(once);

      try {
        expect(twice, 'idempotent').toBe(once);
        expect(visibleText(once), 'visible text preserved').toBe(visibleText(html));
        expect(conditionalCount(once), 'conditional comments preserved').toBe(conditionalCount(html));
        expect(hasMarkerLeak(once), 'no internal marker leak').toBe(false);
      } catch (error) {
        throw new Error(
          `trial=${trial}\nINPUT : ${JSON.stringify(html)}\nONCE  : ${JSON.stringify(once)}\nTWICE : ${JSON.stringify(twice)}\n\n${(error as Error).message}`
        );
      }
    }
  });

  test('idempotent and content-preserving on representative hand-written email HTML', () => {
    const samples = [
      `<div><!--[if mso]>hello<![endif]--></div>`,
      `<!DOCTYPE html><html><body><!--[if mso]><table><tr><td>x</td></tr></table><![endif]--><p>hi</p></body></html>`,
      `<div class="a"><p>one</p><p>two</p><!--[if mso]><div>mso</div><![endif]--><span>end</span></div>`,
      `<table><tr><td><!--[if mso]><img src="x"><![endif]-->text</td></tr></table>`,
      `<div>  spaced   <!--[if mso]>   inner   <![endif]-->   text  </div>`,
      `<div><!-- normal comment --><p>x</p><!--[if mso]>mso<![endif]--></div>`,
      `<div><!--[if gte mso 9]><xml><o:OfficeDocumentSettings></o:OfficeDocumentSettings></xml><![endif]--></div>`,
    ];
    for (const html of samples) {
      const once = emailFormatter(html);
      const twice = emailFormatter(once);
      expect(twice, `idempotent: ${JSON.stringify(html)}`).toBe(once);
      expect(visibleText(once), `visible text: ${JSON.stringify(html)}`).toBe(visibleText(html));
      expect(conditionalCount(once), `conditionals: ${JSON.stringify(html)}`).toBe(conditionalCount(html));
      expect(hasMarkerLeak(once), `marker leak: ${JSON.stringify(html)}`).toBe(false);
    }
  });
});
