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

  test('expands void element without trailing slash (caller responsibility to filter)', () => {
    // htmlparser2 marks <br> as self-closing even without `/`
    // expandSelfClosing will expand it — callers should check void elements
    const h = new HtmlMod('<br>');
    const element = h.querySelector('br')!;
    expect(element.isSelfClosing).toBe(true);
    element.expandSelfClosing();
    expect(h.toString()).toBe('<br></br>');
    expect(element.isSelfClosing).toBe(false);
  });

  test('isSelfClosing returns false after expandSelfClosing', () => {
    const h = new HtmlMod('<x-image src="test.png" />');
    const element = h.querySelector('x-image')!;
    expect(element.isSelfClosing).toBe(true);
    element.expandSelfClosing();
    expect(element.isSelfClosing).toBe(false);
  });

  describe('AST stays consistent after expansion (no follow-up corruption)', () => {
    test('outerHTML/toString are complete after expansion', () => {
      const h = new HtmlMod('<x-p>a <x-icon name="star"/> b</x-p>');
      const icon = h.querySelectorAll('x-icon')[0];
      icon.expandSelfClosing();
      expect(icon.outerHTML).toBe('<x-icon name="star"></x-icon>');
      expect(icon.toString()).toBe('<x-icon name="star"></x-icon>');
    });

    test('setAttribute after expansion does not corrupt the document', () => {
      const h = new HtmlMod('<x-p>a <x-icon name="star"/> b</x-p>');
      const icon = h.querySelectorAll('x-icon')[0];
      icon.expandSelfClosing();
      icon.dataset.source = 'ZZZ';
      expect(h.toString()).toBe('<x-p>a <x-icon name="star" data-source="ZZZ"></x-icon> b</x-p>');
    });

    test('innerHTML is empty after expansion', () => {
      const h = new HtmlMod('<x-icon name="star"/>');
      const icon = h.querySelector('x-icon')!;
      icon.expandSelfClosing();
      expect(icon.innerHTML).toBe('');
    });

    test('after() inserts at the right position after expansion', () => {
      const h = new HtmlMod('<wrap><x-icon/> tail</wrap>');
      h.querySelector('x-icon')!.expandSelfClosing();
      h.querySelector('x-icon')!.after('<b></b>');
      expect(h.toString()).toBe('<wrap><x-icon></x-icon><b></b> tail</wrap>');
    });

    test('before() inserts at the right position after expansion', () => {
      const h = new HtmlMod('<wrap><x-icon/> tail</wrap>');
      h.querySelector('x-icon')!.expandSelfClosing();
      h.querySelector('x-icon')!.before('<b></b>');
      expect(h.toString()).toBe('<wrap><b></b><x-icon></x-icon> tail</wrap>');
    });

    test('append() inserts inside the element after expansion', () => {
      const h = new HtmlMod('<wrap><x-icon/></wrap>');
      h.querySelector('x-icon')!.expandSelfClosing();
      h.querySelector('x-icon')!.append('<b>hi</b>');
      expect(h.toString()).toBe('<wrap><x-icon><b>hi</b></x-icon></wrap>');
    });

    test('mixed-case tag round-trips after expansion + setAttribute', () => {
      const h = new HtmlMod('<wrap><X-Image src="a"/></wrap>');
      h.querySelector('x-image')!.expandSelfClosing();
      // Open tag preserves source casing; close tag uses the parser tag name.
      expect(h.toString()).toBe('<wrap><X-Image src="a"></x-image></wrap>');
      h.querySelector('x-image')!.dataset.source = 'ZZZ';
      expect(h.toString()).toBe('<wrap><X-Image src="a" data-source="ZZZ"></x-image></wrap>');
    });

    test('spaced form round-trips after expansion + setAttribute', () => {
      const h = new HtmlMod('<wrap><x-spacer /></wrap>');
      h.querySelector('x-spacer')!.expandSelfClosing();
      expect(h.toString()).toBe('<wrap><x-spacer></x-spacer></wrap>');
      h.querySelector('x-spacer')!.dataset.source = 'ZZZ';
      expect(h.toString()).toBe('<wrap><x-spacer data-source="ZZZ"></x-spacer></wrap>');
    });
  });
});
