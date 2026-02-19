import { describe, expect, test } from 'vitest';

import { HtmlMod } from './index';

/**
 * Tests to verify direct string manipulation produces correct output
 * These tests ensure our string slicing operations work correctly
 */
describe('String Manipulation Correctness', () => {
  describe('Basic Operations', () => {
    test('overwrite should replace content correctly', () => {
      const html = new HtmlMod('<div>hello</div>');
      const div = html.querySelector('div')!;

      div.innerHTML = 'world';

      expect(html.toString()).toBe('<div>world</div>');
    });

    test('append should add content at correct position', () => {
      const html = new HtmlMod('<div>hello</div>');
      const div = html.querySelector('div')!;

      div.after('<span>world</span>');

      expect(html.toString()).toBe('<div>hello</div><span>world</span>');
    });

    test('prepend should add content at correct position', () => {
      const html = new HtmlMod('<div>hello</div>');
      const div = html.querySelector('div')!;

      div.before('<span>world</span>');

      expect(html.toString()).toBe('<span>world</span><div>hello</div>');
    });

    test('remove should delete content correctly', () => {
      const html = new HtmlMod('<div>hello</div><span>world</span>');
      const span = html.querySelector('span')!;

      span.remove();

      expect(html.toString()).toBe('<div>hello</div>');
    });
  });

  describe('Boundary Cases', () => {
    test('should handle operations at start of string', () => {
      const html = new HtmlMod('<div>test</div>');
      const div = html.querySelector('div')!;

      div.before('<span>prefix</span>');

      expect(html.toString()).toBe('<span>prefix</span><div>test</div>');
    });

    test('should handle operations at end of string', () => {
      const html = new HtmlMod('<div>test</div>');
      const div = html.querySelector('div')!;

      div.after('<span>suffix</span>');

      expect(html.toString()).toBe('<div>test</div><span>suffix</span>');
    });

    test('should handle empty innerHTML', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      div.innerHTML = '';

      expect(html.toString()).toBe('<div></div>');
    });

    test('should handle single character content', () => {
      const html = new HtmlMod('<div>a</div>');
      const div = html.querySelector('div')!;

      div.innerHTML = 'b';

      expect(html.toString()).toBe('<div>b</div>');
    });
  });

  describe('Sequential Operations', () => {
    test('should handle multiple overwrites correctly', () => {
      const html = new HtmlMod('<div>a</div>');
      const div = html.querySelector('div')!;

      div.innerHTML = 'b';
      div.innerHTML = 'c';
      div.innerHTML = 'final';

      expect(html.toString()).toBe('<div>final</div>');
    });

    test('should handle attribute changes after innerHTML', () => {
      const html = new HtmlMod('<div id="old">content</div>');
      const div = html.querySelector('div')!;

      div.innerHTML = 'new content';
      div.id = 'new';

      expect(html.toString()).toBe('<div id="new">new content</div>');
    });

    test('should handle innerHTML after attribute changes', () => {
      const html = new HtmlMod('<div id="old">content</div>');
      const div = html.querySelector('div')!;

      div.id = 'new';
      div.innerHTML = 'new content';

      expect(html.toString()).toBe('<div id="new">new content</div>');
    });

    test('should handle tagName change with content change', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      div.tagName = 'span';
      div.innerHTML = 'new';

      expect(html.toString()).toBe('<span>new</span>');
    });

    test('should handle 10 sequential modifications', () => {
      const html = new HtmlMod('<div id="id0">0</div>');
      const div = html.querySelector('div')!;

      for (let index = 1; index <= 10; index++) {
        div.id = `id${index}`;
        div.innerHTML = String(index);
      }

      expect(html.toString()).toBe('<div id="id10">10</div>');
    });
  });

  describe('Complex Scenarios', () => {
    test('should handle nested element modifications', () => {
      const html = new HtmlMod('<div><span>inner</span></div>');
      const div = html.querySelector('div')!;
      const span = html.querySelector('span')!;

      span.innerHTML = 'modified';
      div.className = 'outer';

      expect(html.toString()).toBe('<div class="outer"><span>modified</span></div>');
    });

    test('should handle sibling modifications in sequence', () => {
      const html = new HtmlMod('<div>1</div><div>2</div><div>3</div>');
      const divs = html.querySelectorAll('div');

      divs[0].innerHTML = 'one';
      divs[1].innerHTML = 'two';
      divs[2].innerHTML = 'three';

      expect(html.toString()).toBe('<div>one</div><div>two</div><div>three</div>');
    });

    test('should handle remove and add operations', () => {
      const html = new HtmlMod('<div>a</div><div>b</div><div>c</div>');
      const divs = html.querySelectorAll('div');

      divs[1].remove(); // Remove middle
      divs[0].after('<span>new</span>'); // Add after first

      expect(html.toString()).toBe('<div>a</div><span>new</span><div>c</div>');
    });

    test('should handle self-closing tag conversion', () => {
      const html = new HtmlMod('<div/>');
      const div = html.querySelector('div')!;

      div.innerHTML = 'content';

      expect(html.toString()).toBe('<div>content</div>');
    });

    test('should handle multiple attribute changes', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      div.id = 'myid';
      div.className = 'myclass';
      div.dataset.foo = 'bar';
      div.dataset.baz = 'qux';

      const result = html.toString();
      expect(result).toContain('id="myid"');
      expect(result).toContain('class="myclass"');
      expect(result).toContain('data-foo="bar"');
      expect(result).toContain('data-baz="qux"');
    });
  });

  describe('Trim Operations', () => {
    test('trim should remove leading and trailing whitespace', () => {
      const html = new HtmlMod('  <div>content</div>  ');
      html.trim();

      expect(html.toString()).toBe('<div>content</div>');
    });

    test('trimStart should remove leading whitespace', () => {
      const html = new HtmlMod('  <div>content</div>');
      html.trimStart();

      expect(html.toString()).toBe('<div>content</div>');
    });

    test('trimEnd should remove trailing whitespace', () => {
      const html = new HtmlMod('<div>content</div>  ');
      html.trimEnd();

      expect(html.toString()).toBe('<div>content</div>');
    });

    test('trim with no whitespace should not change string', () => {
      const html = new HtmlMod('<div>content</div>');
      html.trim();

      expect(html.toString()).toBe('<div>content</div>');
    });
  });

  describe('Edge Cases and Stress Tests', () => {
    test('should handle very long content', () => {
      const html = new HtmlMod('<div>x</div>');
      const div = html.querySelector('div')!;

      const longContent = 'a'.repeat(10_000);
      div.innerHTML = longContent;

      expect(html.toString()).toBe(`<div>${longContent}</div>`);
      expect(html.toString().length).toBe(longContent.length + 11); // <div></div> = 11 chars
    });

    test('should handle special characters in content', () => {
      const html = new HtmlMod('<div>old</div>');
      const div = html.querySelector('div')!;

      div.innerHTML = '<>&"\'';

      expect(html.toString()).toBe('<div><>&"\'</div>');
    });

    test('should handle unicode characters', () => {
      const html = new HtmlMod('<div>old</div>');
      const div = html.querySelector('div')!;

      div.innerHTML = '🎉✨🚀';

      expect(html.toString()).toBe('<div>🎉✨🚀</div>');
    });

    test('should handle newlines in content', () => {
      const html = new HtmlMod('<div>old</div>');
      const div = html.querySelector('div')!;

      div.innerHTML = 'line1\nline2\nline3';

      expect(html.toString()).toBe('<div>line1\nline2\nline3</div>');
    });

    test('should handle empty string replacement', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      div.innerHTML = '';
      div.innerHTML = 'new';

      expect(html.toString()).toBe('<div>new</div>');
    });
  });

  describe('Position Accuracy After Operations', () => {
    test('positions should be accurate after innerHTML change', () => {
      const html = new HtmlMod('<div>hello</div>');
      const div = html.querySelector('div')!;

      div.innerHTML = 'world';

      // Query again to verify positions are correct
      const divAgain = html.querySelector('div')!;
      expect(divAgain.innerHTML).toBe('world');
      expect(divAgain.outerHTML).toBe('<div>world</div>');
    });

    test('positions should be accurate after multiple changes', () => {
      const html = new HtmlMod('<div id="a">1</div><div id="b">2</div>');

      const div1 = html.querySelector('#a')!;
      const div2 = html.querySelector('#b')!;

      div1.innerHTML = 'one';
      div2.innerHTML = 'two';

      // Query again
      const div1Again = html.querySelector('#a')!;
      const div2Again = html.querySelector('#b')!;

      expect(div1Again.innerHTML).toBe('one');
      expect(div2Again.innerHTML).toBe('two');
    });

    test('should maintain correct positions after remove', () => {
      const html = new HtmlMod('<a>1</a><b>2</b><c>3</c>');

      html.querySelector('b')!.remove();

      const a = html.querySelector('a')!;
      const c = html.querySelector('c')!;

      expect(a.innerHTML).toBe('1');
      expect(c.innerHTML).toBe('3');
      expect(html.toString()).toBe('<a>1</a><c>3</c>');
    });
  });

  describe('Regression Tests', () => {
    test('should not corrupt output with rapid setAttribute calls', () => {
      const html = new HtmlMod('<div>test</div>');
      const div = html.querySelector('div')!;

      for (let index = 0; index < 100; index++) {
        div.dataset.index = String(index);
      }

      expect(html.toString()).toContain('data-index="99"');
      expect(html.toString()).toMatch(/<div[^>]*>test<\/div>/);
    });

    test('should not corrupt output with alternating operations', () => {
      const html = new HtmlMod('<div id="test">content</div>');
      const div = html.querySelector('div')!;

      for (let index = 0; index < 50; index++) {
        div.id = `id${index}`;
        div.innerHTML = `content${index}`;
      }

      expect(html.toString()).toBe('<div id="id49">content49</div>');
    });

    test('should handle tagName changes correctly', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      div.tagName = 'span';

      expect(html.toString()).toBe('<span>content</span>');

      const span = html.querySelector('span')!;
      expect(span.innerHTML).toBe('content');
    });
  });
});
