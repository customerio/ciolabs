/* eslint-disable unicorn/prefer-dom-node-dataset */
import { describe, expect, test } from 'vitest';

import { HtmlMod, HtmlModElement, HtmlModText } from './index.js';

describe('Auto-Flush Edge Cases - Aggressive Testing', () => {
  describe('Chained Modifications with Queries', () => {
    test('should handle query -> modify -> query -> modify chains', () => {
      const html = new HtmlMod('<div><span>first</span></div>');

      const div = html.querySelector('div')!;
      expect(div.innerHTML).toBe('<span>first</span>');

      div.append('<span>second</span>');
      expect(html.querySelectorAll('span').length).toBe(2);

      const spans = html.querySelectorAll('span');
      spans[0].innerHTML = 'modified-first';
      expect(html.querySelector('span')!.innerHTML).toBe('modified-first');

      spans[1].innerHTML = 'modified-second';
      expect(html.querySelectorAll('span')[1].innerHTML).toBe('modified-second');

      expect(html.toString()).toBe('<div><span>modified-first</span><span>modified-second</span></div>');
    });

    test('should handle deep modification chains', () => {
      const html = new HtmlMod('<div><p><span>text</span></p></div>');

      for (let index = 0; index < 10; index++) {
        const span = html.querySelector('span')!;
        span.innerHTML = `iteration-${index}`;
        expect(html.querySelector('span')!.innerHTML).toBe(`iteration-${index}`);
      }

      expect(html.toString()).toBe('<div><p><span>iteration-9</span></p></div>');
    });

    test('should handle modifications that change document structure repeatedly', () => {
      const html = new HtmlMod('<div></div>');

      // Add content
      const div = html.querySelector('div')!;
      div.innerHTML = '<span>1</span>';
      expect(html.querySelectorAll('span').length).toBe(1);

      // Replace with more content
      div.innerHTML = '<span>1</span><span>2</span>';
      expect(html.querySelectorAll('span').length).toBe(2);

      // Replace with even more content
      div.innerHTML = '<span>1</span><span>2</span><span>3</span>';
      expect(html.querySelectorAll('span').length).toBe(3);

      // Modify each span
      const spans = html.querySelectorAll('span');
      spans[0].innerHTML = 'first';
      spans[1].innerHTML = 'second';
      spans[2].innerHTML = 'third';

      expect(html.toString()).toBe('<div><span>first</span><span>second</span><span>third</span></div>');
    });
  });

  describe('Parent-Child Modification Ordering', () => {
    test('should handle parent modification followed by child query', () => {
      const html = new HtmlMod('<div><p>content</p></div>');

      const div = html.querySelector('div')!;
      div.prepend('<span>prefix</span>');

      const span = html.querySelector('span')!;
      expect(span.innerHTML).toBe('prefix');

      const p = html.querySelector('p')!;
      expect(p.innerHTML).toBe('content');
    });

    test('should handle child modification followed by parent query', () => {
      const html = new HtmlMod('<div><p>content</p></div>');

      const p = html.querySelector('p')!;
      p.innerHTML = 'modified';

      const div = html.querySelector('div')!;
      expect(div.innerHTML).toBe('<p>modified</p>');
    });

    test('should handle sibling modifications in sequence', () => {
      const html = new HtmlMod('<div><a>1</a><b>2</b><c>3</c></div>');

      const elements = html.querySelectorAll('a, b, c');
      elements[0].innerHTML = 'first';
      elements[1].innerHTML = 'second';
      elements[2].innerHTML = 'third';

      expect(html.querySelector('a')!.innerHTML).toBe('first');
      expect(html.querySelector('b')!.innerHTML).toBe('second');
      expect(html.querySelector('c')!.innerHTML).toBe('third');
    });

    test('should handle nested parent modifications', () => {
      const html = new HtmlMod('<div><section><article><p>deep</p></article></section></div>');

      const div = html.querySelector('div')!;
      div.prepend('<!-- div prefix -->');

      const section = html.querySelector('section')!;
      section.prepend('<!-- section prefix -->');

      const article = html.querySelector('article')!;
      article.prepend('<!-- article prefix -->');

      const p = html.querySelector('p')!;
      expect(p.innerHTML).toBe('deep');

      expect(html.toString()).toContain('<!-- div prefix -->');
      expect(html.toString()).toContain('<!-- section prefix -->');
      expect(html.toString()).toContain('<!-- article prefix -->');
    });
  });

  describe('Attribute Modifications After Content Changes', () => {
    test('should handle attribute modifications after innerHTML changes', () => {
      const html = new HtmlMod('<div class="old">content</div>');

      const div = html.querySelector('div')!;
      div.innerHTML = 'new content that is much longer';
      div.setAttribute('class', 'new');
      div.setAttribute('data-test', 'value');

      expect(html.toString()).toBe('<div class="new" data-test="value">new content that is much longer</div>');
    });

    test('should handle content modifications after attribute changes', () => {
      const html = new HtmlMod('<div class="old">content</div>');

      const div = html.querySelector('div')!;
      div.setAttribute('class', 'new');
      div.setAttribute('data-test', 'value');
      div.innerHTML = 'new content';

      expect(html.toString()).toBe('<div class="new" data-test="value">new content</div>');
    });

    test('should handle interleaved attribute and content changes', () => {
      const html = new HtmlMod('<div>content</div>');

      const div = html.querySelector('div')!;
      div.setAttribute('a', '1');
      div.innerHTML = 'modified';
      div.setAttribute('b', '2');
      div.append(' more');
      div.setAttribute('c', '3');

      expect(div.getAttribute('a')).toBe('1');
      expect(div.getAttribute('b')).toBe('2');
      expect(div.getAttribute('c')).toBe('3');
      expect(div.innerHTML).toBe('modified more');
    });

    test('should handle attribute removal after content changes', () => {
      const html = new HtmlMod('<div class="test" data-a="1" data-b="2">content</div>');

      const div = html.querySelector('div')!;
      div.innerHTML = 'much longer content that shifts positions significantly';
      div.removeAttribute('data-a');
      div.removeAttribute('class');

      expect(div.hasAttribute('class')).toBe(false);
      expect(div.hasAttribute('data-a')).toBe(false);
      expect(div.hasAttribute('data-b')).toBe(true);
    });
  });

  describe('Self-Closing Tag Conversions', () => {
    test('should handle self-closing to regular tag with content', () => {
      const html = new HtmlMod('<div/>');

      const div = html.querySelector('div')!;
      div.innerHTML = 'content';

      expect(html.toString()).toBe('<div>content</div>');
      expect(html.querySelector('div')!.innerHTML).toBe('content');
    });

    test('should handle self-closing to regular tag with nested elements', () => {
      const html = new HtmlMod('<div/>');

      const div = html.querySelector('div')!;
      div.innerHTML = '<span>nested</span>';

      expect(html.querySelectorAll('span').length).toBe(1);
      expect(html.querySelector('span')!.innerHTML).toBe('nested');
    });

    test('should handle multiple self-closing conversions', () => {
      const html = new HtmlMod('<div/><section/><article/>');

      html.querySelector('div')!.innerHTML = 'div-content';
      html.querySelector('section')!.innerHTML = 'section-content';
      html.querySelector('article')!.innerHTML = 'article-content';

      expect(html.toString()).toBe(
        '<div>div-content</div><section>section-content</section><article>article-content</article>'
      );
    });
  });

  describe('Remove Operations and Stale References', () => {
    test('should handle queries after element removal', () => {
      const html = new HtmlMod('<div><span>1</span><span>2</span><span>3</span></div>');

      const spans = html.querySelectorAll('span');
      expect(spans.length).toBe(3);

      spans[1].remove();

      const remainingSpans = html.querySelectorAll('span');
      expect(remainingSpans.length).toBe(2);
      expect(remainingSpans[0].innerHTML).toBe('1');
      expect(remainingSpans[1].innerHTML).toBe('3');
    });

    test('should handle modifications after removing siblings', () => {
      const html = new HtmlMod('<div><a>1</a><b>2</b><c>3</c><d>4</d></div>');

      html.querySelector('b')!.remove();
      html.querySelector('c')!.remove();

      const a = html.querySelector('a')!;
      const d = html.querySelector('d')!;

      a.innerHTML = 'first';
      d.innerHTML = 'last';

      expect(html.toString()).toBe('<div><a>first</a><d>last</d></div>');
    });

    test('should handle parent modification after child removal', () => {
      const html = new HtmlMod('<div><span>remove-me</span><p>keep-me</p></div>');

      html.querySelector('span')!.remove();

      const div = html.querySelector('div')!;
      div.prepend('<h1>title</h1>');

      expect(html.querySelectorAll('span').length).toBe(0);
      expect(html.querySelectorAll('h1').length).toBe(1);
      expect(html.querySelectorAll('p').length).toBe(1);
    });
  });

  describe('Text Node Modifications in Complex Structures', () => {
    test('should handle multiple text node modifications in nested structure', () => {
      const html = new HtmlMod('<div><p>text1</p><section><span>text2</span></section></div>');

      const p = html.querySelector('p')!;
      const pText = p.children[0];
      if (pText instanceof HtmlModText) {
        pText.textContent = 'modified-text1';
      }

      const span = html.querySelector('span')!;
      const spanText = span.children[0];
      if (spanText instanceof HtmlModText) {
        spanText.textContent = 'modified-text2';
      }

      expect(html.querySelector('p')!.textContent).toBe('modified-text1');
      expect(html.querySelector('span')!.textContent).toBe('modified-text2');
    });

    test('should handle text modifications with special characters', () => {
      const html = new HtmlMod('<div>simple</div>');

      const div = html.querySelector('div')!;
      div.innerHTML = '<p>&lt;html&gt;</p>';

      const p = html.querySelector('p')!;
      expect(p.textContent).toBe('<html>');

      p.innerHTML = '&quot;quotes&quot;';
      expect(p.textContent).toBe('"quotes"');
    });
  });

  describe('Mixed Operation Types in Sequence', () => {
    test('should handle overwrite -> append -> prepend -> remove sequence', () => {
      const html = new HtmlMod('<div><a>1</a><b>2</b><c>3</c></div>');

      // Overwrite
      html.querySelector('b')!.innerHTML = 'modified';
      expect(html.querySelector('b')!.innerHTML).toBe('modified');

      // Append
      html.querySelector('div')!.append('<d>4</d>');
      expect(html.querySelectorAll('a, b, c, d').length).toBe(4);

      // Prepend
      html.querySelector('div')!.prepend('<h1>title</h1>');
      expect(html.querySelector('h1')!.innerHTML).toBe('title');

      // Remove
      html.querySelector('c')!.remove();
      expect(html.querySelectorAll('c').length).toBe(0);

      expect(html.querySelectorAll('a, b, d').length).toBe(3);
    });

    test('should handle replace -> setAttribute -> append -> remove sequence', () => {
      const html = new HtmlMod('<div><span>old</span></div>');

      const span = html.querySelector('span')!;
      span.replaceWith('<p>new</p>');

      const p = html.querySelector('p')!;
      p.setAttribute('class', 'test');

      html.querySelector('div')!.append('<footer>end</footer>');

      expect(html.querySelectorAll('span').length).toBe(0);
      expect(html.querySelector('p')!.getAttribute('class')).toBe('test');
      expect(html.querySelector('footer')!.innerHTML).toBe('end');
    });
  });

  describe('Boundary Conditions', () => {
    test('should handle empty string modifications', () => {
      const html = new HtmlMod('<div>content</div>');

      const div = html.querySelector('div')!;
      div.innerHTML = '';
      expect(div.innerHTML).toBe('');

      div.innerHTML = 'new';
      expect(div.innerHTML).toBe('new');
    });

    test('should handle very long string modifications', () => {
      const longContent = 'x'.repeat(10_000);
      const html = new HtmlMod('<div>short</div>');

      const div = html.querySelector('div')!;
      div.innerHTML = longContent;
      expect(div.innerHTML).toBe(longContent);

      div.innerHTML = 'short';
      expect(div.innerHTML).toBe('short');
    });

    test('should handle modifications at document boundaries', () => {
      const html = new HtmlMod('<div>content</div>');

      html.trim();
      const div = html.querySelector('div')!;
      expect(div.innerHTML).toBe('content');

      div.prepend('prefix');
      expect(div.innerHTML).toBe('prefixcontent');
    });

    test('should handle empty document modifications', () => {
      const html = new HtmlMod('');
      expect(html.toString()).toBe('');

      // Can't query empty document, but toString should work
      expect(html.isEmpty()).toBe(true);
    });
  });

  describe('Complex Selector Queries After Modifications', () => {
    test('should handle complex selectors after structure changes', () => {
      const html = new HtmlMod('<div class="container"><section><p class="text">content</p></section></div>');

      html.querySelector('p')!.innerHTML = 'modified';

      expect(html.querySelector('.container .text')!.innerHTML).toBe('modified');
      expect(html.querySelector('div section p')!.innerHTML).toBe('modified');
      expect(html.querySelector('p.text')!.innerHTML).toBe('modified');
    });

    test('should handle attribute selectors after attribute changes', () => {
      const html = new HtmlMod('<div><a href="old">link</a></div>');

      const a = html.querySelector('a')!;
      a.setAttribute('href', 'new');
      a.setAttribute('target', '_blank');

      expect(html.querySelector('[href="new"]')!.innerHTML).toBe('link');
      expect(html.querySelector('[target="_blank"]')!.innerHTML).toBe('link');
      expect(html.querySelector('a[href="new"][target="_blank"]')!.innerHTML).toBe('link');
    });

    test('should handle pseudo-selectors after modifications', () => {
      const html = new HtmlMod('<ul><li>1</li><li>2</li><li>3</li></ul>');

      const items = html.querySelectorAll('li');
      items[0].innerHTML = 'first';
      items[1].innerHTML = 'second';
      items[2].innerHTML = 'third';

      expect(html.querySelector('li:first-child')!.innerHTML).toBe('first');
      expect(html.querySelector('li:last-child')!.innerHTML).toBe('third');
    });
  });

  describe('Source Range Accuracy', () => {
    test('should maintain accurate source ranges after modifications', () => {
      const html = new HtmlMod('<div>content</div>');

      const div1 = html.querySelector('div')!;
      const range1 = div1.sourceRange;
      expect(range1.startLineNumber).toBe(1);
      expect(range1.startColumn).toBe(1);

      div1.prepend('prefix');

      const div2 = html.querySelector('div')!;
      const range2 = div2.sourceRange;
      expect(range2.startLineNumber).toBe(1);
      // Column should be same since we're querying the same element
      expect(range2.startColumn).toBe(1);
    });

    test('should handle source ranges in multiline documents', () => {
      const html = new HtmlMod('<div>\n  <p>line2</p>\n  <span>line3</span>\n</div>');

      const p = html.querySelector('p')!;
      p.innerHTML = 'modified';

      const range = html.querySelector('p')!.sourceRange;
      expect(range.startLineNumber).toBe(2);
    });
  });

  describe('Clone Operations', () => {
    test('should handle cloned element modifications independently', () => {
      const html = new HtmlMod('<div>original</div>');

      const div = html.querySelector('div')!;
      const clone = div.clone();

      div.innerHTML = 'modified-original';
      clone.innerHTML = 'modified-clone';

      expect(html.querySelector('div')!.innerHTML).toBe('modified-original');
      expect(clone.toString()).toBe('<div>modified-clone</div>');
    });

    test('should handle document clones', () => {
      const html = new HtmlMod('<div>content</div>');
      const clone = html.clone();

      html.querySelector('div')!.innerHTML = 'original-modified';
      clone.querySelector('div')!.innerHTML = 'clone-modified';

      expect(html.toString()).toBe('<div>original-modified</div>');
      expect(clone.toString()).toBe('<div>clone-modified</div>');
    });
  });

  describe('Large Document Performance and Correctness', () => {
    test('should handle large documents with many modifications', () => {
      const items = Array.from({ length: 100 }, (_, index) => `<li>${index}</li>`).join('');
      const html = new HtmlMod(`<ul>${items}</ul>`);

      const listItems = html.querySelectorAll('li');
      expect(listItems.length).toBe(100);

      // Modify every 10th item
      for (let index = 0; index < 100; index += 10) {
        listItems[index].innerHTML = `modified-${index}`;
      }

      // Verify modifications
      for (let index = 0; index < 100; index += 10) {
        expect(html.querySelectorAll('li')[index].innerHTML).toBe(`modified-${index}`);
      }
    });

    test('should handle deeply nested structure modifications', () => {
      let htmlString = '<div>';
      for (let index = 0; index < 10; index++) {
        htmlString += `<section data-level="${index}">`;
      }
      htmlString += 'deep content';
      for (let index = 0; index < 10; index++) {
        htmlString += '</section>';
      }
      htmlString += '</div>';

      const html = new HtmlMod(htmlString);

      const sections = html.querySelectorAll('section');
      expect(sections.length).toBe(10);

      sections[0].setAttribute('modified', 'true');
      sections[9].setAttribute('modified', 'true');

      expect(html.querySelector('[data-level="0"]')!.getAttribute('modified')).toBe('true');
      expect(html.querySelector('[data-level="9"]')!.getAttribute('modified')).toBe('true');
    });
  });

  describe('Before/After Operations', () => {
    test('should handle before operations with multiple siblings', () => {
      const html = new HtmlMod('<div><b>2</b></div>');

      const b = html.querySelector('b')!;
      b.before('<a>1</a>');

      expect(html.querySelectorAll('a').length).toBe(1);
      expect(html.querySelectorAll('b').length).toBe(1);

      const a = html.querySelector('a')!;
      a.innerHTML = 'first';
      b.innerHTML = 'second';

      expect(html.toString()).toBe('<div><a>first</a><b>second</b></div>');
    });

    test('should handle after operations with multiple siblings', () => {
      const html = new HtmlMod('<div><a>1</a></div>');

      const a = html.querySelector('a')!;
      a.after('<b>2</b>');

      expect(html.querySelectorAll('a').length).toBe(1);
      expect(html.querySelectorAll('b').length).toBe(1);

      const b = html.querySelector('b')!;
      a.innerHTML = 'first';
      b.innerHTML = 'second';

      expect(html.toString()).toBe('<div><a>first</a><b>second</b></div>');
    });

    test('should handle mixed before/after operations', () => {
      const html = new HtmlMod('<div><c>3</c></div>');

      const c = html.querySelector('c')!;
      c.before('<b>2</b>');
      c.after('<d>4</d>');

      const b = html.querySelector('b')!;
      b.before('<a>1</a>');

      const d = html.querySelector('d')!;
      d.after('<e>5</e>');

      expect(html.querySelectorAll('a, b, c, d, e').length).toBe(5);

      const elements = html.querySelectorAll('a, b, c, d, e');
      for (const [index, element] of elements.entries()) {
        element.innerHTML = `${index + 1}`;
      }

      expect(html.toString()).toBe('<div><a>1</a><b>2</b><c>3</c><d>4</d><e>5</e></div>');
    });
  });

  describe('Stress Tests - Rapid Modifications', () => {
    test('should handle 100 rapid sequential modifications', () => {
      const html = new HtmlMod('<div>0</div>');
      const div = html.querySelector('div')!;

      for (let index = 1; index <= 100; index++) {
        div.innerHTML = `${index}`;
        expect(html.querySelector('div')!.innerHTML).toBe(`${index}`);
      }

      expect(html.toString()).toBe('<div>100</div>');
    });

    test('should handle alternating operations', () => {
      const html = new HtmlMod('<div></div>');
      const div = html.querySelector('div')!;

      for (let index = 0; index < 50; index++) {
        div.innerHTML = `<span>content-${index}</span>`;
        expect(html.querySelector('span')!.innerHTML).toBe(`content-${index}`);

        div.setAttribute(`attr-${index}`, `value-${index}`);
        expect(div.getAttribute(`attr-${index}`)).toBe(`value-${index}`);
      }
    });

    test('should handle complex nested modifications', () => {
      const html = new HtmlMod('<div><section><article><p>text</p></article></section></div>');

      for (let index = 0; index < 20; index++) {
        const p = html.querySelector('p')!;
        p.innerHTML = `iteration-${index}`;

        const article = html.querySelector('article')!;
        article.setAttribute(`data-iteration`, `${index}`);

        const section = html.querySelector('section')!;
        section.setAttribute(`data-count`, `${index}`);

        expect(html.querySelector('p')!.innerHTML).toBe(`iteration-${index}`);
        expect(html.querySelector('article')!.getAttribute('data-iteration')).toBe(`${index}`);
        expect(html.querySelector('section')!.getAttribute('data-count')).toBe(`${index}`);
      }
    });
  });

  describe('Edge Cases with Special HTML Structures', () => {
    test('should handle table modifications', () => {
      const html = new HtmlMod('<table><tr><td>cell</td></tr></table>');

      const td = html.querySelector('td')!;
      td.innerHTML = 'modified';

      const tr = html.querySelector('tr')!;
      tr.append('<td>new-cell</td>');

      expect(html.querySelectorAll('td').length).toBe(2);
      expect(html.querySelectorAll('td')[0].innerHTML).toBe('modified');
      expect(html.querySelectorAll('td')[1].innerHTML).toBe('new-cell');
    });

    test('should handle list modifications', () => {
      const html = new HtmlMod('<ul><li>1</li></ul>');

      const ul = html.querySelector('ul')!;
      ul.append('<li>2</li><li>3</li>');

      const items = html.querySelectorAll('li');
      expect(items.length).toBe(3);

      items[1].innerHTML = 'second';
      items[2].innerHTML = 'third';

      expect(html.toString()).toBe('<ul><li>1</li><li>second</li><li>third</li></ul>');
    });

    test('should handle form elements', () => {
      const html = new HtmlMod('<form><input type="text"/><button>Submit</button></form>');

      const input = html.querySelector('input')!;
      input.setAttribute('value', 'test');
      input.setAttribute('placeholder', 'Enter text');

      const button = html.querySelector('button')!;
      button.innerHTML = 'Send';

      expect(html.querySelector('input')!.getAttribute('value')).toBe('test');
      expect(html.querySelector('button')!.innerHTML).toBe('Send');
    });
  });

  describe('Error Recovery and Edge Cases', () => {
    test('should handle modifications to malformed HTML', () => {
      const html = new HtmlMod('<div>unclosed<p>nested</div>');

      const div = html.querySelector('div')!;
      div.setAttribute('class', 'container');

      const p = html.querySelector('p')!;
      p.innerHTML = 'fixed';

      expect(div.getAttribute('class')).toBe('container');
      expect(p.innerHTML).toBe('fixed');
    });

    test('should handle modifications with HTML entities', () => {
      const html = new HtmlMod('<div>&lt;script&gt;alert("test")&lt;/script&gt;</div>');

      const div = html.querySelector('div')!;
      expect(div.textContent).toBe('<script>alert("test")</script>');

      div.innerHTML = '&amp; &lt; &gt; &quot;';
      expect(div.textContent).toBe('& < > "');
    });

    test('should handle modifications with mixed quotes', () => {
      const html = new HtmlMod(`<div data-single='value' data-double="value">content</div>`);

      const div = html.querySelector('div')!;
      div.setAttribute('data-mixed', `value with "quotes"`);
      div.setAttribute('data-single', 'new value');

      expect(div.getAttribute('data-mixed')).toBe(`value with "quotes"`);
      expect(div.getAttribute('data-single')).toBe('new value');
    });
  });

  describe('Trim Operations with Modifications', () => {
    test('should handle modifications after trim', () => {
      const html = new HtmlMod('   <div>content</div>   ');
      html.trim();

      const div = html.querySelector('div')!;
      div.innerHTML = 'modified';

      expect(html.toString()).toBe('<div>modified</div>');
    });

    test('should handle modifications after trimStart', () => {
      const html = new HtmlMod('   <div>content</div>');
      html.trimStart();

      const div = html.querySelector('div')!;
      div.innerHTML = 'modified';

      expect(html.toString()).toBe('<div>modified</div>');
    });

    test('should handle modifications after trimEnd', () => {
      const html = new HtmlMod('<div>content</div>   ');
      html.trimEnd();

      const div = html.querySelector('div')!;
      div.innerHTML = 'modified';

      expect(html.toString()).toBe('<div>modified</div>');
    });

    test('should handle multiple trim and modification operations', () => {
      const html = new HtmlMod('   <div>content</div>   ');
      html.trim();

      const div = html.querySelector('div')!;
      div.innerHTML = 'first';

      div.innerHTML = 'second';
      div.innerHTML = 'third';

      expect(html.toString()).toBe('<div>third</div>');
    });
  });

  describe('Additional Edge Cases - Comprehensive Coverage', () => {
    test('should handle multiple consecutive setAttribute calls', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      div.setAttribute('a', '1');
      div.setAttribute('b', '2');
      div.setAttribute('c', '3');
      div.setAttribute('d', '4');
      div.setAttribute('e', '5');

      expect(html.toString()).toBe('<div a="1" b="2" c="3" d="4" e="5">content</div>');
      expect(div.getAttribute('a')).toBe('1');
      expect(div.getAttribute('b')).toBe('2');
      expect(div.getAttribute('c')).toBe('3');
      expect(div.getAttribute('d')).toBe('4');
      expect(div.getAttribute('e')).toBe('5');
    });

    test('should handle removing then re-adding attributes', () => {
      const html = new HtmlMod('<div a="1" b="2" c="3">content</div>');
      const div = html.querySelector('div')!;

      div.removeAttribute('b');
      expect(html.toString()).toBe('<div a="1" c="3">content</div>');

      div.setAttribute('b', 'new-value');
      expect(html.toString()).toBe('<div a="1" c="3" b="new-value">content</div>');
      expect(div.getAttribute('b')).toBe('new-value');

      div.removeAttribute('a');
      div.setAttribute('a', 'another-value');
      expect(html.toString()).toBe('<div c="3" b="new-value" a="another-value">content</div>');
    });

    test('should handle multiple text nodes in same parent', () => {
      const html = new HtmlMod('<div>text1<span>middle</span>text2</div>');
      const div = html.querySelector('div')!;

      // Get all text nodes
      const children = div.children;
      const textNodes = children.filter(child => child instanceof HtmlModText) as HtmlModText[];

      expect(textNodes.length).toBe(2);

      // Modify first text node
      textNodes[0].textContent = 'modified1';
      expect(html.toString()).toBe('<div>modified1<span>middle</span>text2</div>');

      // Modify second text node
      textNodes[1].textContent = 'modified2';
      expect(html.toString()).toBe('<div>modified1<span>middle</span>modified2</div>');

      // Modify first again
      textNodes[0].textContent = 'final1';
      expect(html.toString()).toBe('<div>final1<span>middle</span>modified2</div>');
    });

    test('should handle self-closing tag conversion followed by more attributes', () => {
      const html = new HtmlMod('<img/>');
      const img = html.querySelector('img')!;

      // Add content (converts to regular tag)
      img.innerHTML = '<span>content</span>';
      expect(html.toString()).toBe('<img><span>content</span></img>');

      // Add attributes after conversion
      img.setAttribute('a', '1');
      expect(html.toString()).toBe('<img a="1"><span>content</span></img>');

      img.setAttribute('b', '2');
      expect(html.toString()).toBe('<img a="1" b="2"><span>content</span></img>');

      // Modify content again
      img.innerHTML = 'text content';
      expect(html.toString()).toBe('<img a="1" b="2">text content</img>');

      // Add more attributes
      img.setAttribute('c', '3');
      expect(html.toString()).toBe('<img a="1" b="2" c="3">text content</img>');
    });

    test('should handle sibling element modifications in sequence', () => {
      const html = new HtmlMod('<div><p id="p1">text1</p><p id="p2">text2</p><p id="p3">text3</p></div>');

      const p1 = html.querySelector('#p1')!;
      const p2 = html.querySelector('#p2')!;
      const p3 = html.querySelector('#p3')!;

      // Modify p1
      p1.innerHTML = 'modified1';
      p1.setAttribute('data', 'value1');
      expect(html.querySelector('#p1')!.innerHTML).toBe('modified1');

      // Modify p2
      p2.innerHTML = 'modified2';
      p2.setAttribute('data', 'value2');
      expect(html.querySelector('#p2')!.innerHTML).toBe('modified2');

      // Modify p3
      p3.innerHTML = 'modified3';
      p3.setAttribute('data', 'value3');
      expect(html.querySelector('#p3')!.innerHTML).toBe('modified3');

      // Modify p1 again
      p1.innerHTML = 'final1';
      expect(html.querySelector('#p1')!.innerHTML).toBe('final1');

      // Verify all are correct
      expect(html.toString()).toBe(
        '<div><p id="p1" data="value1">final1</p><p id="p2" data="value2">modified2</p><p id="p3" data="value3">modified3</p></div>'
      );
    });

    test('should handle very large attribute values', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      // Create a large attribute value (10KB)
      const largeValue = 'x'.repeat(10_000);
      div.setAttribute('data', largeValue);

      expect(html.toString()).toContain(`data="${largeValue}"`);
      expect(div.getAttribute('data')).toBe(largeValue);

      // Modify content after large attribute
      div.innerHTML = 'modified';
      expect(html.querySelector('div')!.innerHTML).toBe('modified');

      // Add another attribute
      div.setAttribute('other', 'value');
      expect(div.getAttribute('other')).toBe('value');
    });

    test('should handle unicode and emoji in content', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      // Set emoji content
      div.innerHTML = '🎉🔥💯';
      expect(html.toString()).toBe('<div>🎉🔥💯</div>');

      // Add attribute
      div.setAttribute('data', '🌟');
      expect(html.toString()).toBe('<div data="🌟">🎉🔥💯</div>');

      // Modify with mixed unicode
      div.innerHTML = 'Hello 世界 🌍';
      expect(html.toString()).toBe('<div data="🌟">Hello 世界 🌍</div>');
      expect(div.innerHTML).toBe('Hello 世界 🌍');
    });

    test('should handle removeAttribute on non-existent attribute', () => {
      const html = new HtmlMod('<div a="1">content</div>');
      const div = html.querySelector('div')!;

      // Remove non-existent attribute (should not error)
      div.removeAttribute('nonexistent');
      expect(html.toString()).toBe('<div a="1">content</div>');

      // Add and then remove
      div.setAttribute('b', '2');
      expect(html.toString()).toBe('<div a="1" b="2">content</div>');

      div.removeAttribute('nonexistent');
      expect(html.toString()).toBe('<div a="1" b="2">content</div>');

      // Normal remove
      div.removeAttribute('a');
      expect(html.toString()).toBe('<div b="2">content</div>');
    });

    test('should handle nested setAttribute (parent then child then parent)', () => {
      const html = new HtmlMod('<div><p><span>content</span></p></div>');

      const div = html.querySelector('div')!;
      const p = html.querySelector('p')!;
      const span = html.querySelector('span')!;

      // Modify parent
      div.setAttribute('a', '1');
      expect(html.toString()).toBe('<div a="1"><p><span>content</span></p></div>');

      // Modify child
      p.setAttribute('b', '2');
      expect(html.toString()).toBe('<div a="1"><p b="2"><span>content</span></p></div>');

      // Modify grandchild
      span.setAttribute('c', '3');
      expect(html.toString()).toBe('<div a="1"><p b="2"><span c="3">content</span></p></div>');

      // Modify parent again
      div.setAttribute('d', '4');
      expect(html.toString()).toBe('<div a="1" d="4"><p b="2"><span c="3">content</span></p></div>');

      // Modify child again
      p.setAttribute('e', '5');
      expect(html.toString()).toBe('<div a="1" d="4"><p b="2" e="5"><span c="3">content</span></p></div>');
    });

    test('should handle replaceWith followed by modifications', () => {
      const html = new HtmlMod('<div><p>old</p></div>');
      const p = html.querySelector('p')!;

      // Replace element
      p.replaceWith('<span id="new">replacement</span>');
      expect(html.toString()).toBe('<div><span id="new">replacement</span></div>');

      // Modify the replacement
      const span = html.querySelector('#new')!;
      span.innerHTML = 'modified';
      expect(html.toString()).toBe('<div><span id="new">modified</span></div>');

      // Add attribute to replacement
      span.setAttribute('data', 'value');
      expect(html.toString()).toBe('<div><span id="new" data="value">modified</span></div>');

      // Replace again
      span.replaceWith('<article>final</article>');
      expect(html.toString()).toBe('<div><article>final</article></div>');

      // Modify the new replacement
      const article = html.querySelector('article')!;
      article.setAttribute('class', 'test');
      expect(html.toString()).toBe('<div><article class="test">final</article></div>');
    });
  });

  describe('Attribute Edge Cases - Advanced', () => {
    test('should handle data-* attributes', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      div.setAttribute('data-id', '123');
      div.setAttribute('data-name', 'test');
      div.setAttribute('data-complex-name', 'value');

      expect(html.toString()).toBe('<div data-id="123" data-name="test" data-complex-name="value">content</div>');
      expect(div.getAttribute('data-id')).toBe('123');
      expect(div.getAttribute('data-name')).toBe('test');
    });

    test('should handle aria-* attributes', () => {
      const html = new HtmlMod('<button>Click me</button>');
      const button = html.querySelector('button')!;

      button.setAttribute('aria-label', 'Submit button');
      button.setAttribute('aria-hidden', 'false');

      expect(html.toString()).toBe('<button aria-label="Submit button" aria-hidden="false">Click me</button>');
      expect(button.getAttribute('aria-label')).toBe('Submit button');
    });

    test('should handle boolean-like attributes', () => {
      const html = new HtmlMod('<input type="checkbox">');
      const input = html.querySelector('input')!;

      input.setAttribute('checked', '');
      input.setAttribute('disabled', '');
      expect(input.getAttribute('checked')).toBe('');
      expect(input.getAttribute('disabled')).toBe('');

      input.removeAttribute('checked');
      expect(input.getAttribute('checked')).toBeNull();
      expect(input.getAttribute('disabled')).toBe('');
    });

    test('should handle attributes containing quotes in values', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      div.setAttribute('data-json', '{"key":"value"}');
      // Library switches to single quotes when value contains double quotes
      expect(html.toString()).toBe('<div data-json=\'{"key":"value"}\'>content</div>');

      div.setAttribute('title', "It's a test");
      expect(div.getAttribute('title')).toBe("It's a test");
    });

    test('should handle switching between quote types', () => {
      const html = new HtmlMod('<div class="test">content</div>');
      const div = html.querySelector('div')!;

      div.setAttribute('class', 'modified');
      expect(div.getAttribute('class')).toBe('modified');

      div.setAttribute('id', 'no-quotes');
      expect(div.getAttribute('id')).toBe('no-quotes');
    });

    test('should handle attributes with special characters', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      div.setAttribute('data-url', 'https://example.com?foo=bar&baz=qux');
      expect(div.getAttribute('data-url')).toBe('https://example.com?foo=bar&baz=qux');

      div.setAttribute('data-special', '<>&"\'');
      expect(div.getAttribute('data-special')).toBe('<>&"\'');
    });
  });

  describe('Special Node Types', () => {
    test('should handle comment nodes without modification', () => {
      const html = new HtmlMod('<div><!-- comment --><p>text</p></div>');
      const div = html.querySelector('div')!;

      div.setAttribute('id', 'test');
      expect(html.toString()).toBe('<div id="test"><!-- comment --><p>text</p></div>');

      const p = html.querySelector('p')!;
      p.innerHTML = 'modified';
      expect(html.toString()).toBe('<div id="test"><!-- comment --><p>modified</p></div>');
    });

    test('should handle multiple comment nodes', () => {
      const html = new HtmlMod('<!-- start --><div>content</div><!-- end -->');
      const div = html.querySelector('div')!;

      div.innerHTML = 'modified';
      expect(html.toString()).toBe('<!-- start --><div>modified</div><!-- end -->');
    });

    test('should handle script tags with inline JavaScript', () => {
      const html = new HtmlMod('<div><script>console.log("test");</script></div>');
      const div = html.querySelector('div')!;

      div.setAttribute('id', 'container');
      expect(html.toString()).toBe('<div id="container"><script>console.log("test");</script></div>');

      div.prepend('<p>Before script</p>');
      expect(html.querySelector('p')!.innerHTML).toBe('Before script');
    });

    test('should handle style tags with inline CSS', () => {
      const html = new HtmlMod('<div><style>.test { color: red; }</style><p>text</p></div>');
      const _div = html.querySelector('div')!;
      const p = html.querySelector('p')!;

      p.innerHTML = 'modified';
      expect(html.toString()).toBe('<div><style>.test { color: red; }</style><p>modified</p></div>');
    });

    test('should handle nested comments', () => {
      const html = new HtmlMod('<!-- outer <!-- inner --> --><div>content</div>');
      const div = html.querySelector('div')!;

      div.innerHTML = 'modified';
      expect(html.toString()).toContain('<div>modified</div>');
    });
  });

  describe('Complex Tree Manipulations', () => {
    test('should handle moving elements between parents', () => {
      const html = new HtmlMod('<div id="source"><p>moveme</p></div><div id="target"></div>');
      const p = html.querySelector('p')!;
      const target = html.querySelector('#target')!;

      const pHTML = p.outerHTML;
      p.remove();
      target.innerHTML = pHTML;

      expect(html.querySelector('#source')!.innerHTML).toBe('');
      expect(html.querySelector('#target p')!.innerHTML).toBe('moveme');
    });

    test('should handle swapping element content', () => {
      const html = new HtmlMod('<div id="a">contentA</div><div id="b">contentB</div>');
      const a = html.querySelector('#a')!;
      const b = html.querySelector('#b')!;

      const temporaryA = a.innerHTML;
      a.innerHTML = b.innerHTML;
      b.innerHTML = temporaryA;

      expect(html.querySelector('#a')!.innerHTML).toBe('contentB');
      expect(html.querySelector('#b')!.innerHTML).toBe('contentA');
    });

    test('should handle deeply nested modifications (20 levels)', () => {
      let nested = '<div>';
      for (let index = 0; index < 20; index++) {
        nested += `<div class="level-${index}">`;
      }
      nested += 'deep content';
      for (let index = 0; index < 20; index++) {
        nested += '</div>';
      }
      nested += '</div>';

      const html = new HtmlMod(nested);
      const deepest = html.querySelector('.level-19')!;
      deepest.innerHTML = 'modified deep content';

      expect(html.toString()).toContain('modified deep content');
      expect(html.querySelector('.level-0')).not.toBeNull();
    });

    test('should handle flattening nested structure', () => {
      const html = new HtmlMod('<div><div><div><p>nested</p></div></div></div>');
      const outer = html.querySelector('div')!;
      const p = html.querySelector('p')!;

      outer.innerHTML = p.outerHTML;
      expect(html.toString()).toBe('<div><p>nested</p></div>');
    });

    test('should handle circular-like operations', () => {
      const html = new HtmlMod('<div id="a"><span>A</span></div><div id="b"><span>B</span></div>');
      const a = html.querySelector('#a')!;
      const b = html.querySelector('#b')!;

      const spanA = a.querySelector('span')!.outerHTML;
      const spanB = b.querySelector('span')!.outerHTML;

      a.innerHTML = spanB;
      b.innerHTML = spanA;

      expect(html.querySelector('#a span')!.innerHTML).toBe('B');
      expect(html.querySelector('#b span')!.innerHTML).toBe('A');
    });

    test('should handle element duplication', () => {
      const html = new HtmlMod('<div id="template"><p>template</p></div><div id="container"></div>');
      const template = html.querySelector('#template p')!;
      const container = html.querySelector('#container')!;

      const clone1 = template.outerHTML;
      const clone2 = template.outerHTML;
      container.innerHTML = clone1 + clone2;

      expect(html.querySelectorAll('#container p').length).toBe(2);
    });
  });

  describe('Whitespace Handling', () => {
    test('should preserve whitespace in content', () => {
      const html = new HtmlMod('<div>text   with    spaces</div>');
      const div = html.querySelector('div')!;

      div.setAttribute('id', 'test');
      expect(html.toString()).toBe('<div id="test">text   with    spaces</div>');
    });

    test('should handle newlines in content', () => {
      const html = new HtmlMod('<div>line1\nline2\nline3</div>');
      const div = html.querySelector('div')!;

      div.setAttribute('class', 'multiline');
      expect(html.toString()).toBe('<div class="multiline">line1\nline2\nline3</div>');
    });

    test('should handle tabs in content', () => {
      const html = new HtmlMod('<div>text\twith\ttabs</div>');
      const div = html.querySelector('div')!;

      div.innerHTML = 'new\tcontent\twith\ttabs';
      expect(html.toString()).toBe('<div>new\tcontent\twith\ttabs</div>');
    });

    test('should handle whitespace-only text nodes', () => {
      const html = new HtmlMod('<div>   </div>');
      const div = html.querySelector('div')!;

      div.setAttribute('data-empty', 'false');
      expect(html.toString()).toBe('<div data-empty="false">   </div>');
    });

    test('should handle mixed whitespace', () => {
      const html = new HtmlMod('<div> \n\t text \n\t </div>');
      const div = html.querySelector('div')!;

      div.setAttribute('id', 'mixed');
      expect(html.toString()).toContain(' \n\t text \n\t ');
    });
  });

  describe('Stale References', () => {
    test('should handle element reference after parent removal', () => {
      const html = new HtmlMod('<div><p id="child">text</p></div>');
      const _p = html.querySelector('#child')!;
      const div = html.querySelector('div')!;

      div.remove();

      // Element reference still exists, parent reference remains but is stale
      // The parent is no longer in the document
      expect(html.querySelector('#child')).toBeNull();
      expect(html.querySelector('div')).toBeNull();
    });

    test('should handle querying during modifications', () => {
      const html = new HtmlMod('<div><p>text1</p><p>text2</p></div>');
      const div = html.querySelector('div')!;

      div.innerHTML = '<span>modified</span>';

      // Query after modification should find new content
      expect(html.querySelector('span')!.innerHTML).toBe('modified');
      expect(html.querySelector('p')).toBeNull();
    });

    test('should handle multiple references to same element', () => {
      const html = new HtmlMod('<div id="test">content</div>');
      const ref1 = html.querySelector('#test')!;
      const ref2 = html.querySelector('#test')!;

      ref1.innerHTML = 'modified1';
      expect(ref2.innerHTML).toBe('modified1');

      ref2.setAttribute('data-ref', '2');
      expect(ref1.getAttribute('data-ref')).toBe('2');
    });

    test('should handle element after sibling removal', () => {
      const html = new HtmlMod('<div><p id="p1">first</p><p id="p2">second</p></div>');
      const p1 = html.querySelector('#p1')!;
      const p2 = html.querySelector('#p2')!;

      p1.remove();
      p2.innerHTML = 'still works';

      expect(html.toString()).toBe('<div><p id="p2">still works</p></div>');
    });

    test('should handle modification of removed element', () => {
      const html = new HtmlMod('<div><p>text</p></div>');
      const p = html.querySelector('p')!;
      const _originalOuterHTML = p.outerHTML;

      p.remove();

      // Element reference still exists and can be queried
      // But it's no longer in the document
      expect(html.querySelector('p')).toBeNull();
      expect(html.toString()).toBe('<div></div>');

      // The removed element still has its original content
      expect(p.innerHTML).toBe('text');
    });
  });

  describe('Real-World Patterns', () => {
    test('should handle building complete HTML document from scratch', () => {
      const html = new HtmlMod('<html></html>');
      const root = html.querySelector('html')!;

      root.innerHTML = '<head><title>Test</title></head><body></body>';

      const body = html.querySelector('body')!;
      body.innerHTML = '<div id="app"><h1>Hello</h1><p>World</p></div>';

      expect(html.toString()).toBe(
        '<html><head><title>Test</title></head><body><div id="app"><h1>Hello</h1><p>World</p></div></body></html>'
      );
    });

    test('should handle template rendering pattern', () => {
      const html = new HtmlMod('<div id="list"></div>');
      const list = html.querySelector('#list')!;

      const items = ['Item 1', 'Item 2', 'Item 3'];
      const rendered = items.map(item => `<li>${item}</li>`).join('');
      list.innerHTML = `<ul>${rendered}</ul>`;

      expect(html.querySelectorAll('li').length).toBe(3);
      expect(html.querySelector('li')!.innerHTML).toBe('Item 1');
    });

    test('should handle form manipulation', () => {
      const html = new HtmlMod('<form></form>');
      const form = html.querySelector('form')!;

      form.innerHTML = '<input type="text" name="username"><input type="password" name="password">';
      form.setAttribute('action', '/submit');
      form.setAttribute('method', 'post');

      const inputs = html.querySelectorAll('input');
      expect(inputs.length).toBe(2);
      expect(form.getAttribute('action')).toBe('/submit');
    });

    test('should handle table row insertion pattern', () => {
      const html = new HtmlMod('<table><tbody></tbody></table>');
      const tbody = html.querySelector('tbody')!;

      const rows = ['A', 'B', 'C'];
      for (const row of rows) {
        const currentHTML = tbody.innerHTML;
        tbody.innerHTML = currentHTML + `<tr><td>${row}</td></tr>`;
      }

      expect(html.querySelectorAll('tr').length).toBe(3);
      expect(html.querySelectorAll('td')[0].innerHTML).toBe('A');
    });

    test('should handle progressive content building', () => {
      const html = new HtmlMod('<div class="container"></div>');
      const container = html.querySelector('.container')!;

      // Build content step by step
      container.innerHTML = '<header></header>';
      const header = html.querySelector('header')!;
      header.innerHTML = '<h1>Title</h1>';

      container.append('<main></main>');
      const main = html.querySelector('main')!;
      main.innerHTML = '<p>Content</p>';

      container.append('<footer></footer>');
      const footer = html.querySelector('footer')!;
      footer.innerHTML = '<p>Footer</p>';

      expect(html.querySelectorAll('p').length).toBe(2);
      expect(html.toString()).toContain('<header><h1>Title</h1></header>');
    });

    test('should handle conditional rendering pattern', () => {
      const html = new HtmlMod('<div id="root"></div>');
      const root = html.querySelector('#root')!;

      const showContent = true;
      root.innerHTML = showContent ? '<p>Visible</p>' : '<p>Hidden</p>';
      expect(html.toString()).toContain('Visible');

      const showContent2 = false;
      root.innerHTML = showContent2 ? '<p>Visible</p>' : '<p>Hidden</p>';
      expect(html.toString()).toContain('Hidden');
    });
  });

  describe('Performance Edge Cases', () => {
    test('should handle 1000 elements with modifications', () => {
      const items = Array.from({ length: 1000 }, (_, index) => `<div class="item-${index}">${index}</div>`).join('');
      const html = new HtmlMod(`<div id="container">${items}</div>`);

      const container = html.querySelector('#container')!;
      container.setAttribute('data-count', '1000');

      expect(html.querySelectorAll('div[class^="item-"]').length).toBe(1000);
      expect(container.getAttribute('data-count')).toBe('1000');
    });

    test('should handle 50 levels of nesting', () => {
      let nested = '';
      for (let index = 0; index < 50; index++) {
        nested += `<div class="level-${index}">`;
      }
      nested += 'deep content';
      for (let index = 0; index < 50; index++) {
        nested += '</div>';
      }

      const html = new HtmlMod(nested);
      const deepest = html.querySelector('.level-49')!;
      deepest.innerHTML = 'modified';

      expect(html.toString()).toContain('modified');
    });

    test('should handle attribute with 50KB value', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      const largeValue = 'x'.repeat(50_000);
      div.setAttribute('data-large', largeValue);

      expect(div.getAttribute('data-large')).toBe(largeValue);
      expect(html.toString().length).toBeGreaterThan(50_000);
    });

    test('should handle 1000 rapid sequential modifications', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      for (let index = 0; index < 1000; index++) {
        div.setAttribute(`data-${index}`, `value-${index}`);
      }

      expect(div.getAttribute('data-0')).toBe('value-0');
      expect(div.getAttribute('data-999')).toBe('value-999');
    });

    test('should handle alternating modifications 500 times', () => {
      const html = new HtmlMod('<div>initial</div>');
      const div = html.querySelector('div')!;

      for (let index = 0; index < 500; index++) {
        div.innerHTML = `content-${index}`;
        div.setAttribute('data-iteration', `${index}`);
      }

      expect(div.innerHTML).toBe('content-499');
      expect(div.getAttribute('data-iteration')).toBe('499');
    });
  });

  describe('Error Recovery and Edge Cases', () => {
    test('should handle innerHTML with unclosed tags', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      div.innerHTML = '<p>unclosed';
      // Parser should handle it gracefully
      expect(html.toString()).toContain('<p>unclosed');
    });

    test('should handle empty string operations', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      div.innerHTML = '';
      expect(html.toString()).toBe('<div></div>');

      div.setAttribute('empty', '');
      expect(html.toString()).toBe('<div empty=""></div>');
    });

    test('should handle repeated remove operations', () => {
      const html = new HtmlMod('<div><p>text</p></div>');
      const p = html.querySelector('p')!;

      p.remove();
      // Removing again should not error
      p.remove();

      expect(html.toString()).toBe('<div></div>');
    });

    test('should handle malformed nested tags', () => {
      const html = new HtmlMod('<div><p>text</div></p>');
      const div = html.querySelector('div')!;

      div.setAttribute('id', 'test');
      // Should handle gracefully
      expect(html.toString()).toContain('id="test"');
    });

    test('should handle very long text content', () => {
      const html = new HtmlMod('<div>short</div>');
      const div = html.querySelector('div')!;

      const longText = 'a'.repeat(100_000);
      div.innerHTML = longText;

      expect(div.innerHTML.length).toBe(100_000);
    });

    test('should handle consecutive identical modifications', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      div.innerHTML = 'same';
      div.innerHTML = 'same';
      div.innerHTML = 'same';

      expect(html.toString()).toBe('<div>same</div>');
    });

    test('should handle attribute name with unusual characters', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      div.setAttribute('data-my:attr', 'value');
      expect(div.getAttribute('data-my:attr')).toBe('value');
    });
  });

  describe('Clone Behavior with Modifications', () => {
    test('should clone element and verify original and clone are independent', () => {
      const html = new HtmlMod('<div id="original">content</div>');
      const original = html.querySelector('#original')!;
      const clone = original.clone();

      // Modify original
      original.setAttribute('data-modified', 'true');
      original.innerHTML = 'modified content';

      // Clone should be unchanged
      expect(clone.getAttribute('data-modified')).toBeNull();
      expect(clone.innerHTML).toBe('content');

      // Original should be modified
      expect(original.getAttribute('data-modified')).toBe('true');
      expect(original.innerHTML).toBe('modified content');
    });

    test('should clone element, modify clone, verify original unchanged', () => {
      const html = new HtmlMod('<div id="original">content</div>');
      const original = html.querySelector('#original')!;
      const clone = original.clone();

      // Modify clone
      clone.setAttribute('id', 'cloned');
      clone.innerHTML = 'cloned content';

      // Original in document should be unchanged
      expect(html.querySelector('#original')!.innerHTML).toBe('content');
      expect(html.querySelector('#original')!.getAttribute('id')).toBe('original');
    });

    test('should clone after removal', () => {
      const html = new HtmlMod('<div id="test">content</div>');
      const element = html.querySelector('#test')!;

      element.remove();
      const clone = element.clone();

      // Clone should have the cached content
      expect(clone.innerHTML).toBe('content');
      expect(clone.getAttribute('id')).toBe('test');
    });

    test('should clone nested structure', () => {
      const html = new HtmlMod('<div id="outer"><p id="inner">text</p></div>');
      const outer = html.querySelector('#outer')!;
      const clone = outer.clone();

      // Modify original
      outer.setAttribute('data-test', 'value');
      html.querySelector('#inner')!.innerHTML = 'modified';

      // Clone should be unchanged
      expect(clone.getAttribute('data-test')).toBeNull();
      expect(clone.innerHTML).toBe('<p id="inner">text</p>');
    });

    test('should handle multiple clones of same element', () => {
      const html = new HtmlMod('<div>original</div>');
      const original = html.querySelector('div')!;

      const clone1 = original.clone();
      const clone2 = original.clone();
      const clone3 = original.clone();

      // Modify original
      original.innerHTML = 'modified';

      // All clones should be independent
      expect(clone1.innerHTML).toBe('original');
      expect(clone2.innerHTML).toBe('original');
      expect(clone3.innerHTML).toBe('original');
    });

    test('should clone document and verify independence', () => {
      const html = new HtmlMod('<div id="test">content</div>');
      const clone = html.clone();

      // Modify original
      const div = html.querySelector('#test')!;
      div.innerHTML = 'modified';

      // Clone should be unchanged
      expect(clone.toString()).toBe('<div id="test">content</div>');
    });
  });

  describe('replaceWith Edge Cases', () => {
    test('should replace element and verify old reference behaves as removed', () => {
      const html = new HtmlMod('<div><p>old</p></div>');
      const p = html.querySelector('p')!;
      const originalInnerHTML = p.innerHTML;

      p.replaceWith('<span>new</span>');

      // Old reference should behave as removed
      expect(html.querySelector('p')).toBeNull();
      expect(html.querySelector('span')!.innerHTML).toBe('new');

      // Old reference should have cached content
      expect(p.innerHTML).toBe(originalInnerHTML);
    });

    test('should replace parent while holding child reference', () => {
      const html = new HtmlMod('<div id="parent"><p id="child">text</p></div>');
      const parent = html.querySelector('#parent')!;
      const child = html.querySelector('#child')!;

      parent.replaceWith('<section id="new">new content</section>');

      // Child reference should behave as removed
      expect(html.querySelector('#child')).toBeNull();
      expect(html.querySelector('#new')!.innerHTML).toBe('new content');

      // Child should have cached content
      expect(child.innerHTML).toBe('text');
    });

    test('should replace with empty string', () => {
      const html = new HtmlMod('<div><p>text</p></div>');
      const p = html.querySelector('p')!;

      p.replaceWith('');

      expect(html.toString()).toBe('<div></div>');
    });

    test('should replace with multiple elements', () => {
      const html = new HtmlMod('<div><p>old</p></div>');
      const p = html.querySelector('p')!;

      p.replaceWith('<span>1</span><span>2</span><span>3</span>');

      expect(html.querySelectorAll('span').length).toBe(3);
      expect(html.querySelector('p')).toBeNull();
    });

    test('should chain replaceWith operations', () => {
      const html = new HtmlMod('<div><a>link</a></div>');
      const a = html.querySelector('a')!;

      a.replaceWith('<button>btn</button>');

      const button = html.querySelector('button')!;
      button.replaceWith('<input type="submit" />');

      expect(html.querySelector('input')).not.toBeNull();
      expect(html.querySelector('button')).toBeNull();
      expect(html.querySelector('a')).toBeNull();
    });

    test('should replace with complex nested structure', () => {
      const html = new HtmlMod('<div><p>simple</p></div>');
      const p = html.querySelector('p')!;

      p.replaceWith('<section><article><h1>Title</h1><p>Content</p></article></section>');

      expect(html.querySelector('section article h1')!.innerHTML).toBe('Title');
      expect(html.querySelector('section article p')!.innerHTML).toBe('Content');
    });

    test('should not error when replacing already removed element', () => {
      const html = new HtmlMod('<div><p>text</p></div>');
      const p = html.querySelector('p')!;

      p.remove();
      p.replaceWith('<span>new</span>');

      // Should be no-op since element is removed
      expect(html.toString()).toBe('<div></div>');
      expect(html.querySelector('span')).toBeNull();
    });
  });

  describe('Text Node Operations', () => {
    test('should modify text node content', () => {
      const html = new HtmlMod('<div>text content</div>');
      const div = html.querySelector('div')!;
      const textNode = div.children[0];

      if (textNode instanceof HtmlModText) {
        textNode.textContent = 'modified text';
        expect(html.toString()).toBe('<div>modified text</div>');
      }
    });

    test('should handle multiple text nodes', () => {
      const html = new HtmlMod('<div>text1<span>middle</span>text2</div>');
      const div = html.querySelector('div')!;

      // Should have 3 children: text, span, text
      expect(div.children.length).toBe(3);
    });

    test('should modify text node innerHTML', () => {
      const html = new HtmlMod('<div>plain text</div>');
      const div = html.querySelector('div')!;
      const textNode = div.children[0];

      if (textNode instanceof HtmlModText) {
        textNode.innerHTML = '<b>bold</b>';
        // After modifying text node innerHTML, check the div contains the new content
        expect(html.toString()).toContain('<b>bold</b>');
      }
    });

    test('should handle text node with special characters', () => {
      const html = new HtmlMod('<div>&lt;test&gt;</div>');
      const div = html.querySelector('div')!;

      // textContent decodes HTML entities
      expect(div.textContent).toBe('<test>');
    });

    test('should handle empty text nodes', () => {
      const html = new HtmlMod('<div><span></span></div>');
      const div = html.querySelector('div')!;

      // Should handle gracefully
      expect(div.children.length).toBeGreaterThanOrEqual(1);
    });

    test('should modify text content after element modifications', () => {
      const html = new HtmlMod('<div>text</div>');
      const div = html.querySelector('div')!;

      div.setAttribute('id', 'test');
      div.textContent = 'new text';

      expect(html.toString()).toBe('<div id="test">new text</div>');
    });

    test('should handle text node toString', () => {
      const html = new HtmlMod('<div>text content</div>');
      const div = html.querySelector('div')!;
      const textNode = div.children[0];

      if (textNode instanceof HtmlModText) {
        expect(textNode.toString()).toBe('text content');
      }
    });
  });

  describe('Parent/Child Reference Integrity', () => {
    test('should get child reference, remove parent, verify child behaves as removed', () => {
      const html = new HtmlMod('<div id="parent"><p id="child">text</p></div>');
      const parent = html.querySelector('#parent')!;
      const child = html.querySelector('#child')!;

      parent.remove();

      // Child should not be queryable in document
      expect(html.querySelector('#child')).toBeNull();
      expect(html.querySelector('#parent')).toBeNull();

      // Child reference should have cached content
      expect(child.innerHTML).toBe('text');
    });

    test('should get parent reference, remove child, verify parent still works', () => {
      const html = new HtmlMod('<div id="parent"><p id="child">text</p></div>');
      const parent = html.querySelector('#parent')!;
      const child = html.querySelector('#child')!;

      child.remove();

      // Parent should still be queryable and modifiable
      expect(html.querySelector('#parent')).not.toBeNull();
      parent.setAttribute('data-test', 'value');
      expect(html.querySelector('#parent')!.getAttribute('data-test')).toBe('value');
      expect(html.toString()).toBe('<div id="parent" data-test="value"></div>');
    });

    test('should verify parent getter returns wrapped element', () => {
      const html = new HtmlMod('<div><p><span>text</span></p></div>');
      const span = html.querySelector('span')!;
      const parent = span.parent;

      expect(parent).not.toBeNull();
      expect(parent!.tagName).toBe('p');

      // Parent should be modifiable
      parent!.setAttribute('id', 'test');
      expect(html.querySelector('#test')!.tagName).toBe('p');
    });

    test('should handle multiple levels of parent references', () => {
      const html = new HtmlMod('<div id="grandparent"><section id="parent"><p id="child">text</p></section></div>');
      const child = html.querySelector('#child')!;

      const parent = child.parent;
      expect(parent!.id).toBe('parent');

      const grandparent = parent!.parent;
      expect(grandparent!.id).toBe('grandparent');
    });

    test('should handle parent reference after parent modification', () => {
      const html = new HtmlMod('<div><p><span>text</span></p></div>');
      const span = html.querySelector('span')!;

      const parent = span.parent!;
      parent.setAttribute('class', 'modified');

      // Re-get parent reference
      const parent2 = span.parent!;
      expect(parent2.getAttribute('class')).toBe('modified');
    });

    test('should handle sibling modifications', () => {
      const html = new HtmlMod('<div><p id="first">1</p><p id="second">2</p><p id="third">3</p></div>');
      const _first = html.querySelector('#first')!;
      const second = html.querySelector('#second')!;
      const _third = html.querySelector('#third')!;

      second.remove();

      // First and third should still work
      expect(html.querySelector('#first')!.innerHTML).toBe('1');
      expect(html.querySelector('#third')!.innerHTML).toBe('3');
      expect(html.querySelector('#second')).toBeNull();
    });
  });

  describe('Children Getter Modifications', () => {
    test('should get children and modify elements through array', () => {
      const html = new HtmlMod('<div><p>1</p><p>2</p><p>3</p></div>');
      const div = html.querySelector('div')!;
      const children = div.children;

      expect(children.length).toBe(3);

      // Modify through children array
      const firstChild = children[0];
      if (firstChild instanceof HtmlModElement) {
        firstChild.innerHTML = 'modified';
      }
      expect(html.querySelectorAll('p')[0].innerHTML).toBe('modified');
    });

    test('should get children before and after innerHTML changes', () => {
      const html = new HtmlMod('<div><p>original</p></div>');
      const div = html.querySelector('div')!;

      const childrenBefore = div.children;
      expect(childrenBefore.length).toBe(1);

      div.innerHTML = '<p>1</p><p>2</p><p>3</p>';

      const childrenAfter = div.children;
      expect(childrenAfter.length).toBe(3);
    });

    test('should handle children array with mixed element and text nodes', () => {
      const html = new HtmlMod('<div>text1<span>element</span>text2</div>');
      const div = html.querySelector('div')!;
      const children = div.children;

      // Should include both text and element nodes
      expect(children.length).toBe(3);
    });

    test('should modify children after parent attribute change', () => {
      const html = new HtmlMod('<div><p>content</p></div>');
      const div = html.querySelector('div')!;

      div.setAttribute('class', 'parent');
      const children = div.children;

      const firstChild = children[0];
      if (firstChild instanceof HtmlModElement) {
        firstChild.innerHTML = 'modified';
      }
      expect(html.toString()).toBe('<div class="parent"><p>modified</p></div>');
    });

    test('should handle empty children array', () => {
      const html = new HtmlMod('<div></div>');
      const div = html.querySelector('div')!;

      expect(div.children.length).toBe(0);
    });

    test('should remove child through children array', () => {
      const html = new HtmlMod('<div><p>1</p><p>2</p><p>3</p></div>');
      const div = html.querySelector('div')!;
      const children = div.children;

      const secondChild = children[1];
      if (secondChild instanceof HtmlModElement) {
        secondChild.remove();
      }

      expect(html.querySelectorAll('p').length).toBe(2);
      expect(html.querySelectorAll('p')[0].innerHTML).toBe('1');
      expect(html.querySelectorAll('p')[1].innerHTML).toBe('3');
    });
  });

  describe('querySelector After Complex Modifications', () => {
    test('should query after multiple nested innerHTML changes', () => {
      const html = new HtmlMod('<div id="root"></div>');
      const root = html.querySelector('#root')!;

      root.innerHTML = '<section><article></article></section>';
      const article = html.querySelector('article')!;
      article.innerHTML = '<h1>Title</h1><p>Content</p>';

      expect(html.querySelector('section article h1')!.innerHTML).toBe('Title');
      expect(html.querySelector('section article p')!.innerHTML).toBe('Content');
    });

    test('should query after removing and adding elements', () => {
      const html = new HtmlMod('<div><p class="old">1</p><p class="old">2</p></div>');

      for (const element of html.querySelectorAll('.old')) element.remove();

      const div = html.querySelector('div')!;
      div.innerHTML = '<p class="new">1</p><p class="new">2</p>';

      expect(html.querySelectorAll('.new').length).toBe(2);
      expect(html.querySelectorAll('.old').length).toBe(0);
    });

    test('should query after attribute changes that affect selectors', () => {
      const html = new HtmlMod('<div><p>1</p><p>2</p><p>3</p></div>');
      const paragraphs = html.querySelectorAll('p');

      paragraphs[0].setAttribute('class', 'highlight');
      paragraphs[1].setAttribute('class', 'highlight');

      expect(html.querySelectorAll('.highlight').length).toBe(2);
      expect(html.querySelectorAll('p').length).toBe(3);
    });

    test('should query with complex selectors after modifications', () => {
      const html = new HtmlMod('<div><section><p>1</p></section></div>');
      const section = html.querySelector('section')!;

      section.innerHTML = '<article id="main"><p class="content">text</p></article>';

      expect(html.querySelector('div > section > article#main > p.content')).not.toBeNull();
      expect(html.querySelector('article#main p.content')!.innerHTML).toBe('text');
    });

    test('should query after replacing elements', () => {
      const html = new HtmlMod('<div><p>old</p></div>');
      const p = html.querySelector('p')!;

      p.replaceWith('<span class="new">replaced</span>');

      expect(html.querySelector('p')).toBeNull();
      expect(html.querySelector('span.new')!.innerHTML).toBe('replaced');
    });

    test('should querySelectorAll after progressive modifications', () => {
      const html = new HtmlMod('<div></div>');
      const div = html.querySelector('div')!;

      div.append('<p>1</p>');
      expect(html.querySelectorAll('p').length).toBe(1);

      div.append('<p>2</p>');
      expect(html.querySelectorAll('p').length).toBe(2);

      div.append('<p>3</p>');
      expect(html.querySelectorAll('p').length).toBe(3);
    });
  });

  describe('Cascading Modifications', () => {
    test('should modify element A then element B before A, verify A positions correct', () => {
      const html = new HtmlMod('<div><p id="first">1</p><p id="second">2</p><p id="third">3</p></div>');

      const third = html.querySelector('#third')!;
      third.setAttribute('data-third', 'value3');

      const first = html.querySelector('#first')!;
      first.setAttribute('data-first', 'value1');

      // Third should still be correct
      expect(html.querySelector('#third')!.getAttribute('data-third')).toBe('value3');
      expect(html.querySelector('#third')!.innerHTML).toBe('3');
    });

    test('should remove element in middle, verify siblings before and after', () => {
      const html = new HtmlMod('<div><p id="a">A</p><p id="b">B</p><p id="c">C</p></div>');

      const b = html.querySelector('#b')!;
      b.remove();

      expect(html.querySelector('#a')!.innerHTML).toBe('A');
      expect(html.querySelector('#c')!.innerHTML).toBe('C');
      expect(html.querySelector('#b')).toBeNull();

      // Modify remaining elements
      html.querySelector('#a')!.innerHTML = 'A-modified';
      html.querySelector('#c')!.innerHTML = 'C-modified';

      expect(html.toString()).toBe('<div><p id="a">A-modified</p><p id="c">C-modified</p></div>');
    });

    test('should handle cascading innerHTML changes', () => {
      const html = new HtmlMod('<div><section><article>original</article></section></div>');

      const section = html.querySelector('section')!;
      section.innerHTML = '<article>level1</article>';

      const article = html.querySelector('article')!;
      article.innerHTML = 'level2';

      const div = html.querySelector('div')!;
      div.prepend('<header>top</header>');

      expect(html.toString()).toBe('<div><header>top</header><section><article>level2</article></section></div>');
    });

    test('should modify deeply nested element then ancestor', () => {
      const html = new HtmlMod('<div><section><article><p><span>deep</span></p></article></section></div>');

      const span = html.querySelector('span')!;
      span.textContent = 'modified-deep';

      const div = html.querySelector('div')!;
      div.setAttribute('id', 'root');

      expect(html.querySelector('#root span')!.innerHTML).toBe('modified-deep');
    });

    test('should handle interleaved modifications at different depths', () => {
      const html = new HtmlMod(
        '<div id="root"><section id="s1"><p id="p1">1</p></section><section id="s2"><p id="p2">2</p></section></div>'
      );

      const p1 = html.querySelector('#p1')!;
      p1.innerHTML = 'modified-1';

      const root = html.querySelector('#root')!;
      root.setAttribute('class', 'container');

      const p2 = html.querySelector('#p2')!;
      p2.innerHTML = 'modified-2';

      const s1 = html.querySelector('#s1')!;
      s1.setAttribute('class', 'section');

      expect(html.querySelector('#p1')!.innerHTML).toBe('modified-1');
      expect(html.querySelector('#p2')!.innerHTML).toBe('modified-2');
      expect(html.querySelector('#root')!.getAttribute('class')).toBe('container');
      expect(html.querySelector('#s1')!.getAttribute('class')).toBe('section');
    });

    test('should handle 10 sequential modifications across tree', () => {
      const html = new HtmlMod(
        '<div><p id="1">1</p><p id="2">2</p><p id="3">3</p><p id="4">4</p><p id="5">5</p></div>'
      );

      for (let index = 1; index <= 5; index++) {
        const p = html.querySelector(`#${index}`)!;
        p.setAttribute('data-index', `${index}`);
        p.innerHTML = `modified-${index}`;
      }

      for (let index = 1; index <= 5; index++) {
        expect(html.querySelector(`#${index}`)!.getAttribute('data-index')).toBe(`${index}`);
        expect(html.querySelector(`#${index}`)!.innerHTML).toBe(`modified-${index}`);
      }
    });
  });

  describe('Document-Level Operations Edge Cases', () => {
    test('should trim with nested elements', () => {
      const html = new HtmlMod('  <div><p>content</p></div>  ');
      html.trim();

      expect(html.toString()).toBe('<div><p>content</p></div>');
      expect(html.querySelector('p')!.innerHTML).toBe('content');
    });

    test('should trimStart with nested elements', () => {
      const html = new HtmlMod('  \n  <div><p>content</p></div>');
      html.trimStart();

      expect(html.toString()).toBe('<div><p>content</p></div>');
    });

    test('should trimEnd with nested elements', () => {
      const html = new HtmlMod('<div><p>content</p></div>  \n  ');
      html.trimEnd();

      expect(html.toString()).toBe('<div><p>content</p></div>');
    });

    test('should handle multiple trim operations in sequence', () => {
      const html = new HtmlMod('  <div>  content  </div>  ');

      html.trimStart();
      expect(html.toString()).toBe('<div>  content  </div>  ');

      html.trimEnd();
      expect(html.toString()).toBe('<div>  content  </div>');
    });

    test('should trim then modify elements', () => {
      const html = new HtmlMod('  <div><p>text</p></div>  ');
      html.trim();

      const p = html.querySelector('p')!;
      p.innerHTML = 'modified';

      expect(html.toString()).toBe('<div><p>modified</p></div>');
    });

    test('should modify elements then trim', () => {
      const html = new HtmlMod('  <div><p>text</p></div>  ');

      const div = html.querySelector('div')!;
      div.setAttribute('id', 'test');

      html.trim();

      expect(html.toString()).toBe('<div id="test"><p>text</p></div>');
    });

    test('should trimLines with nested structure', () => {
      const html = new HtmlMod('\n\n<div>\n<p>content</p>\n</div>\n\n');
      html.trimLines();

      expect(html.toString()).toBe('<div>\n<p>content</p>\n</div>');
    });

    test('should handle trim on empty document', () => {
      const html = new HtmlMod('   ');
      html.trim();

      expect(html.toString()).toBe('');
      expect(html.isEmpty()).toBe(true);
    });

    test('should handle cascading trim and innerHTML operations', () => {
      const html = new HtmlMod('  <div></div>  ');
      html.trim();

      const div = html.querySelector('div')!;
      div.innerHTML = '  <p>text</p>  ';

      expect(html.toString()).toBe('<div>  <p>text</p>  </div>');
    });

    test('should query after document-level trim', () => {
      const html = new HtmlMod('  <div id="test"><p class="content">text</p></div>  ');
      html.trim();

      expect(html.querySelector('#test')).not.toBeNull();
      expect(html.querySelector('.content')!.innerHTML).toBe('text');
    });
  });
});
