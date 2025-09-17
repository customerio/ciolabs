import { describe, expect, test } from 'vitest';

import { HtmlModElement as HtmlModuleElement, HtmlMod as HtmlModule } from './index';

describe('HtmlMod', () => {
  describe('constructor', () => {
    test('should create a HtmlMod instance', () => {
      const html = new HtmlModule('<div>invalid html');
      expect(html).toBeInstanceOf(HtmlModule);
    });

    test('should allow for custom HtmlModElement', () => {
      class CustomHtmlModuleElement extends HtmlModuleElement {}
      const html = new HtmlModule('<div>invalid html', {
        HtmlModElement: CustomHtmlModuleElement,
      });
      expect(html.__HtmlModElement).toBe(CustomHtmlModuleElement);
    });
  });

  describe('special characters in html should be left alone', () => {
    test('backslashes should be left alone', () => {
      const h = new HtmlModule('<div>\\</div>');
      expect(h.toString()).toBe('<div>\\</div>');

      const autofix = new HtmlModule('<div>\\</div>', { autofix: true });
      expect(autofix.toString()).toBe('<div>\\</div>');
    });

    test('backticks should be left alone', () => {
      const h = new HtmlModule('<div>`</div>');
      expect(h.toString()).toBe('<div>`</div>');

      const autofix = new HtmlModule('<div>`</div>', { autofix: true });
      expect(autofix.toString()).toBe('<div>`</div>');
    });

    test('html entities should be left alone', () => {
      const h = new HtmlModule('<div>&lt; and &lt;ul&gt;</div>');
      expect(h.toString()).toBe('<div>&lt; and &lt;ul&gt;</div>');

      const autofix = new HtmlModule('<div>&lt; and &lt;ul&gt;</div>', {
        autofix: true,
      });

      expect(autofix.toString()).toBe('<div>&lt; and &lt;ul&gt;</div>');
    });
  });

  describe('string edits', () => {
    test('should make no changes by default', () => {
      const html = new HtmlModule('<div>invalid html');
      expect(html.toString()).toBe('<div>invalid html');
    });

    test('should allow self-closing custom components with autofix', () => {
      const source = `<x-section>Before<x-image />after</x-section>`;
      const html = new HtmlModule(source);
      expect(html.toString()).toBe(source);
    });

    test('trim()', () => {
      const html = new HtmlModule('   <div>invalid html  ');
      expect(html.trim().toString()).toBe('<div>invalid html');
    });

    test("trim('a')", () => {
      const html = new HtmlModule('aaa<div>invalid htmlaaa');
      expect(html.trim('a').toString()).toBe('<div>invalid html');
    });

    test('trimStart()', () => {
      const html = new HtmlModule('   <div>invalid html  ');
      expect(html.trimStart().toString()).toBe('<div>invalid html  ');
    });

    test("trimStart('a')", () => {
      const html = new HtmlModule('aaa<div>invalid htmlaaa');
      expect(html.trimStart('a').toString()).toBe('<div>invalid htmlaaa');
    });

    test('trimEnd()', () => {
      const html = new HtmlModule('   <div>invalid html  ');
      expect(html.trimEnd().toString()).toBe('   <div>invalid html');
    });

    test("trimEnd('a')", () => {
      const html = new HtmlModule('aaa<div>invalid htmlaaa');
      expect(html.trimEnd('a').toString()).toBe('aaa<div>invalid html');
    });

    test('trimLines()', () => {
      const html = new HtmlModule('\n  <div>invalid html  \n');
      expect(html.trimLines().toString()).toBe('  <div>invalid html  ');
    });

    test('isEmpty()', () => {
      const html = new HtmlModule('   ');
      html.trim();
      expect(html.isEmpty()).toBe(true);
    });

    test('clone()', () => {
      const html = new HtmlModule('  <div>invalid html');
      const html2 = html.clone();
      expect(html2.toString()).toBe('  <div>invalid html');
    });
  });

  describe('generate source maps', () => {
    test('should generate a source map', () => {
      const html = new HtmlModule('  <div>invalid html');
      html.trim();
      const map = html.generateMap();

      expect(map).toHaveProperty('file');
      expect(map).toHaveProperty('mappings');
      expect(map).toHaveProperty('names');
      expect(map).toHaveProperty('sources');
      expect(map).toHaveProperty('sourcesContent');
      expect(map).toHaveProperty('version');
    });

    test('should generate a decoded source map', () => {
      const html = new HtmlModule('  <div>invalid html');
      html.trim();
      const map = html.generateDecodedMap();
      expect(map).toHaveProperty('file');
      expect(map).toHaveProperty('mappings');
      expect(map).toHaveProperty('names');
      expect(map).toHaveProperty('sources');
      expect(map).toHaveProperty('sourcesContent');
    });
  });

  describe('querySelector()', () => {
    test('should return null if no match', () => {
      const html = new HtmlModule('<div>invalid html');
      expect(html.querySelector('span')).toBe(null);
    });

    test('should return the first match', () => {
      const html = new HtmlModule('<div>invalid html');
      expect(html.querySelector('div')).toBeInstanceOf(HtmlModuleElement);
    });

    test('should respect the custom HtmlModElement', () => {
      class CustomHtmlModuleElement extends HtmlModuleElement {}
      const html = new HtmlModule('<div>invalid html', {
        HtmlModElement: CustomHtmlModuleElement,
      });
      expect(html.querySelector('div')).toBeInstanceOf(CustomHtmlModuleElement);
    });
  });

  describe('querySelectorAll()', () => {
    test('should return an empty array if no match', () => {
      const html = new HtmlModule('<div>invalid html');
      expect(html.querySelectorAll('span')).toEqual([]);
    });

    test('should return all matches', () => {
      const html = new HtmlModule('<div>invalid html<div>another');
      const results = html.querySelectorAll('div');
      expect(results).toBeInstanceOf(Array);
      expect(results.length).toBe(2);
      expect(results[0]).toBeInstanceOf(HtmlModuleElement);
      expect(results[1]).toBeInstanceOf(HtmlModuleElement);
    });
  });

  describe('flush status', () => {
    test('should be flushed by default', () => {
      const html = new HtmlModule('<div>invalid html');
      expect(html.isFlushed()).toBe(true);
    });

    test('trim()', () => {
      const html = new HtmlModule('   <div>invalid html  ');
      expect(html.trim().isFlushed()).toBe(false);
      html.flush();
      expect(html.isFlushed()).toBe(true);
    });

    test('trimStart()', () => {
      const html = new HtmlModule('   <div>invalid html  ');
      expect(html.trimStart().isFlushed()).toBe(false);
      html.flush();
      expect(html.isFlushed()).toBe(true);
    });

    test('trimEnd()', () => {
      const html = new HtmlModule('   <div>invalid html  ');
      expect(html.trimEnd().isFlushed()).toBe(false);
      html.flush();
      expect(html.isFlushed()).toBe(true);
    });

    test('trimLines()', () => {
      const html = new HtmlModule('\n  <div>invalid html  \n');
      expect(html.trimLines().isFlushed()).toBe(false);
      html.flush();
      expect(html.isFlushed()).toBe(true);
    });

    test('clone()', () => {
      const html = new HtmlModule('  <div>invalid html');
      html.trim();
      const html2 = html.clone();
      expect(html.isFlushed()).toBe(false);
      expect(html2.isFlushed()).toBe(true);
    });
  });
});

describe('HtmlModElement', () => {
  describe('sourceRange', () => {
    test('should return the correct line and column numbers', () => {
      const html = new HtmlModule('<div>\n  <span>test</span>\n</div>');
      const span = html.querySelector('span')!;
      const range = span.sourceRange;
      expect(range.startLineNumber).toBe(2);
      expect(range.startColumn).toBe(3);
      expect(range.endLineNumber).toBe(2);
      expect(range.endColumn).toBe(20);
    });

    test('should handle elements on the first line', () => {
      const html = new HtmlModule('<div><span>test</span></div>');
      const span = html.querySelector('span')!;
      const range = span.sourceRange;
      expect(range.startLineNumber).toBe(1);
      expect(range.startColumn).toBe(6);
      expect(range.endLineNumber).toBe(1);
      expect(range.endColumn).toBe(23);
    });

    test('should handle self-closing elements', () => {
      const html = new HtmlModule('<div><img/></div>');
      const img = html.querySelector('img')!;
      const range = img.sourceRange;
      expect(range.startLineNumber).toBe(1);
      expect(range.startColumn).toBe(6);
      expect(range.endLineNumber).toBe(1);
      expect(range.endColumn).toBe(12);
    });

    test('should handle multi-line elements', () => {
      const html = new HtmlModule('<div>\n  <span>\n    test\n  </span>\n</div>');
      const span = html.querySelector('span')!;
      const range = span.sourceRange;
      expect(range.startLineNumber).toBe(2);
      expect(range.startColumn).toBe(3);
      expect(range.endLineNumber).toBe(4);
      expect(range.endColumn).toBe(10);
    });
  });

  describe('tagName', () => {
    test('should exist', () => {
      const html = new HtmlModule('<div>invalid html');
      const element = html.querySelector('div')!;
      expect(element.tagName).toBe('div');
    });

    test('should be case insensitive', () => {
      const html = new HtmlModule('<DIV>invalid html');
      const element = html.querySelector('div')!;
      expect(element.tagName).toBe('div');
    });

    test('should be settable with invalid html', () => {
      const html = new HtmlModule('<div>invalid html');
      const element = html.querySelector('div')!;
      element.tagName = 'span';
      expect(html.toString()).toBe('<span>invalid html');
    });

    test('should be settable with valid html', () => {
      const html = new HtmlModule('<div>invalid html</div>');
      const element = html.querySelector('div')!;
      element.tagName = 'span';
      expect(html.toString()).toBe('<span>invalid html</span>');
    });
  });

  describe('id', () => {
    test('should exist', () => {
      const html = new HtmlModule("<div id='foo'>invalid html");
      const element = html.querySelector('div')!;
      expect(element.id).toBe('foo');
    });

    test('should be an empty string if not present', () => {
      const html = new HtmlModule('<div>invalid html');
      const element = html.querySelector('div')!;
      expect(element.id).toBe('');
    });
  });

  describe('classList', () => {
    test('should exist', () => {
      const html = new HtmlModule('<div class="foo">invalid html');
      const element = html.querySelector('div')!;
      expect(element.classList).toBeInstanceOf(Array);
      expect(element.classList).toEqual(['foo']);
    });

    test('should be an empty array if not present', () => {
      const html = new HtmlModule('<div>invalid html');
      const element = html.querySelector('div')!;
      expect(element.classList).toBeInstanceOf(Array);
      expect(element.classList).toEqual([]);
    });

    test('should be an empty array if empty', () => {
      const html = new HtmlModule('<div class="">invalid html');
      const element = html.querySelector('div')!;
      expect(element.classList).toBeInstanceOf(Array);
      expect(element.classList).toEqual([]);
    });

    test('should be an array of multiple classes', () => {
      const html = new HtmlModule('<div class="foo bar">invalid html');
      const element = html.querySelector('div')!;
      expect(element.classList).toBeInstanceOf(Array);
      expect(element.classList).toEqual(['foo', 'bar']);
    });

    test('should be an array of multiple classes with extra spaces', () => {
      const html = new HtmlModule('<div class=" foo  bar ">invalid html');
      const element = html.querySelector('div')!;
      expect(element.classList).toBeInstanceOf(Array);
      expect(element.classList).toEqual(['foo', 'bar']);
    });

    test('should be an array of multiple classes with extra spaces and newlines', () => {
      const html = new HtmlModule('<div class=" foo \n bar ">invalid html');

      const element = html.querySelector('div')!;
      expect(element.classList).toBeInstanceOf(Array);
      expect(element.classList).toEqual(['foo', 'bar']);
    });
  });

  describe('className', () => {
    test('should exist', () => {
      const html = new HtmlModule("<div class='foo'>invalid html");
      const element = html.querySelector('div')!;
      expect(element.className).toBe('foo');
    });

    test('should be a string even if has multiple classes', () => {
      const html = new HtmlModule("<div class='foo bar'>invalid html");
      const element = html.querySelector('div')!;
      expect(element.className).toBe('foo bar');
    });

    test('should be an empty string if not present', () => {
      const html = new HtmlModule('<div>invalid html');
      const element = html.querySelector('div')!;
      expect(element.className).toBe('');
    });
  });

  describe('attributes', () => {
    test('should be an array of objects with "name and "value" properties', () => {
      const html = new HtmlModule("<div foo='bar' baz='qux'>invalid html");
      const element = html.querySelector('div')!;
      expect(element.attributes).toEqual([
        { name: 'foo', value: 'bar' },
        { name: 'baz', value: 'qux' },
      ]);
    });

    test('should be an empty array if not present', () => {
      const html = new HtmlModule('<div>invalid html');
      const element = html.querySelector('div')!;
      expect(element.attributes).toEqual([]);
    });

    test('should support attributes without value', () => {
      const html = new HtmlModule('<img alt>');
      const element = html.querySelector('img')!;
      expect(element.attributes).toEqual([{ name: 'alt', value: undefined }]);
    });
  });

  describe('innerHTML', () => {
    test('should exist', () => {
      const html = new HtmlModule('<div>invalid html');
      const element = html.querySelector('div')!;
      expect(element.innerHTML).toBe('invalid html');
    });

    test('should exist for partially closed tags', () => {
      const html = new HtmlModule('<div>invalid html</div');
      const element = html.querySelector('div')!;
      expect(element.innerHTML).toBe('invalid html');
    });

    test('should be an empty string if not present', () => {
      const html = new HtmlModule('<div></div>');
      const element = html.querySelector('div')!;
      expect(element.innerHTML).toBe('');
    });

    test('should be an empty string for self-closing tags', () => {
      const html = new HtmlModule('<div/>');
      const element = html.querySelector('div')!;
      expect(element.innerHTML).toBe('');
    });

    test('should be an empty string for self-closing tags with attributes', () => {
      const html = new HtmlModule('<div class="foo"/>');
      const element = html.querySelector('div')!;
      expect(element.innerHTML).toBe('');
    });

    test('should be settable with invalid html', () => {
      const html = new HtmlModule('<div>invalid html');
      const element = html.querySelector('div')!;
      element.innerHTML = 'new html';
      expect(html.toString()).toBe('<div>new html');
    });

    test('should be settable with valid html', () => {
      const html = new HtmlModule('<div>valid html</div>');
      const element = html.querySelector('div')!;
      element.innerHTML = 'new html';
      expect(html.toString()).toBe('<div>new html</div>');
    });

    test('should be settable from empty string to "new html"', () => {
      const html = new HtmlModule('<div></div>');
      const element = html.querySelector('div')!;
      element.innerHTML = 'new html';
      expect(html.toString()).toBe('<div>new html</div>');
    });

    test('should be settable for partially closed tags', () => {
      const html = new HtmlModule('<div>invalid html</div');
      const element = html.querySelector('div')!;
      element.innerHTML = 'new html';
      expect(html.toString()).toBe('<div>new html</div');
    });
  });

  describe('textContent', () => {
    test('should exist', () => {
      const html = new HtmlModule('<div>invalid html');
      const element = html.querySelector('div')!;
      expect(element.textContent).toBe('invalid html');
    });

    test('should be empty string for self-closing tags', () => {
      const html = new HtmlModule('<div/>');
      const element = html.querySelector('div')!;
      expect(element.textContent).toBe('');
    });

    test('should ignore inner tags', () => {
      const html = new HtmlModule('<div>more html<span>invalid html</span>');
      const element = html.querySelector('div')!;
      expect(element.textContent).toBe('more htmlinvalid html');
    });

    test('should respect whitespace in inner tags', () => {
      const html = new HtmlModule('<div>more html <span>  invalid html</span>');
      const element = html.querySelector('div')!;
      expect(element.textContent).toBe('more html   invalid html');
    });

    test('should convert html entities', () => {
      const html = new HtmlModule('<div>more html &amp; <span>  invalid html</span>');
      const element = html.querySelector('div')!;
      expect(element.textContent).toBe('more html &   invalid html');
    });

    test('should be settable', () => {
      const html = new HtmlModule('<div>invalid html');
      const element = html.querySelector('div')!;
      element.textContent = 'new html';
      expect(html.toString()).toBe('<div>new html');
    });

    test('should be settable from empty string to "new html"', () => {
      const html = new HtmlModule('<div></div>');
      const element = html.querySelector('div')!;
      element.textContent = 'new html';
      expect(html.toString()).toBe('<div>new html</div>');
    });

    test('should be settable and replace inner tags', () => {
      const html = new HtmlModule('<div>more html<span>invalid html</span>');
      const element = html.querySelector('div')!;
      element.textContent = 'new html';
      expect(html.toString()).toBe('<div>new html');
    });

    test('should be settable and escape given HTML', () => {
      const html = new HtmlModule('<div>more html<span>invalid html</span>');
      const element = html.querySelector('div')!;
      element.textContent = 'new html <span>foo</span>';
      expect(html.toString()).toBe('<div>new html &lt;span&gt;foo&lt;/span&gt;');
    });
  });

  describe('outerHTML', () => {
    test('should exist', () => {
      const html = new HtmlModule('<div>invalid html');
      const element = html.querySelector('div')!;
      expect(element.outerHTML).toBe('<div>invalid html');
    });

    test('should work for self-closing tags', () => {
      const html = new HtmlModule('<span>  <div/> </span>');
      const element = html.querySelector('div')!;

      expect(element.outerHTML).toBe('<div/>');
    });

    test('should work for self-closing tags without the slash', () => {
      const html = new HtmlModule('<img>');
      const element = html.querySelector('img')!;
      expect(element.outerHTML).toBe('<img>');
    });

    test('should exist for partially closed tags', () => {
      const html = new HtmlModule('<div>invalid html</div');
      const element = html.querySelector('div')!;
      // we end at the first <
      expect(element.outerHTML).toBe('<div>invalid html<');
    });
  });

  describe('children', () => {
    test('should exist', () => {
      const html = new HtmlModule('<div></div>');
      const element = html.querySelector('div')!;
      expect(element.children).toBeInstanceOf(Array);
      expect(element.children).toEqual([]);
    });

    test('should be a raw pass-through to the children array', () => {
      const html = new HtmlModule('<div><span></span></div>');
      const element = html.querySelector('div')!;
      expect(element.children).toBeInstanceOf(Array);
      expect(element.children).toEqual([html.querySelector('span')!.__element]);
    });
  });

  describe('parent', () => {
    test('should exist', () => {
      const html = new HtmlModule('<div><span></span></div>');
      const element = html.querySelector('span')!;
      expect(element.parent).toBeInstanceOf(HtmlModuleElement);
      expect(element.parent!.tagName).toBe('div');
    });

    test('should be null for the root element', () => {
      const html = new HtmlModule('<div></div>');
      const element = html.querySelector('div')!;
      expect(element.parent).toBe(null);
    });
  });

  describe('before()', () => {
    test('should insert before the element with valid html', () => {
      const html = new HtmlModule('<div></div>');
      const element = html.querySelector('div')!;
      element.before('<span></span>');
      expect(html.toString()).toBe('<span></span><div></div>');
    });

    test('should insert before the element with broken html', () => {
      const html = new HtmlModule('<div>');
      const element = html.querySelector('div')!;
      element.before('<span></span>');
      expect(html.toString()).toBe('<span></span><div>');
    });

    test('should insert before the self-closing element with valid html', () => {
      const html = new HtmlModule('<div/>');
      const element = html.querySelector('div')!;
      element.before('<span></span>');
      expect(html.toString()).toBe('<span></span><div/>');
    });
  });

  describe('after()', () => {
    test('should insert after the element with valid html', () => {
      const html = new HtmlModule('<div></div>');
      const element = html.querySelector('div')!;
      element.after('<span></span>');
      expect(html.toString()).toBe('<div></div><span></span>');
    });

    test('should insert after the element with broken html', () => {
      const html = new HtmlModule('<div>');
      const element = html.querySelector('div')!;
      element.after('<span></span>');
      expect(html.toString()).toBe('<div><span></span>');
    });

    test('should insert after the self-closing element with valid html', () => {
      const html = new HtmlModule('<div/>');
      const element = html.querySelector('div')!;
      element.after('<span></span>');
      expect(html.toString()).toBe('<div/><span></span>');
    });
  });

  describe('prepend()', () => {
    test('should prepend to the element with valid html', () => {
      const html = new HtmlModule('<div>here</div>');
      const element = html.querySelector('div')!;
      element.prepend('<span></span>');
      expect(html.toString()).toBe('<div><span></span>here</div>');
    });

    test('should prepend to the element with broken html', () => {
      const html = new HtmlModule('<div>here');
      const element = html.querySelector('div')!;
      element.prepend('<span></span>');
      expect(html.toString()).toBe('<div><span></span>here');
    });

    test('should prepend to the self-closing element with slash', () => {
      const html = new HtmlModule('<div/>');
      const element = html.querySelector('div')!;
      element.prepend('<span></span>');
      expect(html.toString()).toBe('<div><span></span></div>');
    });

    test('should prepend to the self-closing element without slash', () => {
      const html = new HtmlModule('<img>');
      const element = html.querySelector('img')!;
      element.prepend('<span></span>');
      expect(html.toString()).toBe('<img><span></span></img>');
    });
  });

  describe('append()', () => {
    test('should append to the element with valid html', () => {
      const html = new HtmlModule('<div>here</div>');
      const element = html.querySelector('div')!;
      element.append('<span></span>');
      expect(html.toString()).toBe('<div>here<span></span></div>');
    });

    test('should append to the element with broken html', () => {
      const html = new HtmlModule('<div>here');
      const element = html.querySelector('div')!;
      element.append('<span></span>');
      expect(html.toString()).toBe('<div>here<span></span>');
    });

    test('should append to the self-closing element with slash', () => {
      const html = new HtmlModule('<div/>');
      const element = html.querySelector('div')!;
      element.append('<span></span>');
      expect(html.toString()).toBe('<div><span></span></div>');
    });

    test('should append to the self-closing element without slash', () => {
      const html = new HtmlModule('<img>');
      const element = html.querySelector('img')!;
      element.append('<span></span>');
      expect(html.toString()).toBe('<img><span></span></img>');
    });
  });

  describe('remove()', () => {
    test('should remove the element', () => {
      const html = new HtmlModule('before<div>here</div>after');
      const element = html.querySelector('div')!;
      element.remove();
      expect(html.toString()).toBe('beforeafter');
    });

    test('should remove the element with broken html', () => {
      const html = new HtmlModule('before<div>hereafter');
      const element = html.querySelector('div')!;
      element.remove();
      expect(html.toString()).toBe('before');
    });

    test('should remove the element with complex broken html', () => {
      const html = new HtmlModule('<span>before<div>hereafter</span>');
      const element = html.querySelector('div')!;
      element.remove();
      expect(html.toString()).toBe('<span>before</span>');
    });

    test('should remove the self-closing element', () => {
      const html = new HtmlModule('before<div/>after');
      const element = html.querySelector('div')!;
      element.remove();
      expect(html.toString()).toBe('beforeafter');
    });
  });

  describe('replaceWith()', () => {
    test('should replace the element with valid html', () => {
      const html = new HtmlModule('before<div>here</div>after');
      const element = html.querySelector('div')!;
      element.replaceWith('<span>here</span>');
      expect(html.toString()).toBe('before<span>here</span>after');
    });

    test('should replace the element with broken html', () => {
      const html = new HtmlModule('before<div>hereafter');
      const element = html.querySelector('div')!;
      element.replaceWith('<span></span>');
      expect(html.toString()).toBe('before<span></span>');
    });

    test('should replace the self-closing element with valid html', () => {
      const html = new HtmlModule("before<div class='a'/>after");
      const element = html.querySelector('div')!;
      element.replaceWith('<span></span>');
      expect(html.toString()).toBe('before<span></span>after');
    });
  });

  describe('hasAttribute()', () => {
    test('should return true if the attribute exists', () => {
      const html = new HtmlModule("<div class='a'></div>");
      const element = html.querySelector('div')!;
      expect(element.hasAttribute('class')).toBe(true);
    });

    test('should return false if the attribute does not exist', () => {
      const html = new HtmlModule('<div></div>');
      const element = html.querySelector('div')!;
      expect(element.hasAttribute('class')).toBe(false);
    });

    test('should return true if the attribute is empty', () => {
      const html = new HtmlModule("<div class=''></div>");
      const element = html.querySelector('div')!;
      expect(element.hasAttribute('class')).toBe(true);
    });
  });

  describe('hasAttributes()', () => {
    test('should return true if the element has attributes', () => {
      const html = new HtmlModule('<div class="a"></div>');
      const element = html.querySelector('div')!;
      expect(element.hasAttributes()).toBe(true);
    });

    test('should return false if the element has no attributes', () => {
      const html = new HtmlModule('<div></div>');
      const element = html.querySelector('div')!;
      expect(element.hasAttributes()).toBe(false);
    });
  });

  describe('getAttribute()', () => {
    test('should return the attribute value', () => {
      const html = new HtmlModule("<div class='a'></div>");
      const element = html.querySelector('div')!;
      expect(element.getAttribute('class')).toBe('a');
    });

    test('should return the attribute value with quotes unescaped if possible', () => {
      const html = new HtmlModule(`<div class="&quot;a&quot;" id='&#39;b&#39;'></div>`);
      const element = html.querySelector('div')!;
      expect(element.getAttribute('class')).toBe('"a"');
      expect(element.getAttribute('id')).toBe("'b'");
    });

    test('should return null if the attribute does not exist', () => {
      const html = new HtmlModule('<div></div>');
      const element = html.querySelector('div')!;
      expect(element.getAttribute('class')).toBe(null);
    });

    test('should return empty string if the attribute is empty', () => {
      const html = new HtmlModule("<div class=''></div>");
      const element = html.querySelector('div')!;
      expect(element.getAttribute('class')).toBe('');
    });
  });

  describe('getAttributeNames()', () => {
    test('should return the attribute names', () => {
      const html = new HtmlModule("<div class='a' id='b'></div>");
      const element = html.querySelector('div')!;
      expect(element.getAttributeNames()).toEqual(['class', 'id']);
    });

    test('should return empty array if the element has no attributes', () => {
      const html = new HtmlModule('<div></div>');
      const element = html.querySelector('div')!;
      expect(element.getAttributeNames()).toEqual([]);
    });
  });

  describe('setAttribute()', () => {
    test('should add an attribute to a tag', () => {
      const html = new HtmlModule('<div></div>');
      const element = html.querySelector('div')!;
      element.setAttribute('class', '');
      expect(html.toString()).toBe('<div class=""></div>');
    });

    test('should add an attribute and single letter value to a tag', () => {
      const html = new HtmlModule('<div></div>');
      const element = html.querySelector('div')!;
      element.setAttribute('class', 'a');
      expect(html.toString()).toBe('<div class="a"></div>');
    });

    test('should add an attribute and multi letter value to a tag', () => {
      const html = new HtmlModule('<div></div>');
      const element = html.querySelector('div')!;
      element.setAttribute('class', 'abc');
      expect(html.toString()).toBe('<div class="abc"></div>');
    });

    test('should add an attribute to a void tag with a trailing slash', () => {
      const html = new HtmlModule('<img />');
      const element = html.querySelector('img')!;
      element.setAttribute('class', '');
      expect(html.toString()).toBe('<img class="" />');
    });

    test('should add an attribute to a void tag without a trailing slash', () => {
      const html = new HtmlModule('<img>');
      const element = html.querySelector('img')!;
      element.setAttribute('class', '');
      expect(html.toString()).toBe('<img class="">');
    });

    test('should add an attribute to a void tag with a trailing slash and single letter value', () => {
      const html = new HtmlModule('<img />');
      const element = html.querySelector('img')!;
      element.setAttribute('class', 'a');
      expect(html.toString()).toBe('<img class="a" />');
    });

    test('should add an attribute to a void tag without a trailing slash and single letter value', () => {
      const html = new HtmlModule('<img>');
      const element = html.querySelector('img')!;
      element.setAttribute('class', 'a');
      expect(html.toString()).toBe('<img class="a">');
    });

    test('should add an attribute to a void tag with a trailing slash and multi letter value', () => {
      const html = new HtmlModule('<img />');
      const element = html.querySelector('img')!;
      element.setAttribute('class', 'abc');
      expect(html.toString()).toBe('<img class="abc" />');
    });

    test('should add an attribute to a void tag without a trailing slash and multi letter value', () => {
      const html = new HtmlModule('<img>');
      const element = html.querySelector('img')!;
      element.setAttribute('class', 'abc');
      expect(html.toString()).toBe('<img class="abc">');
    });

    test('should update the empty attribute value on a tag with double quotes', () => {
      const html = new HtmlModule('<div class=""></div>');
      const element = html.querySelector('div')!;
      element.setAttribute('class', 'a');
      expect(html.toString()).toBe('<div class="a"></div>');
    });

    test('should update the empty attribute value on a tag with single quotes', () => {
      const html = new HtmlModule("<div class=''></div>");
      const element = html.querySelector('div')!;
      element.setAttribute('class', 'a');
      expect(html.toString()).toBe("<div class='a'></div>");
    });

    test('should update the empty attribute value on a tag with no quotes', () => {
      const html = new HtmlModule('<div class=></div>');
      const element = html.querySelector('div')!;
      element.setAttribute('class', 'a');
      expect(html.toString()).toBe('<div class=a></div>');
    });

    test('should update the empty attribute value on a tag with no quotes but it needs quotes', () => {
      const html = new HtmlModule('<div class=></div>');
      const element = html.querySelector('div')!;
      element.setAttribute('class', 'a and b');
      expect(html.toString()).toBe('<div class="a and b"></div>');
    });

    test('should update the empty attribute value on a tag with no quotes or equal sign', () => {
      const html = new HtmlModule('<div class></div>');
      const element = html.querySelector('div')!;
      element.setAttribute('class', 'a');
      expect(html.toString()).toBe('<div class="a"></div>');
    });

    test('should update the single letter attribute value on a tag with double quotes', () => {
      const html = new HtmlModule('<div class="a"></div>');
      const element = html.querySelector('div')!;
      element.setAttribute('class', 'b');
      expect(html.toString()).toBe('<div class="b"></div>');
    });

    test('should update the single letter attribute value on a tag with single quotes', () => {
      const html = new HtmlModule("<div class='a'></div>");
      const element = html.querySelector('div')!;
      element.setAttribute('class', 'b');
      expect(html.toString()).toBe("<div class='b'></div>");
    });

    test('should update the single letter attribute value on a tag with no quotes', () => {
      const html = new HtmlModule('<div class=a></div>');
      const element = html.querySelector('div')!;
      element.setAttribute('class', 'b');
      expect(html.toString()).toBe('<div class=b></div>');
    });

    test('should update the multi letter attribute value on a tag with double quotes', () => {
      const html = new HtmlModule('<div class="abc"></div>');
      const element = html.querySelector('div')!;
      element.setAttribute('class', 'def');
      expect(html.toString()).toBe('<div class="def"></div>');
    });

    test('should update the multi letter attribute value on a tag with single quotes', () => {
      const html = new HtmlModule("<div class='abc'></div>");
      const element = html.querySelector('div')!;
      element.setAttribute('class', 'def');
      expect(html.toString()).toBe("<div class='def'></div>");
    });

    test('should update the multi letter attribute value on a tag with no quotes', () => {
      const html = new HtmlModule('<div class=abc></div>');
      const element = html.querySelector('div')!;
      element.setAttribute('class', 'def');
      expect(html.toString()).toBe('<div class=def></div>');
    });

    test('should update the attribute value and add quotes since it has a space', () => {
      const html = new HtmlModule('<div class=abc></div>');
      const element = html.querySelector('div')!;
      element.setAttribute('class', 'def ghi');
      expect(html.toString()).toBe('<div class="def ghi"></div>');
    });

    test('should update the attribute value and add quotes since it has a <', () => {
      const html = new HtmlModule('<div class=abc></div>');
      const element = html.querySelector('div')!;
      element.setAttribute('class', 'def<ghi');
      expect(html.toString()).toBe('<div class="def<ghi"></div>');
    });

    describe('single quotes', () => {
      test('should update an attribute value containing double quotes by changing to single quotes', () => {
        const html = new HtmlModule('<div class="abc"></div>');
        const element = html.querySelector('div')!;
        element.setAttribute('class', 'def"ghi');
        expect(html.toString()).toBe(`<div class='def"ghi'></div>`);
      });

      test('should update an attribute value containing no quotes by adding single quotes', () => {
        const html = new HtmlModule('<div class=abc></div>');
        const element = html.querySelector('div')!;
        element.setAttribute('class', 'def"ghi');
        expect(html.toString()).toBe(`<div class='def"ghi'></div>`);
      });

      test('should set an attribute value by adding single quotes', () => {
        const html = new HtmlModule('<div class></div>');
        const element = html.querySelector('div')!;
        element.setAttribute('class', 'def"ghi');
        expect(html.toString()).toBe(`<div class='def"ghi'></div>`);
      });

      test('should set an empty attribute value by adding single quotes', () => {
        const html = new HtmlModule('<div class=></div>');
        const element = html.querySelector('div')!;
        element.setAttribute('class', 'def"ghi');
        expect(html.toString()).toBe(`<div class='def"ghi'></div>`);
      });

      test('should set an attribute value containing an empty string by adding single quotes', () => {
        const html = new HtmlModule('<div class=""></div>');
        const element = html.querySelector('div')!;
        element.setAttribute('class', 'def"ghi');
        expect(html.toString()).toBe(`<div class='def"ghi'></div>`);
      });
    });

    describe('double quotes', () => {
      test('should update an attribute value containing single quotes by changing to double quotes', () => {
        const html = new HtmlModule("<div class='abc'></div>");
        const element = html.querySelector('div')!;
        element.setAttribute('class', "def'ghi");
        expect(html.toString()).toBe(`<div class="def'ghi"></div>`);
      });

      test('should update an attribute value containing no quotes by adding single quotes', () => {
        const html = new HtmlModule('<div class=abc></div>');
        const element = html.querySelector('div')!;
        element.setAttribute('class', "def'ghi");
        expect(html.toString()).toBe(`<div class="def'ghi"></div>`);
      });

      test('should set an attribute value by adding double quotes', () => {
        const html = new HtmlModule('<div class></div>');
        const element = html.querySelector('div')!;
        element.setAttribute('class', "def'ghi");
        expect(html.toString()).toBe(`<div class="def'ghi"></div>`);
      });

      test('should set a empty attribute value by adding double quotes', () => {
        const html = new HtmlModule('<div class=></div>');
        const element = html.querySelector('div')!;
        element.setAttribute('class', "def'ghi");
        expect(html.toString()).toBe(`<div class="def'ghi"></div>`);
      });

      test('should set an attribute value containing an empty string by adding double quotes', () => {
        const html = new HtmlModule("<div class=''></div>");
        const element = html.querySelector('div')!;
        element.setAttribute('class', "def'ghi");
        expect(html.toString()).toBe(`<div class="def'ghi"></div>`);
      });
    });

    describe('mixed quotes', () => {
      test('should update the attribute value with single quotes and encode mixed quotes', () => {
        const html = new HtmlModule("<div class='abc'></div>");
        const element = html.querySelector('div')!;
        element.setAttribute('class', `def'g"hi`);
        expect(html.toString()).toBe(`<div class='def&#39;g"hi'></div>`);
      });

      test('should update the attribute value with double quotes and encode mixed quotes', () => {
        const html = new HtmlModule('<div class="abc"></div>');
        const element = html.querySelector('div')!;
        element.setAttribute('class', `def'g"hi`);
        expect(html.toString()).toBe(`<div class="def'g&quot;hi"></div>`);
      });
    });

    test('should set the attribute with empty value to update it', () => {
      const html = new HtmlModule('<div class="a"></div>');

      const element = html.querySelector('div')!;
      element.setAttribute('class', '');
      expect(html.toString()).toBe('<div class=""></div>');
    });
  });

  describe('toggleAttribute()', () => {
    test('should toggle off the attribute if it has a value', () => {
      const html = new HtmlModule('<div class="a"></div>');
      const element = html.querySelector('div')!;
      element.toggleAttribute('class');
      expect(html.toString()).toBe('<div></div>');
    });

    test('should toggle off the attribute if it has no value', () => {
      const html = new HtmlModule("<div class=''></div>");
      const element = html.querySelector('div')!;
      element.toggleAttribute('class');
      expect(html.toString()).toBe('<div></div>');
    });

    test('should toggle off the attribute if it has no value and no quotes', () => {
      const html = new HtmlModule('<div class=></div>');
      const element = html.querySelector('div')!;
      element.toggleAttribute('class');
      expect(html.toString()).toBe('<div></div>');
    });

    test('should toggle off the attribute if it has no value and no quotes or equal sign', () => {
      const html = new HtmlModule('<div class></div>');
      const element = html.querySelector('div')!;
      element.toggleAttribute('class');
      expect(html.toString()).toBe('<div></div>');
    });

    test('should toggle on the attribute', () => {
      const html = new HtmlModule('<div></div>');
      const element = html.querySelector('div')!;
      element.toggleAttribute('class');
      expect(html.toString()).toBe('<div class=""></div>');
    });

    test('should toggle on the attribute when forced', () => {
      const html = new HtmlModule("<div class='value'></div>");
      const element = html.querySelector('div')!;
      element.toggleAttribute('class', true);
      expect(html.toString()).toBe("<div class=''></div>");
    });

    test('should toggle off the attribute when forced', () => {
      const html = new HtmlModule('<div></div>');
      const element = html.querySelector('div')!;
      element.toggleAttribute('class', false);
      expect(html.toString()).toBe('<div></div>');
    });
  });

  describe('removeAttribute()', () => {
    test('should remove the attribute', () => {
      const html = new HtmlModule('<div class="a"></div>');
      const element = html.querySelector('div')!;
      element.removeAttribute('class');
      expect(html.toString()).toBe('<div></div>');
    });

    test('should make always have a space between the remaining attributes and tag name', () => {
      const html = new HtmlModule('<div remove-me id="b"></div>');
      const element = html.querySelector('div')!;
      element.removeAttribute('remove-me');
      expect(html.toString()).toBe('<div id="b"></div>');
    });

    test('should make always have a space between the remaining attributes', () => {
      const html = new HtmlModule('<div class="a" remove-me id="b"></div>');
      const element = html.querySelector('div')!;
      element.removeAttribute('remove-me');
      expect(html.toString()).toBe('<div class="a" id="b"></div>');
    });

    test('should remove the attribute with no value', () => {
      const html = new HtmlModule("<div class=''></div>");
      const element = html.querySelector('div')!;
      element.removeAttribute('class');

      expect(html.toString()).toBe('<div></div>');
    });

    test('should remove the attribute with no value and no quotes', () => {
      const html = new HtmlModule('<div a class=></div>');
      const element = html.querySelector('div')!;
      element.removeAttribute('class');

      expect(html.toString()).toBe('<div a></div>');
    });

    test('should remove the attribute with no value and no quotes or equal sign', () => {
      const html = new HtmlModule('<div a class b></div>');
      const element = html.querySelector('div')!;
      element.removeAttribute('class');

      expect(html.toString()).toBe('<div a b></div>');
    });

    test('should remove all instances of the attribute', () => {
      const html = new HtmlModule(`<div class="a" class=b class='c'></div>`);
      const element = html.querySelector('div')!;
      element.removeAttribute('class');
      expect(html.toString()).toBe('<div></div>');
    });

    test('should remove all instances of the attribute with left over attributes', () => {
      const html = new HtmlModule(`<div a  b class="a" class=b class c class='c' d ></div>`);
      const element = html.querySelector('div')!;
      element.removeAttribute('class');
      expect(html.toString()).toBe('<div a  b c  d ></div>');
    });
  });

  describe('querySelector()', () => {
    test('should return null if no match', () => {
      const html = new HtmlModule('<main><div>invalid html</main>');
      const main = html.querySelector('main')!;
      expect(main.querySelector('span')).toBe(null);
    });

    test('should return the first match', () => {
      const html = new HtmlModule('<main><div>invalid html</main>');
      const main = html.querySelector('main')!;
      expect(main.querySelector('div')).toBeInstanceOf(HtmlModuleElement);
    });

    test('should respect the custom HtmlModElement', () => {
      class CustomHtmlModuleElement extends HtmlModuleElement {}
      const html = new HtmlModule('<main><div>invalid html</main>', {
        HtmlModElement: CustomHtmlModuleElement,
      });
      const main = html.querySelector('main')!;
      expect(main.querySelector('div')).toBeInstanceOf(CustomHtmlModuleElement);
    });
  });

  describe('querySelectorAll()', () => {
    test('should return an empty array if no match', () => {
      const html = new HtmlModule('<main><div>invalid html</main>');
      const main = html.querySelector('main')!;
      expect(main.querySelectorAll('span')).toEqual([]);
    });

    test('should return all matches', () => {
      const html = new HtmlModule('<main><div>invalid html<div>another</main>');
      const main = html.querySelector('main')!;
      const results = main.querySelectorAll('div');
      expect(results).toBeInstanceOf(Array);
      expect(results.length).toBe(2);
      expect(results[0]).toBeInstanceOf(HtmlModuleElement);
      expect(results[1]).toBeInstanceOf(HtmlModuleElement);
    });
  });

  describe('clone()', () => {
    test('should clone the element', () => {
      const html = new HtmlModule('before<div>here</div>after');
      const element = html.querySelector('div')!;
      const clone = element.clone();
      expect(clone.toString()).toBe('<div>here</div>');
    });

    test('should be detatched from the original HtmlMod', () => {
      const html = new HtmlModule('before<div>here</div>after');
      const element = html.querySelector('div')!;
      expect(element.__htmlMod === html).toBe(true);
      const clone = element.clone();
      expect(clone.toString()).toBe('<div>here</div>');
      expect(clone.__htmlMod === html).toBe(false);
    });
  });

  describe('toString()', () => {
    test('should return the html', () => {
      const html = new HtmlModule('before<div>here</div>after');
      const element = html.querySelector('div')!;
      expect(element.toString()).toBe('<div>here</div>');
    });

    test('should equal "outerHTML"', () => {
      const html = new HtmlModule('before<div>here</div>after');
      const element = html.querySelector('div')!;
      expect(element.toString()).toBe(element.outerHTML);
    });

    test('should equal "outerHTML" from a cloned element', () => {
      const html = new HtmlModule('before<div>here</div>after');
      const element = html.querySelector('div')!;
      const clone = element.clone();
      expect(clone.toString()).toBe(clone.outerHTML);
    });
  });
});

// setAttribute from empty value
