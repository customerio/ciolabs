/**
 * Regression tests: trim()/trimStart()/trimEnd()/trimLines() must keep the AST
 * in sync with the trimmed source string. Previously the trimmed boundary
 * whitespace was removed from the string but the corresponding text nodes were
 * left in the AST with stale data and positions (phantom nodes overlapping
 * elements, or text data still containing the trimmed whitespace).
 *
 * toString() reads __source directly so it always looked right; the corruption
 * surfaced through any AST-backed read (children, textContent) or a follow-up
 * mutation.
 */
import { describe, expect, test } from 'vitest';

import { HtmlMod } from './index';

// Every root-level text node's data must equal the source slice at its tracked
// position, and children must be ordered/non-overlapping.
function assertInSync(h: HtmlMod) {
  const source = (h as unknown as { __source: string }).__source;
  const dom = (h as unknown as { __dom: { children: any[] } }).__dom;
  let previousEnd = -1;
  for (const node of dom.children) {
    if (node.startIndex != null && node.endIndex != null) {
      expect(node.startIndex).toBeGreaterThan(previousEnd);
      previousEnd = node.endIndex;
      if (node.type === 'text') {
        expect(source.slice(node.startIndex, node.endIndex + 1)).toBe(node.data);
      }
      if (node.type === 'tag') {
        expect(source[node.source.openTag.startIndex]).toBe('<');
      }
    }
  }
}

describe('trim AST sync', () => {
  test('trim removes leading and trailing whitespace text nodes from AST', () => {
    const h = new HtmlMod('\n\n<div>x</div>\n\n');
    h.trim();
    expect(h.toString()).toBe('<div>x</div>');
    const children = (h as any).__dom.children;
    expect(children.filter((c: any) => c.type === 'text')).toHaveLength(0);
    expect(children.filter((c: any) => c.type === 'tag')).toHaveLength(1);
    assertInSync(h);
  });

  test('trimStart trims a straddling boundary text node data', () => {
    const h = new HtmlMod('  abc<div>x</div>');
    h.trimStart();
    expect(h.toString()).toBe('abc<div>x</div>');
    const first = (h as any).__dom.children[0];
    expect(first.type).toBe('text');
    expect(first.data).toBe('abc');
    assertInSync(h);
  });

  test('trimEnd trims a straddling trailing text node data', () => {
    const h = new HtmlMod('<div>x</div>abc  ');
    h.trimEnd();
    expect(h.toString()).toBe('<div>x</div>abc');
    const last = (h as any).__dom.children.at(-1);
    expect(last.type).toBe('text');
    expect(last.data).toBe('abc');
    assertInSync(h);
  });

  test('trim then before() keeps positions correct', () => {
    const h = new HtmlMod('   <div>x</div>   ');
    h.trim();
    h.querySelector('div')!.before('<a>Y</a>');
    expect(h.toString()).toBe('<a>Y</a><div>x</div>');
    assertInSync(h);
  });

  test('trim then setAttribute on element does not corrupt', () => {
    const h = new HtmlMod('\n  <div>x</div>\n  ');
    h.trim();
    h.querySelector('div')!.setAttribute('id', 'z');
    expect(h.toString()).toBe('<div id="z">x</div>');
    assertInSync(h);
  });

  test('trimLines removes blank lines and keeps AST in sync', () => {
    const h = new HtmlMod('\n\n<div>x</div>\n\n');
    h.trimLines();
    expect(h.toString()).toBe('<div>x</div>');
    expect((h as any).__dom.children.filter((c: any) => c.type === 'text')).toHaveLength(0);
    assertInSync(h);
  });

  test('trimLines then mutation does not corrupt (both ends trimmed)', () => {
    const h = new HtmlMod('\n\n  <section><p>hi</p></section>  \n\n');
    h.trimLines();
    h.querySelector('p')!.setAttribute('class', 'c');
    assertInSync(h);
    expect(h.querySelector('p')!.outerHTML).toBe('<p class="c">hi</p>');
  });

  test('parent textContent reflects trimmed content, not stale whitespace', () => {
    const h = new HtmlMod('  abc<b>x</b>  ');
    h.trim();
    // Root-level text node should now read "abc", not "  abc"
    const textNode = (h as any).__dom.children.find((c: any) => c.type === 'text');
    expect(textNode.data).toBe('abc');
    assertInSync(h);
  });

  test('whole-document whitespace trims to empty without phantom nodes', () => {
    const h = new HtmlMod('   \n  ');
    h.trim();
    expect(h.toString()).toBe('');
    expect((h as any).__dom.children.filter((c: any) => c.type === 'text' && c.data.length > 0)).toHaveLength(0);
  });
});
