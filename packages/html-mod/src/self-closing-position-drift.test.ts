/**
 * Regression tests for position drift / data corruption when prepend/append
 * is used on self-closing elements written with a trailing slash (e.g.
 * `<img src="y"/>`).
 *
 * The overwrite that replaces `/>` with `>` shifts the `>` left by one
 * character. If the AST positions for the newly inserted children (and the
 * synthesized close tag) are computed from the original `>` position instead
 * of the shifted one, every position is off-by-one and the next mutation
 * corrupts the string.
 */
import { describe, expect, test } from 'vitest';

import { HtmlMod } from './index';

describe('self-closing trailing-slash position drift', () => {
  test('append then setAttribute on the new child does not corrupt', () => {
    const h = new HtmlMod('<section><img src="y"/></section>');
    h.querySelector('img')!.append('<b>hi</b>');
    expect(h.toString()).toBe('<section><img src="y"><b>hi</b></img></section>');

    const b = h.querySelector('b')!;
    // outerHTML is derived purely from tracked positions
    expect(b.outerHTML).toBe('<b>hi</b>');

    b.setAttribute('id', 'x');
    expect(h.toString()).toBe('<section><img src="y"><b id="x">hi</b></img></section>');
  });

  test('prepend then setAttribute on the new child does not corrupt', () => {
    const h = new HtmlMod('<section><img src="y"/></section>');
    h.querySelector('img')!.prepend('<b>hi</b>');
    expect(h.toString()).toBe('<section><img src="y"><b>hi</b></img></section>');

    const b = h.querySelector('b')!;
    expect(b.outerHTML).toBe('<b>hi</b>');

    b.setAttribute('id', 'x');
    expect(h.toString()).toBe('<section><img src="y"><b id="x">hi</b></img></section>');
  });

  test('append then remove the new child removes the right bytes', () => {
    const h = new HtmlMod('<section><img src="y"/></section>');
    h.querySelector('img')!.append('<b>hi</b>');
    h.querySelector('b')!.remove();
    expect(h.toString()).toBe('<section><img src="y"></img></section>');
  });

  test('synthesized close tag position is correct after append', () => {
    const h = new HtmlMod('<img src="y"/>');
    const img = h.querySelector('img')!;
    img.append('<b>hi</b>');
    // The close tag position is tracked; outerHTML uses closeTag.endIndex
    expect(img.outerHTML).toBe('<img src="y"><b>hi</b></img>');
  });

  test('expandSelfClosing (slash) then append does not corrupt', () => {
    const h = new HtmlMod('<wrap><x-card title="t"/></wrap>');
    h.querySelector('x-card')!.expandSelfClosing();
    expect(h.toString()).toBe('<wrap><x-card title="t"></x-card></wrap>');
    expect(h.querySelector('x-card')!.outerHTML).toBe('<x-card title="t"></x-card>');

    h.querySelector('x-card')!.append('<b>hi</b>');
    expect(h.toString()).toBe('<wrap><x-card title="t"><b>hi</b></x-card></wrap>');
  });

  test('expandSelfClosing (slash) then after does not corrupt', () => {
    const h = new HtmlMod('<wrap><x-card title="t"/></wrap>');
    h.querySelector('x-card')!.expandSelfClosing();
    h.querySelector('x-card')!.after('<z>S</z>');
    expect(h.toString()).toBe('<wrap><x-card title="t"></x-card><z>S</z></wrap>');
  });

  test('expandSelfClosing (void, no slash) then after does not corrupt', () => {
    const h = new HtmlMod('<div><br></div>');
    h.querySelector('br')!.expandSelfClosing();
    expect(h.toString()).toBe('<div><br></br></div>');
    h.querySelector('br')!.after('<z>S</z>');
    expect(h.toString()).toBe('<div><br></br><z>S</z></div>');
  });

  test('expandSelfClosing (slash + space) then after does not corrupt', () => {
    const h = new HtmlMod('<wrap><x-card title="t" /></wrap>');
    h.querySelector('x-card')!.expandSelfClosing();
    expect(h.toString()).toBe('<wrap><x-card title="t"></x-card></wrap>');
    h.querySelector('x-card')!.after('<z>S</z>');
    expect(h.toString()).toBe('<wrap><x-card title="t"></x-card><z>S</z></wrap>');
  });

  test('innerHTML on void tag without slash does not corrupt', () => {
    const h = new HtmlMod('<div><br></div>');
    h.querySelector('br')!.innerHTML = 'x';
    expect(h.toString()).toBe('<div><br>x</br></div>');
  });

  test('innerHTML (empty) on void tag without slash does not corrupt', () => {
    const h = new HtmlMod('<div><br></div>');
    h.querySelector('br')!.innerHTML = '';
    expect(h.toString()).toBe('<div><br></br></div>');
  });

  test('innerHTML on no-slash self-closing with attributes does not corrupt', () => {
    const h = new HtmlMod('<div><img src="a"></div>');
    h.querySelector('img')!.innerHTML = 'x';
    expect(h.toString()).toBe('<div><img src="a">x</img></div>');
  });

  test('textContent on slash tag then append keeps close tag tracked', () => {
    const h = new HtmlMod('<x-card title="t"/>');
    h.querySelector('x-card')!.textContent = 't40';
    h.querySelector('x-card')!.append('<b>a41</b>');
    expect(h.toString()).toBe('<x-card title="t">t40<b>a41</b></x-card>');
    // outerHTML is derived from tracked positions — must include the close tag
    expect(h.querySelector('x-card')!.outerHTML).toBe('<x-card title="t">t40<b>a41</b></x-card>');
  });

  test('innerHTML on slash tag then after() does not corrupt (endIndex tracked)', () => {
    const h = new HtmlMod('<wrap><x-card title="t"/></wrap>');
    h.querySelector('x-card')!.innerHTML = 'hi';
    h.querySelector('x-card')!.after('<z>S</z>');
    expect(h.toString()).toBe('<wrap><x-card title="t">hi</x-card><z>S</z></wrap>');
  });

  test('innerHTML on self-closing then after() does not corrupt', () => {
    const h = new HtmlMod('<wrap><img src="y"/></wrap>');
    h.querySelector('img')!.innerHTML = 'hi';
    expect(h.toString()).toBe('<wrap><img src="y">hi</img></wrap>');

    const img = h.querySelector('img')!;
    expect(img.outerHTML).toBe('<img src="y">hi</img>');

    img.after('<z>S</z>');
    expect(h.toString()).toBe('<wrap><img src="y">hi</img><z>S</z></wrap>');
  });

  test('innerHTML on self-closing (empty) then after() does not corrupt', () => {
    const h = new HtmlMod('<wrap><img src="y"/></wrap>');
    h.querySelector('img')!.innerHTML = '';
    expect(h.toString()).toBe('<wrap><img src="y"></img></wrap>');

    h.querySelector('img')!.after('<z>S</z>');
    expect(h.toString()).toBe('<wrap><img src="y"></img><z>S</z></wrap>');
  });

  test('append on trailing-slash with space then mutate child', () => {
    const h = new HtmlMod('<wrap><x-img src="y" /></wrap>');
    h.querySelector('x-img')!.append('<b>hi</b>');
    // The space before the slash is preserved (valid HTML); positions must
    // still be correct so the follow-up mutation lands in the right place.
    expect(h.toString()).toBe('<wrap><x-img src="y" ><b>hi</b></x-img></wrap>');
    h.querySelector('b')!.setAttribute('id', 'z');
    expect(h.toString()).toBe('<wrap><x-img src="y" ><b id="z">hi</b></x-img></wrap>');
  });
});
