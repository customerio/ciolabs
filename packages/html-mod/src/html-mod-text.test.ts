/**
 * Regression tests for HtmlModText setters.
 *
 * A text node positioned at the very start of the document has endIndex === 0.
 * The old `if (!this.__text.endIndex) return;` guard treated that valid index
 * as falsy and silently dropped the write — data loss.
 */
import type { SourceText } from '@ciolabs/htmlparser2-source';
import { describe, expect, test } from 'vitest';

import { HtmlMod, HtmlModText } from './index';

function rootText(h: HtmlMod): HtmlModText {
  const node = (h as unknown as { __dom: { children: any[] } }).__dom.children.find((c: any) => c.type === 'text');
  return new HtmlModText(node as SourceText, h);
}

describe('HtmlModText setters', () => {
  test('textContent on a single-char text node at index 0 is not dropped', () => {
    const h = new HtmlMod('a<div>x</div>');
    rootText(h).textContent = 'CHANGED';
    expect(h.toString()).toBe('CHANGED<div>x</div>');
  });

  test('innerHTML on a single-char text node at index 0 is not dropped', () => {
    const h = new HtmlMod('a<div>x</div>');
    rootText(h).innerHTML = '<b>hi</b>';
    expect(h.toString()).toBe('<b>hi</b><div>x</div>');
  });

  test('setting text at index 0 keeps following siblings in sync', () => {
    const h = new HtmlMod('a<b id="x">y</b>');
    rootText(h).textContent = 'LONGER';
    h.querySelector('b')!.dataset.z = '1';
    expect(h.toString()).toBe('LONGER<b id="x" data-z="1">y</b>');
  });

  test('multi-char leading text node still works (no regression)', () => {
    const h = new HtmlMod('hello<div>x</div>');
    rootText(h).textContent = 'hi';
    h.querySelector('div')!.setAttribute('k', 'v');
    expect(h.toString()).toBe('hi<div k="v">x</div>');
  });
});
