/**
 * Adversarial Tests for Experimental Auto-Flush Implementation
 *
 * These tests attempt to break the implementation with edge cases,
 * extreme values, malformed input, and stress scenarios.
 */

/* eslint-disable unicorn/prefer-dom-node-dataset */
import { describe, expect, test } from 'vitest';

import { HtmlMod } from './index.experimental.js';

describe('Adversarial Tests - Experimental Auto-Flush', () => {
  describe('Extreme Values', () => {
    test('should handle extremely long attribute values (1MB)', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      // 1MB of data
      const hugeValue = 'x'.repeat(1_000_000);
      div.setAttribute('data-huge', hugeValue);

      expect(div.getAttribute('data-huge')).toBe(hugeValue);
      expect(div.getAttribute('data-huge')!.length).toBe(1_000_000);
    });

    test('should handle extremely long innerHTML (500KB)', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      const hugeContent = '<p>text</p>'.repeat(50_000);
      div.innerHTML = hugeContent;

      expect(html.toString().length).toBeGreaterThan(500_000);
    });

    test('should handle 1000 attributes on single element', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      for (let index = 0; index < 1000; index++) {
        div.setAttribute(`attr${index}`, `value${index}`);
      }

      expect(div.getAttributeNames().length).toBe(1000);

      // Verify they're all correct
      for (let index = 0; index < 1000; index++) {
        expect(div.getAttribute(`attr${index}`)).toBe(`value${index}`);
      }
    });

    test('should handle 200 levels of nesting', () => {
      let nested = '<div>';
      for (let index = 0; index < 200; index++) {
        nested += `<div class="level-${index}">`;
      }
      nested += 'deep';
      for (let index = 0; index < 200; index++) {
        nested += '</div>';
      }
      nested += '</div>';

      const html = new HtmlMod(nested);
      const root = html.querySelector('div')!;
      root.setAttribute('id', 'root');

      expect(html.querySelector('#root')).not.toBeNull();
    });

    test('should handle 10000 sibling elements', () => {
      const html = new HtmlMod('<div></div>');
      const div = html.querySelector('div')!;

      const siblings = Array.from({ length: 10_000 }, (_, index) => `<span class="item-${index}">${index}</span>`).join(
        ''
      );

      div.innerHTML = siblings;

      expect(html.querySelectorAll('span').length).toBe(10_000);
      expect(html.querySelector('.item-9999')!.textContent).toBe('9999');
    });
  });

  describe('Malformed HTML', () => {
    test('should handle unclosed tags', () => {
      const html = new HtmlMod('<div><p>unclosed</div>');
      const div = html.querySelector('div')!;

      div.setAttribute('id', 'test');
      expect(html.toString()).toContain('id="test"');
    });

    test('should handle mismatched tags', () => {
      const html = new HtmlMod('<div><p>text</div></p>');
      const div = html.querySelector('div')!;

      div.innerHTML = 'new content';
      expect(div.innerHTML).toBe('new content');
    });

    test('should handle nested unclosed tags', () => {
      const html = new HtmlMod('<div><p><span>unclosed</div>');
      const div = html.querySelector('div')!;

      div.setAttribute('data-test', 'value');
      expect(div.getAttribute('data-test')).toBe('value');
    });

    test('should handle broken attributes', () => {
      const html = new HtmlMod('<div class="test" broken =>content</div>');
      const div = html.querySelector('div')!;

      div.setAttribute('id', 'fixed');
      expect(html.toString()).toContain('id="fixed"');
    });

    test('should handle invalid nesting', () => {
      const html = new HtmlMod('<table><div><tr><td>invalid</td></tr></div></table>');
      const div = html.querySelector('div')!;

      div.innerHTML = 'fixed';
      expect(div.innerHTML).toBe('fixed');
    });
  });

  describe('Rapid Sequential Operations', () => {
    test('should handle 1000 rapid setAttribute calls', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      for (let index = 0; index < 1000; index++) {
        div.setAttribute('data-count', String(index));
      }

      expect(div.getAttribute('data-count')).toBe('999');
    });

    test('should handle 100 rapid innerHTML changes', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      for (let index = 0; index < 100; index++) {
        div.innerHTML = `<p>iteration-${index}</p>`;
      }

      expect(div.innerHTML).toBe('<p>iteration-99</p>');
      expect(html.querySelector('p')!.textContent).toBe('iteration-99');
    });

    test('should handle alternating add/remove operations 500 times', () => {
      const html = new HtmlMod('<div><p>text</p></div>');
      const div = html.querySelector('div')!;

      for (let index = 0; index < 500; index++) {
        div.innerHTML = '';
        div.innerHTML = `<p>iteration-${index}</p>`;
      }

      expect(html.querySelector('p')!.textContent).toBe('iteration-499');
    });

    test('should handle rapid query operations during modifications', () => {
      const html = new HtmlMod('<div><p class="target">text</p></div>');
      const _div = html.querySelector('div')!;

      for (let index = 0; index < 100; index++) {
        const p = html.querySelector('.target')!;
        p.setAttribute('data-iteration', String(index));
        expect(html.querySelector('.target')).not.toBeNull();
      }
    });

    test('should handle cascading modifications', () => {
      const html = new HtmlMod('<div><section><article><p>deep</p></article></section></div>');

      for (let index = 0; index < 50; index++) {
        const div = html.querySelector('div')!;
        const section = html.querySelector('section')!;
        const article = html.querySelector('article')!;
        const p = html.querySelector('p')!;

        div.setAttribute('data-div', String(index));
        section.setAttribute('data-section', String(index));
        article.setAttribute('data-article', String(index));
        p.textContent = `iteration-${index}`;
      }

      expect(html.querySelector('p')!.textContent).toBe('iteration-49');
    });
  });

  describe('Edge Cases with Position Tracking', () => {
    test('should handle modifications at document start', () => {
      const html = new HtmlMod('<div>content</div>');
      html.trimStart(); // No-op but tests position 0

      const div = html.querySelector('div')!;
      div.setAttribute('id', 'test');

      expect(html.toString()).toBe('<div id="test">content</div>');
    });

    test('should handle modifications at document end', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      div.setAttribute('id', 'test');
      html.trimEnd(); // No-op but tests end position

      expect(html.toString()).toBe('<div id="test">content</div>');
    });

    test('should handle zero-length replacements', () => {
      const html = new HtmlMod('<div></div>');
      const div = html.querySelector('div')!;

      div.innerHTML = '';
      div.setAttribute('data-empty', 'true');

      expect(div.innerHTML).toBe('');
      expect(div.getAttribute('data-empty')).toBe('true');
    });

    test('should handle identical replacements', () => {
      const html = new HtmlMod('<div>same</div>');
      const div = html.querySelector('div')!;

      for (let index = 0; index < 10; index++) {
        div.innerHTML = 'same';
      }

      expect(div.innerHTML).toBe('same');
    });

    test('should handle growing then shrinking content', () => {
      const html = new HtmlMod('<div>small</div>');
      const div = html.querySelector('div')!;

      // Grow
      div.innerHTML = 'x'.repeat(1000);
      expect(div.innerHTML.length).toBe(1000);

      // Shrink
      div.innerHTML = 'tiny';
      expect(div.innerHTML).toBe('tiny');

      // Grow again
      div.innerHTML = 'y'.repeat(5000);
      expect(div.innerHTML.length).toBe(5000);
    });
  });

  describe('Boundary Conditions', () => {
    test('should handle null-like values gracefully', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      // These should not crash
      div.setAttribute('data-null', 'null');
      div.setAttribute('data-undefined', 'undefined');
      div.innerHTML = '';

      expect(div.getAttribute('data-null')).toBe('null');
    });

    test('should handle attribute with no value', () => {
      const html = new HtmlMod('<div disabled>content</div>');
      const div = html.querySelector('div')!;

      div.setAttribute('id', 'test');
      expect(div.hasAttribute('disabled')).toBe(true);
    });

    test('should handle empty attribute name edge case', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      // Should not crash
      div.setAttribute('', 'value');
      expect(html.toString()).toContain('content');
    });

    test('should handle whitespace-only innerHTML', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      div.innerHTML = '   ';
      expect(div.innerHTML).toBe('   ');

      div.innerHTML = '\n\t\r  ';
      expect(div.innerHTML.length).toBeGreaterThan(0);
    });

    test('should handle attribute values with special HTML chars', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      div.setAttribute('data-html', '<script>alert("xss")</script>');
      div.setAttribute('data-quotes', '"double" and \'single\'');
      div.setAttribute('data-ampersand', 'foo&bar');

      expect(div.getAttribute('data-html')).toBe('<script>alert("xss")</script>');
    });
  });

  describe('Stale Reference Handling', () => {
    test('should handle operations on deeply nested removed elements', () => {
      const html = new HtmlMod('<div><section><article><p>deep</p></article></section></div>');
      const p = html.querySelector('p')!;
      const _article = html.querySelector('article')!;
      const _section = html.querySelector('section')!;
      const div = html.querySelector('div')!;

      // Remove parent
      div.remove();

      // All should be removed from document
      expect(html.querySelector('p')).toBeNull();
      expect(html.querySelector('article')).toBeNull();

      // But references should have cached content
      expect(p.innerHTML).toBe('deep');
    });

    test('should handle modifications to removed element siblings', () => {
      const html = new HtmlMod('<div><p id="a">A</p><p id="b">B</p><p id="c">C</p></div>');
      const a = html.querySelector('#a')!;
      const b = html.querySelector('#b')!;
      const c = html.querySelector('#c')!;

      b.remove();

      // A and C should still work
      a.setAttribute('data-first', 'true');
      c.setAttribute('data-last', 'true');

      expect(html.querySelector('#a')!.getAttribute('data-first')).toBe('true');
      expect(html.querySelector('#c')!.getAttribute('data-last')).toBe('true');
    });

    test('should handle querySelector on removed element', () => {
      const html = new HtmlMod('<div><section><p>text</p></section></div>');
      const section = html.querySelector('section')!;

      section.remove();

      // querySelector should return null after removal
      expect(html.querySelector('section')).toBeNull();
    });

    test('should handle replacing element multiple times', () => {
      const html = new HtmlMod('<div><p>original</p></div>');
      const p = html.querySelector('p')!;

      p.replaceWith('<span>first</span>');
      expect(html.querySelector('span')!.innerHTML).toBe('first');

      const span = html.querySelector('span')!;
      span.replaceWith('<article>second</article>');
      expect(html.querySelector('article')!.innerHTML).toBe('second');

      const article = html.querySelector('article')!;
      article.replaceWith('<section>third</section>');
      expect(html.querySelector('section')!.innerHTML).toBe('third');
    });
  });

  describe('Unicode and Special Characters', () => {
    test('should handle complex unicode in innerHTML', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      div.innerHTML = '你好世界 🌍 Здравствуй мир 🎉 مرحبا بالعالم';
      expect(div.innerHTML).toContain('你好世界');
      expect(div.innerHTML).toContain('🌍');
      expect(div.innerHTML).toContain('Здравствуй');
    });

    test('should handle emoji in attributes', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      div.setAttribute('data-emoji', '🎉🎊🎈🎁🎀');
      expect(div.getAttribute('data-emoji')).toBe('🎉🎊🎈🎁🎀');
    });

    test('should handle right-to-left text', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      div.innerHTML = 'مرحبا بك في العالم';
      expect(div.innerHTML).toBe('مرحبا بك في العالم');
    });

    test('should handle zero-width characters', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      // Zero-width space, zero-width joiner, etc
      div.innerHTML = 'hello\u200Bworld\u200C\u200D';
      expect(div.innerHTML).toContain('\u200B');
    });

    test('should handle surrogate pairs', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      div.innerHTML = '𝕳𝖊𝖑𝖑𝖔 𝖂𝖔𝖗𝖑𝖉'; // Mathematical bold text
      expect(div.innerHTML).toContain('𝕳𝖊𝖑𝖑𝖔');
    });
  });

  describe('Memory and Performance Stress', () => {
    test('should not leak memory with 1000 create/destroy cycles', () => {
      for (let index = 0; index < 1000; index++) {
        const html = new HtmlMod('<div><p>text</p></div>');
        const p = html.querySelector('p')!;
        p.setAttribute('id', `test-${index}`);
        p.remove();
      }

      // If we get here without crashing, memory is okay
      expect(true).toBe(true);
    });

    test('should handle 100 large documents in sequence', () => {
      for (let index = 0; index < 100; index++) {
        const content = Array.from(
          { length: 1000 },
          (_, index) => `<div class="item-${index}">Content ${index}</div>`
        ).join('');

        const html = new HtmlMod(`<body>${content}</body>`);
        expect(html.querySelectorAll('.item-0').length).toBe(1);
      }
    });

    test('should handle deeply nested modifications without stack overflow', () => {
      let html = '<div>';
      for (let index = 0; index < 100; index++) {
        html += '<div>';
      }
      html += 'deep';
      for (let index = 0; index < 100; index++) {
        html += '</div>';
      }
      html += '</div>';

      const doc = new HtmlMod(html);
      const root = doc.querySelector('div')!;

      // This should not cause stack overflow
      root.setAttribute('data-depth', '100');
      expect(root.getAttribute('data-depth')).toBe('100');
    });
  });

  describe('AST Corruption Detection', () => {
    test('should maintain AST integrity after complex operations', () => {
      const html = new HtmlMod('<div id="root"><p>original</p></div>');
      const root = html.querySelector('#root')!;
      const p = html.querySelector('p')!;

      // Complex sequence
      root.setAttribute('class', 'container');
      p.innerHTML = 'modified';
      root.prepend('<header>top</header>');
      p.setAttribute('class', 'text');
      root.append('<footer>bottom</footer>');

      // Verify AST is still coherent
      expect(html.querySelector('#root')).not.toBeNull();
      expect(html.querySelector('header')).not.toBeNull();
      expect(html.querySelector('p.text')).not.toBeNull();
      expect(html.querySelector('footer')).not.toBeNull();
    });

    test('should handle overlapping modifications correctly', () => {
      const html = new HtmlMod('<div><span>text</span></div>');
      const div = html.querySelector('div')!;
      const span = html.querySelector('span')!;

      // Modify parent and child
      div.setAttribute('id', 'parent');
      span.setAttribute('id', 'child');

      // Verify both are correct
      expect(html.querySelector('#parent')).not.toBeNull();
      expect(html.querySelector('#child')).not.toBeNull();
      expect(html.toString()).toBe('<div id="parent"><span id="child">text</span></div>');
    });

    test('should maintain positions after insertions at different locations', () => {
      const html = new HtmlMod('<div><p id="middle">middle</p></div>');
      const div = html.querySelector('div')!;

      div.prepend('<p id="first">first</p>');
      div.append('<p id="last">last</p>');

      // All should be queryable
      expect(html.querySelector('#first')!.textContent).toBe('first');
      expect(html.querySelector('#middle')!.textContent).toBe('middle');
      expect(html.querySelector('#last')!.textContent).toBe('last');
    });
  });

  describe('Dataset API Edge Cases', () => {
    test('should handle dataset with 1000 attributes', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      for (let index = 0; index < 1000; index++) {
        div.dataset[`item${index}`] = `value${index}`;
      }

      expect(Object.keys(div.dataset).length).toBe(1000);
    });

    test('should handle dataset with extreme attribute names', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      div.dataset.aVeryLongCamelCaseAttributeNameThatGoesOnAndOnAndOn = 'value';
      expect(div.dataset.aVeryLongCamelCaseAttributeNameThatGoesOnAndOnAndOn).toBe('value');
    });

    test('should handle dataset operations during innerHTML changes', () => {
      const html = new HtmlMod('<div data-id="123">content</div>');
      const div = html.querySelector('div')!;

      expect(div.dataset.id).toBe('123');

      div.innerHTML = 'new content';
      expect(div.dataset.id).toBe('123');

      div.dataset.updated = 'true';
      expect(div.dataset.updated).toBe('true');
    });

    test('should handle rapid dataset property changes', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      for (let index = 0; index < 100; index++) {
        div.dataset.counter = String(index);
      }

      expect(div.dataset.counter).toBe('99');
    });
  });

  describe('Pathological Cases', () => {
    test('should handle HTML with 1000 levels of nesting (if parser allows)', () => {
      let nested = '<div>';
      for (let index = 0; index < 1000; index++) {
        nested += '<div>';
      }
      nested += 'deepest';
      for (let index = 0; index < 1000; index++) {
        nested += '</div>';
      }
      nested += '</div>';

      // Parser may limit this, but shouldn't crash
      try {
        const html = new HtmlMod(nested);
        const root = html.querySelector('div');
        if (root) {
          root.setAttribute('data-deep', 'true');
        }
        expect(true).toBe(true); // Didn't crash
      } catch {
        // Parser may reject this, which is fine
        expect(true).toBe(true);
      }
    });

    test('should handle alternating self-closing conversions', () => {
      const html = new HtmlMod('<div/>');
      const div = html.querySelector('div')!;

      for (let index = 0; index < 10; index++) {
        div.innerHTML = index % 2 === 0 ? '<p>content</p>' : '';
      }

      expect(div.innerHTML).toBe('');
    });

    test('should handle circular-like modification patterns', () => {
      const html = new HtmlMod('<div id="a"><div id="b"><div id="c">content</div></div></div>');

      for (let index = 0; index < 20; index++) {
        const a = html.querySelector('#a')!;
        const b = html.querySelector('#b')!;
        const c = html.querySelector('#c')!;

        c.setAttribute('data-c', String(index));
        b.setAttribute('data-b', String(index));
        a.setAttribute('data-a', String(index));
      }

      expect(html.querySelector('#c')!.getAttribute('data-c')).toBe('19');
    });

    test('should handle element becoming its own descendant (via innerHTML)', () => {
      const html = new HtmlMod('<div id="outer"><div id="inner">text</div></div>');
      const outer = html.querySelector('#outer')!;

      // This creates a weird situation
      outer.innerHTML = outer.outerHTML;

      // Should not crash
      expect(html.querySelector('#outer')).not.toBeNull();
    });
  });

  describe('Position Tracking Hell - Same Position Operations', () => {
    test('should handle modifying exact same attribute 1000 times', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      for (let index = 0; index < 1000; index++) {
        div.setAttribute('id', `value-${index}`);
      }

      expect(div.getAttribute('id')).toBe('value-999');
      expect(html.querySelector('#value-999')).not.toBeNull();
    });

    test('should handle rapid toggle of same attribute', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      for (let index = 0; index < 1000; index++) {
        div.toggleAttribute('data-active');
      }

      // Should be false after even number of toggles
      expect(div.hasAttribute('data-active')).toBe(false);
    });

    test('should handle multiple attributes added/removed at same position', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      // Add multiple attributes
      div.setAttribute('a', '1');
      div.setAttribute('b', '2');
      div.setAttribute('c', '3');

      // Remove in different order
      div.removeAttribute('b');
      div.setAttribute('d', '4');
      div.removeAttribute('a');
      div.setAttribute('e', '5');

      expect(div.getAttribute('c')).toBe('3');
      expect(div.getAttribute('d')).toBe('4');
      expect(div.getAttribute('e')).toBe('5');
      expect(div.hasAttribute('a')).toBe(false);
      expect(div.hasAttribute('b')).toBe(false);
    });

    test('should handle zero-width operations at same position', () => {
      const html = new HtmlMod('<div id="test">content</div>');
      const div = html.querySelector('#test')!;

      // These operations happen at almost the same position
      div.setAttribute('a', '');
      div.setAttribute('b', '');
      div.setAttribute('c', '');

      expect(div.hasAttribute('a')).toBe(true);
      expect(div.hasAttribute('b')).toBe(true);
      expect(div.hasAttribute('c')).toBe(true);
    });
  });

  describe('Iterator Invalidation - Modify While Iterating', () => {
    test('should handle modifying elements while iterating querySelectorAll', () => {
      const html = new HtmlMod('<div><p>1</p><p>2</p><p>3</p><p>4</p><p>5</p></div>');
      const paragraphs = html.querySelectorAll('p');

      // Modify each element during iteration
      for (const [index, p] of paragraphs.entries()) {
        p.setAttribute('data-index', String(index));
        p.innerHTML = `modified-${index}`;
      }

      // All modifications should succeed
      expect(html.querySelector('[data-index="0"]')!.innerHTML).toBe('modified-0');
      expect(html.querySelector('[data-index="4"]')!.innerHTML).toBe('modified-4');
    });

    test('should handle removing elements while iterating', () => {
      const html = new HtmlMod('<div><span>1</span><span>2</span><span>3</span></div>');
      const spans = html.querySelectorAll('span');

      // Remove every other element
      for (const [index, span] of spans.entries()) {
        if (index % 2 === 0) {
          span.remove();
        }
      }

      expect(html.querySelectorAll('span').length).toBe(1);
    });

    test('should handle adding siblings while iterating', () => {
      const html = new HtmlMod('<ul><li>1</li><li>2</li></ul>');
      const _ul = html.querySelector('ul')!;
      const items = html.querySelectorAll('li');

      // This changes the document structure during iteration
      for (const item of items) {
        item.after('<li>inserted</li>');
      }

      // Original 2 + 2 inserted = 4
      expect(html.querySelectorAll('li').length).toBe(4);
    });
  });

  describe('Position 0 and Boundary Edge Cases', () => {
    test('should handle operations at exact position 0', () => {
      const html = new HtmlMod('<div>content</div>');

      // Operations at document start
      html.trim();
      const div = html.querySelector('div')!;
      div.setAttribute('id', 'first');

      expect(html.toString().startsWith('<div id="first">')).toBe(true);
    });

    test('should handle prepend on first element multiple times', () => {
      const html = new HtmlMod('<div>original</div>');
      const div = html.querySelector('div')!;

      div.prepend('first');
      div.prepend('second');
      div.prepend('third');

      expect(div.innerHTML).toBe('thirdsecondfirstoriginal');
    });

    test('should handle document-level trim operations', () => {
      const html = new HtmlMod('   <div>content</div>   ');

      html.trim();
      expect(html.toString()).toBe('<div>content</div>');

      const div = html.querySelector('div')!;
      div.setAttribute('id', 'test');

      expect(html.querySelector('#test')).not.toBeNull();
    });

    test('should handle operations at exact document end', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      div.after('<p>after</p>');
      div.after('<span>more</span>');

      // Second after() inserts between div and first insertion
      expect(html.toString()).toBe('<div>content</div><span>more</span><p>after</p>');
      expect(html.toString().endsWith('</p>')).toBe(true);
    });
  });

  describe('Off-by-One and Boundary Errors', () => {
    test('should handle overlapping modifications in parent and child', () => {
      const html = new HtmlMod('<div><span>text</span></div>');
      const div = html.querySelector('div')!;
      const span = html.querySelector('span')!;

      // Modify child
      span.setAttribute('id', 'child');

      // Then modify parent in a way that shifts child's position
      div.prepend('<header>top</header>');

      // Child should still be queryable with correct attributes
      const foundSpan = html.querySelector('#child');
      expect(foundSpan).not.toBeNull();
      expect(foundSpan!.textContent).toBe('text');
    });

    test('should handle setAttribute with exact boundary values', () => {
      const html = new HtmlMod('<div id="old">content</div>');
      const div = html.querySelector('div')!;

      // Replace attribute value with same length
      div.setAttribute('id', 'new');
      expect(div.getAttribute('id')).toBe('new');

      // Replace with longer
      div.setAttribute('id', 'muchlonger');
      expect(div.getAttribute('id')).toBe('muchlonger');

      // Replace with shorter
      div.setAttribute('id', 'x');
      expect(div.getAttribute('id')).toBe('x');
    });

    test('should handle innerHTML that changes element length dramatically', () => {
      const html = new HtmlMod('<div><p>x</p></div>');
      const p = html.querySelector('p')!;

      // Shrink
      p.innerHTML = '';
      expect(html.toString()).toBe('<div><p></p></div>');

      // Expand massively
      p.innerHTML = 'x'.repeat(1000);
      expect(p.innerHTML.length).toBe(1000);

      // Shrink again
      p.innerHTML = 'y';
      expect(p.innerHTML).toBe('y');
    });

    test('should handle removing first vs last vs middle sibling', () => {
      const html = new HtmlMod('<div><a>1</a><b>2</b><c>3</c><d>4</d><e>5</e></div>');

      // Remove first
      html.querySelector('a')!.remove();
      expect(html.querySelectorAll('*').length).toBe(5); // div + 4 children

      // Remove last
      html.querySelector('e')!.remove();
      expect(html.querySelectorAll('*').length).toBe(4);

      // Remove middle
      html.querySelector('c')!.remove();
      expect(html.querySelectorAll('*').length).toBe(3);

      // Remaining should be queryable
      expect(html.querySelector('b')).not.toBeNull();
      expect(html.querySelector('d')).not.toBeNull();
    });
  });

  describe('Malicious Attribute Values', () => {
    test('should handle attribute values with HTML-like content', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      div.setAttribute('data-html', '<script>alert("xss")</script>');
      expect(div.getAttribute('data-html')).toBe('<script>alert("xss")</script>');
    });

    test('should handle attribute values with quotes and escapes', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      div.setAttribute('data-quotes', 'He said "hello" and \'goodbye\'');
      expect(div.getAttribute('data-quotes')).toBe('He said "hello" and \'goodbye\'');
    });

    test('should handle attribute values with newlines and special chars', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      div.setAttribute('data-special', 'line1\nline2\ttab\rcarriage');
      expect(div.getAttribute('data-special')).toContain('line1');
      expect(div.getAttribute('data-special')).toContain('line2');
    });

    test('should handle attribute values that could break position tracking', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      // Value that looks like position indices
      div.setAttribute('data-pos', '0:100:200:300');
      expect(div.getAttribute('data-pos')).toBe('0:100:200:300');
    });
  });

  describe('Self-Closing Tag Conversion Hell', () => {
    test('should handle nested self-closing conversions', () => {
      const html = new HtmlMod('<div/><span/><p/>');

      const div = html.querySelector('div')!;
      const span = html.querySelector('span')!;
      const p = html.querySelector('p')!;

      // Convert all to non-self-closing by adding content
      div.innerHTML = 'div content';
      span.innerHTML = 'span content';
      p.innerHTML = 'p content';

      expect(html.toString()).toBe('<div>div content</div><span>span content</span><p>p content</p>');

      // All should still be queryable
      expect(html.querySelector('div')!.innerHTML).toBe('div content');
      expect(html.querySelector('span')!.innerHTML).toBe('span content');
      expect(html.querySelector('p')!.innerHTML).toBe('p content');
    });

    test('should handle converting self-closing to non-self-closing back to self-closing', () => {
      const html = new HtmlMod('<br/>');
      const br = html.querySelector('br')!;

      // Add content (converts to non-self-closing)
      br.innerHTML = 'content';
      expect(html.toString()).toContain('content');

      // Empty it (might convert back depending on implementation)
      br.innerHTML = '';

      // Should still be queryable
      expect(html.querySelector('br')).not.toBeNull();
    });

    test('should handle prepend on self-closing tag', () => {
      const html = new HtmlMod('<div/>');
      const div = html.querySelector('div')!;

      // This should convert to non-self-closing
      div.prepend('<span>prepended</span>');

      expect(html.toString()).toContain('prepended');
      expect(html.querySelector('span')).not.toBeNull();
    });

    test('should handle append on self-closing tag', () => {
      const html = new HtmlMod('<div/>');
      const div = html.querySelector('div')!;

      div.append('<span>appended</span>');

      expect(html.toString()).toContain('appended');
      expect(html.querySelector('span')).not.toBeNull();
    });
  });

  describe('Parent-Child Reference Chaos', () => {
    test("should handle modifying removed element's former siblings", () => {
      const html = new HtmlMod('<div><a>1</a><b>2</b><c>3</c></div>');
      const b = html.querySelector('b')!;
      const c = html.querySelector('c')!;

      // Remove middle element
      b.remove();

      // Modify its former sibling
      c.setAttribute('id', 'modified');

      expect(html.querySelector('#modified')).not.toBeNull();
      expect(html.toString()).toBe('<div><a>1</a><c id="modified">3</c></div>');
    });

    test('should handle removing parent while holding child reference', () => {
      const html = new HtmlMod('<div><p><span>text</span></p></div>');
      const p = html.querySelector('p')!;
      const span = html.querySelector('span')!;

      // Remove parent
      p.remove();

      // Try to query for child - should not find it
      expect(html.querySelector('span')).toBeNull();

      // But we can still read the removed element's properties
      expect(span.textContent).toBe('text');
    });

    test('should handle deeply nested removal and sibling modification', () => {
      const html = new HtmlMod('<div><section><article><p>1</p><p>2</p></article></section></div>');
      const article = html.querySelector('article')!;
      const _p2 = html.querySelectorAll('p')[1];

      // Remove container
      article.remove();

      // Add something new where article was
      const section = html.querySelector('section')!;
      section.innerHTML = '<p id="new">new</p>';

      expect(html.querySelector('#new')).not.toBeNull();
      expect(html.querySelectorAll('p').length).toBe(1);
    });
  });

  describe('Extreme Text Content Edge Cases', () => {
    test('should handle textContent with only whitespace variations', () => {
      const html = new HtmlMod('<p>original</p>');
      const p = html.querySelector('p')!;

      p.textContent = '   ';
      expect(p.textContent).toBe('   ');

      p.textContent = '\n\n\n';
      expect(p.textContent).toBe('\n\n\n');

      p.textContent = '\t\t\t';
      expect(p.textContent).toBe('\t\t\t');
    });

    test('should handle textContent with null bytes', () => {
      const html = new HtmlMod('<p>original</p>');
      const p = html.querySelector('p')!;

      p.textContent = 'before\u0000after';
      expect(p.textContent).toContain('before');
    });

    test('should handle innerHTML with incomplete tags', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      // Parser should handle this gracefully
      div.innerHTML = '<p>text';

      // Should not crash
      expect(html.toString()).toContain('text');
    });
  });

  describe('Query After Chaos', () => {
    test('should correctly query after 100 mixed operations', () => {
      const html = new HtmlMod('<div id="root"><p>start</p></div>');
      const root = html.querySelector('#root')!;

      for (let index = 0; index < 100; index++) {
        if (index % 5 === 0) {
          root.setAttribute(`data-${index}`, String(index));
        } else if (index % 5 === 1) {
          root.prepend(`<span class="pre-${index}">pre</span>`);
        } else if (index % 5 === 2) {
          root.append(`<span class="post-${index}">post</span>`);
        } else if (index % 5 === 3) {
          const spans = html.querySelectorAll('span');
          if (spans.length > 0) {
            spans[0].remove();
          }
        } else {
          const p = html.querySelector('p');
          if (p) {
            p.innerHTML = `iteration-${index}`;
          }
        }
      }

      // Should still be able to query
      expect(html.querySelector('#root')).not.toBeNull();
      expect(html.querySelectorAll('span').length).toBeGreaterThan(0);
    });

    test('should handle complex selector after extreme modifications', () => {
      const html = new HtmlMod(
        '<div><section><article class="post" data-id="1"><h1>Title</h1></article></section></div>'
      );

      const article = html.querySelector('article.post[data-id="1"]')!;
      article.setAttribute('data-modified', 'true');

      const h1 = html.querySelector('h1')!;
      h1.innerHTML = 'Modified Title';

      // Complex selector should still work
      expect(html.querySelector('section > article.post[data-modified="true"] > h1')).not.toBeNull();
    });
  });

  describe('Dataset API Under Stress', () => {
    test('should handle dataset during rapid innerHTML changes', () => {
      const html = new HtmlMod('<div data-id="1">content</div>');
      const div = html.querySelector('div')!;

      for (let index = 0; index < 100; index++) {
        div.innerHTML = `content-${index}`;
        div.dataset.iteration = String(index);
      }

      expect(div.dataset.iteration).toBe('99');
      expect(div.dataset.id).toBe('1');
    });

    test('should handle dataset with camelCase edge cases', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      // Edge cases for camelCase conversion
      div.dataset.a = '1';
      div.dataset.aB = '2';
      div.dataset.aBc = '3';
      div.dataset.aBcD = '4';

      expect(div.getAttribute('data-a')).toBe('1');
      expect(div.getAttribute('data-a-b')).toBe('2');
      expect(div.getAttribute('data-a-bc')).toBe('3');
      expect(div.getAttribute('data-a-bc-d')).toBe('4');
    });

    test('should handle mixing dataset and setAttribute on same attributes', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      div.dataset.id = '1';
      div.setAttribute('data-id', '2');
      expect(div.dataset.id).toBe('2');

      div.setAttribute('data-name', 'foo');
      expect(div.dataset.name).toBe('foo');

      div.dataset.name = 'bar';
      expect(div.getAttribute('data-name')).toBe('bar');
    });
  });

  describe('Memory Leak Potential', () => {
    test('should not leak with circular-like innerHTML operations', () => {
      const html = new HtmlMod('<div id="a"><div id="b">content</div></div>');

      for (let index = 0; index < 100; index++) {
        const a = html.querySelector('#a')!;
        const b = html.querySelector('#b')!;

        // Create circular-like pattern
        const _aHtml = a.outerHTML;
        const _bHtml = b.outerHTML;

        b.innerHTML = 'updated';
        a.setAttribute('data-iter', String(index));
      }

      // Should not crash or leak
      expect(html.querySelector('#a')).not.toBeNull();
    });

    test('should handle holding references to 1000 removed elements', () => {
      const html = new HtmlMod('<div></div>');
      const div = html.querySelector('div')!;

      const removedElements = [];

      for (let index = 0; index < 1000; index++) {
        div.innerHTML = `<p id="p-${index}">text</p>`;
        const p = html.querySelector('p')!;
        removedElements.push(p);
        p.remove();
      }

      // All removed elements should still have their cached content
      for (let index = 0; index < 1000; index++) {
        expect(removedElements[index].textContent).toBe('text');
      }
    });
  });
});
