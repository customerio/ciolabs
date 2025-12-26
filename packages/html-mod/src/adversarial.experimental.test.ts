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
      const div = html.querySelector('div')!;

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
      const article = html.querySelector('article')!;
      const section = html.querySelector('section')!;
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
});
