import { describe, expect, test } from 'vitest';

import { HtmlMod } from './index';

describe('expandSelfClosing', () => {
  test('expands self-closing custom element', () => {
    const h = new HtmlMod('<x-image src="test.png" />');
    const element = h.querySelector('x-image')!;
    expect(element.isSelfClosing).toBe(true);
    element.expandSelfClosing();
    expect(h.toString()).toBe('<x-image src="test.png"></x-image>');
  });

  test('expands self-closing div', () => {
    const h = new HtmlMod('<div class="empty" />');
    h.querySelector('div')!.expandSelfClosing();
    expect(h.toString()).toBe('<div class="empty"></div>');
  });

  test('no-op on element with close tag', () => {
    const h = new HtmlMod('<x-paragraph>Hello</x-paragraph>');
    const element = h.querySelector('x-paragraph')!;
    expect(element.isSelfClosing).toBe(false);
    element.expandSelfClosing();
    expect(h.toString()).toBe('<x-paragraph>Hello</x-paragraph>');
  });

  test('preserves attributes', () => {
    const h = new HtmlMod('<x-image src="photo.jpg" alt="Photo" width="200" />');
    h.querySelector('x-image')!.expandSelfClosing();
    expect(h.toString()).toBe('<x-image src="photo.jpg" alt="Photo" width="200"></x-image>');
  });

  test('works with no space before />', () => {
    const h = new HtmlMod('<x-spacer/>');
    h.querySelector('x-spacer')!.expandSelfClosing();
    expect(h.toString()).toBe('<x-spacer></x-spacer>');
  });

  test('preserves siblings after expansion', () => {
    const h = new HtmlMod('<section><x-image src="a" /><p>Hello</p></section>');
    h.querySelector('x-image')!.expandSelfClosing();
    const result = h.toString();
    expect(result).toContain('<x-image src="a"></x-image>');
    expect(result).toContain('<p>Hello</p>');
  });

  test('expanding multiple self-closing elements (reverse order)', () => {
    const h = new HtmlMod('<div><x-image /><x-spacer /><p>Text</p></div>');
    // Expand in reverse order so position shifts don't affect earlier elements
    const elements = h.querySelectorAll('*');
    for (let index = elements.length - 1; index >= 0; index--) {
      if (elements[index].isSelfClosing) {
        elements[index].expandSelfClosing();
      }
    }
    const result = h.toString();
    expect(result).toContain('<x-image></x-image>');
    expect(result).toContain('<x-spacer></x-spacer>');
    expect(result).toContain('<p>Text</p>');
  });

  test('isSelfClosing returns true for void-like elements', () => {
    const h = new HtmlMod('<br /><img src="x" /><hr/>');
    expect(h.querySelector('br')!.isSelfClosing).toBe(true);
    expect(h.querySelector('img')!.isSelfClosing).toBe(true);
    expect(h.querySelector('hr')!.isSelfClosing).toBe(true);
  });

  test('isSelfClosing returns false for elements with close tags', () => {
    const h = new HtmlMod('<div></div><span>text</span>');
    expect(h.querySelector('div')!.isSelfClosing).toBe(false);
    expect(h.querySelector('span')!.isSelfClosing).toBe(false);
  });

  test('isSelfClosing returns false after expandSelfClosing', () => {
    const h = new HtmlMod('<x-image src="test.png" />');
    const element = h.querySelector('x-image')!;
    expect(element.isSelfClosing).toBe(true);
    element.expandSelfClosing();
    expect(element.isSelfClosing).toBe(false);
  });
});
