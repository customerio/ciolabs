/**
 * Regression tests for content-boundary corruption on elements with no close
 * tag that are followed by siblings — i.e. implicitly-closed elements such as
 * <td>, <li>, <tr>, <option>, <p>. The parser gives such an element an
 * endIndex that overshoots into the following sibling, so innerHTML/append/
 * textContent (which used endIndex as the content end) read or overwrite into
 * the next element, destroying it.
 *
 * This is common in real email HTML (tables full of implicitly-closed cells).
 */
import { describe, expect, test } from 'vitest';

import { HtmlMod } from './index';

describe('implicit-close content boundaries', () => {
  test('innerHTML on first implicit <td> does not eat the next cell', () => {
    const h = new HtmlMod('<table><tr><td>1<td>2</tr></table>');
    h.querySelectorAll('td')[0].innerHTML = 'X';
    expect(h.toString()).toBe('<table><tr><td>X<td>2</tr></table>');
  });

  test('innerHTML getter on first implicit <td> returns only its own content', () => {
    const h = new HtmlMod('<table><tr><td>1<td>2</tr></table>');
    expect(h.querySelectorAll('td')[0].innerHTML).toBe('1');
  });

  test('append on first implicit <td> inserts into that cell', () => {
    const h = new HtmlMod('<table><tr><td>1<td>2</tr></table>');
    h.querySelectorAll('td')[0].append('<b>!</b>');
    expect(h.toString()).toBe('<table><tr><td>1<b>!</b><td>2</tr></table>');
  });

  test('textContent on first implicit <td> does not eat the next cell', () => {
    const h = new HtmlMod('<table><tr><td>1<td>2</tr></table>');
    h.querySelectorAll('td')[0].textContent = 'Z';
    expect(h.toString()).toBe('<table><tr><td>Z<td>2</tr></table>');
  });

  test('innerHTML on first implicit <li> does not eat the next item', () => {
    const h = new HtmlMod('<ul><li>a<li>b<li>c</ul>');
    h.querySelectorAll('li')[0].innerHTML = 'X';
    expect(h.toString()).toBe('<ul><li>X<li>b<li>c</ul>');
  });

  test('append on a middle implicit <li> inserts into that item', () => {
    const h = new HtmlMod('<ul><li>a<li>b<li>c</ul>');
    h.querySelectorAll('li')[1].append('!');
    expect(h.toString()).toBe('<ul><li>a<li>b!<li>c</ul>');
  });

  test('last implicit <td> content boundary is still correct', () => {
    const h = new HtmlMod('<table><tr><td>1<td>2</tr></table>');
    h.querySelectorAll('td')[1].innerHTML = 'Y';
    expect(h.toString()).toBe('<table><tr><td>1<td>Y</tr></table>');
  });

  test('innerHTML getter on implicit <td> with nested element', () => {
    const h = new HtmlMod('<table><tr><td>a<b>x</b><td>2</tr></table>');
    expect(h.querySelectorAll('td')[0].innerHTML).toBe('a<b>x</b>');
    h.querySelectorAll('td')[0].append('<i>!</i>');
    expect(h.toString()).toBe('<table><tr><td>a<b>x</b><i>!</i><td>2</tr></table>');
  });

  test('outerHTML of implicit <td> excludes the next cell', () => {
    const h = new HtmlMod('<table><tr><td>1<td>2</tr></table>');
    expect(h.querySelectorAll('td')[0].outerHTML).toBe('<td>1');
  });

  test('after() on implicit <td> inserts right after that cell', () => {
    const h = new HtmlMod('<table><tr><td>1<td>2</tr></table>');
    h.querySelectorAll('td')[0].after('<x>!</x>');
    expect(h.toString()).toBe('<table><tr><td>1<x>!</x><td>2</tr></table>');
  });

  test('remove() on implicit <td> removes only that cell', () => {
    const h = new HtmlMod('<table><tr><td>1<td>2</tr></table>');
    h.querySelectorAll('td')[0].remove();
    expect(h.toString()).toBe('<table><tr><td>2</tr></table>');
  });

  test('replaceWith() on implicit <td> replaces only that cell', () => {
    const h = new HtmlMod('<table><tr><td>1<td>2</tr></table>');
    h.querySelectorAll('td')[0].replaceWith('<td>NEW</td>');
    expect(h.toString()).toBe('<table><tr><td>NEW</td><td>2</tr></table>');
  });

  test('remove() on implicit <li> removes only that item', () => {
    const h = new HtmlMod('<ul><li>a<li>b</ul>');
    h.querySelectorAll('li')[0].remove();
    expect(h.toString()).toBe('<ul><li>b</ul>');
  });

  test('unclosed element at EOF still works (no regression)', () => {
    const h = new HtmlMod('<div><p>hi');
    h.querySelector('p')!.innerHTML = 'Y';
    expect(h.toString()).toBe('<div><p>Y');
    expect(h.querySelector('p')!.innerHTML).toBe('Y');
  });
});
