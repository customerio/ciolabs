/**
 * Property-based drift/corruption invariants.
 *
 * These tests assert the two guarantees the incremental engine must never break,
 * over long randomized (but deterministic) operation sequences:
 *
 *   1. Position self-consistency — every tracked AST position still points at the
 *      bytes it claims in the source string (open tags, close tags, attribute
 *      names/values, and text node data).
 *   2. Child non-overlap — sibling nodes never claim overlapping byte ranges
 *      (the "an element ate its sibling" corruption class).
 *
 * The RNG is seeded so failures are reproducible. Inputs are well-formed so the
 * underlying parser produces clean positions; any inconsistency found here is a
 * genuine html-mod operation bug, not an HTML5 tree-construction artifact.
 */
/* eslint-disable unicorn/prefer-dom-node-dataset, unicorn/consistent-function-scoping */
import { describe, expect, test } from 'vitest';

import { getOuterEnd } from './element-utils';

import { HtmlMod } from './index';

// Seeded, reproducible RNG factory (linear congruential).
function makeRand(seed: number): () => number {
  let rng = seed;
  return () => {
    rng = (rng * 1_103_515_245 + 12_345) & 0x7f_ff_ff_ff;
    return rng / 0x7f_ff_ff_ff;
  };
}

function outerSpan(node: any): [number, number] {
  if (node.type === 'tag') return [node.source.openTag.startIndex, getOuterEnd(node)];
  return [node.startIndex, (node.endIndex ?? node.startIndex) + 1];
}

function assertConsistent(html: HtmlMod, label: string): void {
  const source = html.__source;
  const fail = (m: string) => {
    throw new Error(`${label}: ${m}\nSOURCE: ${JSON.stringify(source)}`);
  };

  const visit = (node: any) => {
    if (node.type === 'tag') {
      const openTag = node.source?.openTag;
      if (openTag) {
        const open = source.slice(openTag.startIndex, openTag.endIndex + 1);
        if (!open.startsWith('<') || !open.endsWith('>')) fail(`openTag <${node.tagName}> = ${JSON.stringify(open)}`);
        const name = source.slice(openTag.startIndex + 1, openTag.startIndex + 1 + node.tagName.length).toLowerCase();
        if (name !== String(node.tagName).toLowerCase())
          fail(`openTag name <${node.tagName}> source=${JSON.stringify(name)}`);
      }
      const closeTag = node.source?.closeTag;
      if (closeTag) {
        const close = source.slice(closeTag.startIndex, closeTag.endIndex);
        const expected = `</${closeTag.name ?? node.tagName}>`;
        if (close !== expected)
          fail(`closeTag <${node.tagName}> = ${JSON.stringify(close)} expected ${JSON.stringify(expected)}`);
        if (typeof node.endIndex === 'number' && node.endIndex !== closeTag.endIndex - 1) {
          fail(
            `element.endIndex(${node.endIndex}) != closeTag.endIndex-1(${closeTag.endIndex - 1}) for <${node.tagName}>`
          );
        }
      }
      for (const attribute of node.source?.attributes ?? []) {
        const nameSlice = source.slice(attribute.name.startIndex, attribute.name.endIndex + 1);
        if (nameSlice !== attribute.name.data)
          fail(
            `attr name <${node.tagName}> got ${JSON.stringify(nameSlice)} expected ${JSON.stringify(attribute.name.data)}`
          );
        if (attribute.value && attribute.value.startIndex <= attribute.value.endIndex) {
          const valueSlice = source.slice(attribute.value.startIndex, attribute.value.endIndex + 1);
          if (valueSlice !== attribute.value.data)
            fail(
              `attr value <${node.tagName}> ${attribute.name.data} got ${JSON.stringify(valueSlice)} expected ${JSON.stringify(attribute.value.data)}`
            );
        }
      }
    } else if (node.type === 'text' && typeof node.startIndex === 'number' && typeof node.endIndex === 'number') {
      const slice = source.slice(node.startIndex, node.endIndex + 1);
      if (slice !== node.data) fail(`text node got ${JSON.stringify(slice)} expected ${JSON.stringify(node.data)}`);
    }

    // Siblings must be ordered and non-overlapping.
    let previousEnd = -1;
    let previousDesc = 'start';
    for (const child of (node.children ?? []).filter((c: any) => typeof c.startIndex === 'number')) {
      const [start, end] = outerSpan(child);
      if (start < previousEnd)
        fail(
          `child overlap in <${node.tagName ?? 'root'}>: ${child.type}<${child.tagName ?? ''}> starts ${start} but ${previousDesc} ended ${previousEnd}`
        );
      previousEnd = end;
      previousDesc = `${child.type}<${child.tagName ?? ''}>`;
    }

    for (const child of node.children ?? []) visit(child);
  };

  for (const child of html.__dom.children) visit(child);
}

// Well-formed seeds spanning the structural categories the engine handles.
const SEEDS = [
  '<div id="a"><p class="x">hi</p><span>yo</span></div>',
  '<ul><li>one<li>two<li>three</ul>', // implicitly-closed siblings
  '<table><tbody><tr><td>a</td><td>b</td></tr></tbody></table>',
  '<div><x-image src="a" /><p>after</p></div>', // custom self-closing
  '<div><img src="a"><b>b</b> text</div>', // void element
  '<div>a<span>b</span>c<span>d</span>e</div>', // mixed text + elements
  '<p>text with <a href="http://x.com">link</a> end</p>',
  '<section><!-- note --><b>bold</b><br>x</section>', // comment + void
];

describe('drift/corruption property invariants', () => {
  test('positions stay consistent and siblings never overlap across random op sequences', () => {
    for (const [s, SEED] of SEEDS.entries()) {
      for (let trial = 0; trial < 400; trial++) {
        const rand = makeRand((s + 1) * 7919 + trial * 104_729 + 1);
        const html = new HtmlMod(SEED);
        const ops: string[] = [];
        try {
          for (let index = 0; index < 30; index++) {
            const all = html.querySelectorAll('*');
            if (all.length === 0) break;
            const element = all[Math.floor(rand() * all.length)];
            const tag = element.tagName;
            switch (Math.floor(rand() * 12)) {
              case 0: {
                ops.push(`#${tag} setAttribute(data-i)`);
                element.setAttribute('data-i', String(index));
                break;
              }
              case 1: {
                ops.push(`#${tag} setAttribute(class)`);
                element.setAttribute('class', `c${index}`);
                break;
              }
              case 2: {
                ops.push(`#${tag} setAttribute(title)`);
                element.setAttribute('title', `a "b" ${index}`);
                break;
              }
              case 3: {
                ops.push(`#${tag} removeAttribute(class)`);
                element.removeAttribute('class');
                break;
              }
              case 4: {
                ops.push(`#${tag} append`);
                element.append(`<em>${index}</em>`);
                break;
              }
              case 5: {
                ops.push(`#${tag} prepend`);
                element.prepend(`<i>${index}</i>`);
                break;
              }
              case 6: {
                ops.push(`#${tag} before`);
                if (element.parent) element.before('<u>z</u>');
                break;
              }
              case 7: {
                ops.push(`#${tag} after`);
                if (element.parent) element.after('<s>x</s>');
                break;
              }
              case 8: {
                ops.push(`#${tag} innerHTML`);
                element.innerHTML = `<q>${index}</q>`;
                break;
              }
              case 9: {
                ops.push(`#${tag} replaceWith`);
                if (element.parent) element.replaceWith(`<mark>${index}</mark>`);
                break;
              }
              case 10: {
                ops.push(`#${tag} expandSelfClosing`);
                element.expandSelfClosing();
                break;
              }
              case 11: {
                ops.push(`#${tag} remove`);
                if (element.parent) element.remove();
                break;
              }
            }
            assertConsistent(html, `seed${s} trial${trial} op#${index} [${ops.at(-1)}]`);
          }
        } catch (error) {
          throw new Error(`seed=${s} trial=${trial}\nops:\n${ops.join('\n')}\n\n${(error as Error).message}`);
        }
      }
    }
  });

  test('each mutation immediately round-trips through the live getters', () => {
    for (const [s, SEED] of SEEDS.entries()) {
      for (let trial = 0; trial < 400; trial++) {
        const rand = makeRand((s + 1) * 31_337 + trial * 49_999 + 1);
        const html = new HtmlMod(SEED);
        const ops: string[] = [];
        const check = (cond: boolean, message: string) => {
          if (!cond) throw new Error(`${message}\nSOURCE: ${JSON.stringify(html.__source)}`);
        };
        try {
          for (let index = 0; index < 25; index++) {
            const all = html.querySelectorAll('*');
            if (all.length === 0) break;
            const element = all[Math.floor(rand() * all.length)];
            const tag = element.tagName;
            switch (Math.floor(rand() * 9)) {
              case 0: {
                ops.push(`#${tag} setAttribute(data-i)`);
                element.setAttribute('data-i', String(index));
                check(
                  element.getAttribute('data-i') === String(index),
                  `getAttribute(data-i)=${element.getAttribute('data-i')}`
                );
                break;
              }
              case 1: {
                ops.push(`#${tag} setAttribute(title)`);
                element.setAttribute('title', `a "b" ${index}`);
                check(
                  element.getAttribute('title') === `a "b" ${index}`,
                  `getAttribute(title)=${JSON.stringify(element.getAttribute('title'))}`
                );
                break;
              }
              case 2: {
                ops.push(`#${tag} removeAttribute(class)`);
                element.removeAttribute('class');
                check(!element.hasAttribute('class'), `class still present`);
                break;
              }
              case 3: {
                ops.push(`#${tag} append`);
                element.append(`<em>${index}</em>`);
                check(
                  element.innerHTML.endsWith(`<em>${index}</em>`),
                  `append innerHTML=${JSON.stringify(element.innerHTML)}`
                );
                break;
              }
              case 4: {
                ops.push(`#${tag} prepend`);
                element.prepend(`<i>${index}</i>`);
                check(
                  element.innerHTML.startsWith(`<i>${index}</i>`),
                  `prepend innerHTML=${JSON.stringify(element.innerHTML)}`
                );
                break;
              }
              case 5: {
                ops.push(`#${tag} innerHTML`);
                element.innerHTML = `<q>${index}</q>`;
                check(
                  element.innerHTML === `<q>${index}</q>`,
                  `innerHTML roundtrip=${JSON.stringify(element.innerHTML)}`
                );
                break;
              }
              case 6: {
                ops.push(`#${tag} textContent`);
                element.textContent = `t${index}`;
                check(
                  element.textContent === `t${index}`,
                  `textContent roundtrip=${JSON.stringify(element.textContent)}`
                );
                break;
              }
              case 7: {
                if (element.parent) {
                  ops.push(`#${tag} before (outerHTML stable)`);
                  const outer = element.outerHTML;
                  element.before('<u>z</u>');
                  check(
                    element.outerHTML === outer,
                    `before changed outerHTML ${JSON.stringify(element.outerHTML)} vs ${JSON.stringify(outer)}`
                  );
                }
                break;
              }
              case 8: {
                if (element.parent) {
                  ops.push(`#${tag} after (outerHTML stable)`);
                  const outer = element.outerHTML;
                  element.after('<s>x</s>');
                  check(
                    element.outerHTML === outer,
                    `after changed outerHTML ${JSON.stringify(element.outerHTML)} vs ${JSON.stringify(outer)}`
                  );
                }
                break;
              }
            }
          }
        } catch (error) {
          throw new Error(`seed=${s} trial=${trial}\nops:\n${ops.join('\n')}\n\n${(error as Error).message}`);
        }
      }
    }

    expect(true).toBe(true);
  });
});
