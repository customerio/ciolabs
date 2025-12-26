/**
 * CRITICAL DATA CORRUPTION PREVENTION TESTS
 *
 * These tests cover edge cases that could cause data corruption
 * in production visual editors. FAILURE IS NOT AN OPTION.
 */

/* eslint-disable unicorn/prefer-dom-node-dataset */
import { parseDocument } from '@ciolabs/htmlparser2-source';
import { describe, expect, test } from 'vitest';

import { HtmlMod } from './index.js';

describe('CRITICAL - Data Corruption Prevention', () => {
  describe('Multi-byte UTF-8 Characters', () => {
    test('should handle emoji in content without position drift', () => {
      const html = new HtmlMod('<div>Hello 👋 World 🌍</div>');
      const div = html.querySelector('div')!;

      for (let index = 0; index < 100; index++) {
        div.setAttribute('data-count', String(index));
        div.innerHTML = `Hello 👋 World 🌍 ${index}`;
      }

      expect(div.innerHTML).toContain('👋');
      expect(div.innerHTML).toContain('🌍');
      expect(html.querySelector('div')).not.toBeNull();
    });

    test('should handle emoji in attributes without corruption', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      for (let index = 0; index < 100; index++) {
        div.setAttribute('data-emoji', `Value 🎉 ${index}`);
      }

      expect(div.getAttribute('data-emoji')).toContain('🎉');
      expect(div.getAttribute('data-emoji')).toBe('Value 🎉 99');
    });

    test('should handle surrogate pairs without position corruption', () => {
      // Surrogate pairs (characters outside BMP)
      const html = new HtmlMod('<div>𝕳𝖊𝖑𝖑𝖔 𝖂𝖔𝖗𝖑𝖉</div>');
      const div = html.querySelector('div')!;

      for (let index = 0; index < 100; index++) {
        div.setAttribute('data-index', String(index));
      }

      expect(html.querySelector('div')).not.toBeNull();
      expect(div.getAttribute('data-index')).toBe('99');
    });

    test('should handle combining characters without corruption', () => {
      // Combining diacritical marks
      const html = new HtmlMod('<div>e\u0301</div>'); // é as e + combining acute accent
      const div = html.querySelector('div')!;

      for (let index = 0; index < 100; index++) {
        div.setAttribute('data-index', String(index));
      }

      expect(html.querySelector('div')).not.toBeNull();
    });

    test('should handle mixed multi-byte characters under heavy load', () => {
      const html = new HtmlMod('<div>ASCII 中文 العربية עברית 🎉</div>');
      const div = html.querySelector('div')!;

      for (let index = 0; index < 500; index++) {
        div.setAttribute('data-i', String(index));
        if (index % 10 === 0) {
          div.innerHTML = `ASCII 中文 العربية עברית 🎉 ${index}`;
        }
      }

      expect(div.innerHTML).toContain('中文');
      expect(div.innerHTML).toContain('العربية');
      expect(html.querySelector('div')).not.toBeNull();
    });
  });

  describe('Malformed HTML Auto-Correction', () => {
    test('should handle unclosed tags without corruption', () => {
      const html = new HtmlMod('<div><p>unclosed paragraph</div>');

      for (let index = 0; index < 100; index++) {
        const div = html.querySelector('div')!;
        div.setAttribute('data-i', String(index));
      }

      expect(html.querySelector('div')).not.toBeNull();
    });

    test('should handle wrong nesting that browsers fix', () => {
      const html = new HtmlMod('<b><i>bold and italic</b></i>');

      for (let index = 0; index < 100; index++) {
        const b = html.querySelector('b')!;
        b.setAttribute('data-i', String(index));
      }

      expect(html.querySelector('b')).not.toBeNull();
    });

    test('should handle multiple unclosed tags', () => {
      const html = new HtmlMod('<div><p><span>text</div>');

      for (let index = 0; index < 100; index++) {
        const div = html.querySelector('div')!;
        div.setAttribute('data-i', String(index));
      }

      expect(html.querySelector('div')).not.toBeNull();
    });

    test('should handle duplicate attributes', () => {
      const html = new HtmlMod('<div class="a" class="b">content</div>');
      const div = html.querySelector('div')!;

      for (let index = 0; index < 100; index++) {
        div.setAttribute('class', `class-${index}`);
      }

      expect(div.getAttribute('class')).toBe('class-99');
    });
  });

  describe('Comments and Special Content', () => {
    test('should handle HTML comments without corruption', () => {
      const html = new HtmlMod('<div><!-- comment --><p>content</p></div>');

      for (let index = 0; index < 100; index++) {
        const div = html.querySelector('div')!;
        const p = html.querySelector('p')!;

        div.setAttribute('data-div', String(index));
        p.setAttribute('data-p', String(index));
      }

      expect(html.querySelector('div')).not.toBeNull();
      expect(html.querySelector('p')).not.toBeNull();
    });

    test('should handle script tags without corruption', () => {
      const html = new HtmlMod('<div><script>var x = 1;</script><p>content</p></div>');

      for (let index = 0; index < 100; index++) {
        const div = html.querySelector('div')!;
        div.setAttribute('data-i', String(index));
      }

      expect(html.querySelector('div')).not.toBeNull();
      expect(html.toString()).toContain('<script>');
    });

    test('should handle style tags without corruption', () => {
      const html = new HtmlMod('<div><style>.class { color: red; }</style><p>content</p></div>');

      for (let index = 0; index < 100; index++) {
        const div = html.querySelector('div')!;
        div.setAttribute('data-i', String(index));
      }

      expect(html.querySelector('div')).not.toBeNull();
      expect(html.toString()).toContain('<style>');
    });

    test('should handle comments inside elements during modifications', () => {
      const html = new HtmlMod('<div><!-- start --><p>text</p><!-- end --></div>');
      const div = html.querySelector('div')!;

      for (let index = 0; index < 100; index++) {
        div.setAttribute('data-i', String(index));
        if (index % 20 === 0) {
          const p = html.querySelector('p')!;
          p.innerHTML = `text-${index}`;
        }
      }

      expect(html.toString()).toContain('<!-- start -->');
      expect(html.toString()).toContain('<!-- end -->');
    });
  });

  describe('Void Elements', () => {
    test('should handle void element modifications', () => {
      const html = new HtmlMod('<div><img src="test.jpg" /><br/><input type="text" /></div>');

      for (let index = 0; index < 100; index++) {
        const img = html.querySelector('img')!;
        const input = html.querySelector('input')!;

        img.setAttribute('alt', `image-${index}`);
        input.setAttribute('value', String(index));
      }

      expect(html.querySelector('img')).not.toBeNull();
      expect(html.querySelector('input')).not.toBeNull();
    });

    test('should handle setting innerHTML on void element parent', () => {
      const html = new HtmlMod('<div><img src="test.jpg" /></div>');
      const div = html.querySelector('div')!;

      for (let index = 0; index < 100; index++) {
        div.innerHTML = `<img src="test-${index}.jpg" />`;
      }

      expect(html.querySelector('img')).not.toBeNull();
    });
  });

  describe('Custom Elements and Special Tag Names', () => {
    test('should handle custom elements with hyphens', () => {
      const html = new HtmlMod('<my-component data-prop="value">content</my-component>');
      const component = html.querySelector('my-component')!;

      for (let index = 0; index < 100; index++) {
        component.setAttribute('data-prop', `value-${index}`);
      }

      expect(component.getAttribute('data-prop')).toBe('value-99');
      expect(html.querySelector('my-component')).not.toBeNull();
    });

    test('should handle elements with multiple hyphens', () => {
      const html = new HtmlMod('<my-custom-web-component>content</my-custom-web-component>');
      const component = html.querySelector('my-custom-web-component')!;

      for (let index = 0; index < 100; index++) {
        component.setAttribute('data-i', String(index));
      }

      expect(html.querySelector('my-custom-web-component')).not.toBeNull();
    });

    test('should handle mixing custom elements with standard elements', () => {
      const html = new HtmlMod('<div><my-component><p>text</p></my-component></div>');

      for (let index = 0; index < 100; index++) {
        const div = html.querySelector('div')!;
        const component = html.querySelector('my-component')!;
        const p = html.querySelector('p')!;

        div.setAttribute('data-div', String(index));
        component.setAttribute('data-component', String(index));
        p.setAttribute('data-p', String(index));
      }

      expect(html.querySelector('div')).not.toBeNull();
      expect(html.querySelector('my-component')).not.toBeNull();
      expect(html.querySelector('p')).not.toBeNull();
    });
  });

  describe('Boolean Attributes', () => {
    test('should handle boolean attributes without values', () => {
      const html = new HtmlMod('<input type="checkbox" checked disabled>');
      const input = html.querySelector('input')!;

      for (let index = 0; index < 100; index++) {
        if (index % 2 === 0) {
          input.setAttribute('checked', '');
        } else {
          input.removeAttribute('checked');
        }
      }

      expect(html.querySelector('input')).not.toBeNull();
    });

    test('should handle toggling boolean attributes', () => {
      const html = new HtmlMod('<button>Click</button>');
      const button = html.querySelector('button')!;

      for (let index = 0; index < 1000; index++) {
        button.toggleAttribute('disabled');
      }

      expect(html.querySelector('button')).not.toBeNull();
      expect(button.hasAttribute('disabled')).toBe(false); // Even number of toggles
    });
  });

  describe('Whitespace Handling', () => {
    test('should handle whitespace-only content', () => {
      const html = new HtmlMod('<div>   \n\t   </div>');
      const div = html.querySelector('div')!;

      for (let index = 0; index < 100; index++) {
        div.setAttribute('data-i', String(index));
      }

      expect(html.querySelector('div')).not.toBeNull();
    });

    test('should handle mixed whitespace types in attributes', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      for (let index = 0; index < 100; index++) {
        div.setAttribute('data-ws', `value \n\t\r ${index}`);
      }

      expect(div.getAttribute('data-ws')).toContain('\n');
      expect(div.getAttribute('data-ws')).toContain('\t');
    });

    test('should handle leading/trailing whitespace in innerHTML', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      for (let index = 0; index < 100; index++) {
        div.innerHTML = `  <p>text-${index}</p>  `;
      }

      expect(html.querySelector('p')).not.toBeNull();
    });
  });

  describe('Very Large Content', () => {
    test('should handle 5MB innerHTML without corruption', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      // Create 5MB of content
      const largeContent = '<p>' + 'x'.repeat(5_000_000) + '</p>';
      div.innerHTML = largeContent;

      // Verify it worked
      expect(div.innerHTML.length).toBeGreaterThan(5_000_000);

      // Verify can still modify
      div.setAttribute('data-size', 'large');
      expect(div.getAttribute('data-size')).toBe('large');
    });

    test('should handle 1000 sibling elements', () => {
      const html = new HtmlMod('<div></div>');
      const div = html.querySelector('div')!;

      const siblings = Array.from({ length: 1000 }, (_, index) => `<p id="p-${index}">text-${index}</p>`).join('');
      div.innerHTML = siblings;

      // Modify parent
      for (let index = 0; index < 100; index++) {
        div.setAttribute('data-i', String(index));
      }

      expect(html.querySelectorAll('p').length).toBe(1000);
      expect(html.querySelector('#p-999')).not.toBeNull();
    });
  });

  describe('Deeply Nested Structures', () => {
    test('should handle 500 levels of nesting without corruption', () => {
      let nested = '<div>';
      for (let index = 0; index < 500; index++) {
        nested += '<div>';
      }
      nested += 'deep';
      for (let index = 0; index < 500; index++) {
        nested += '</div>';
      }
      nested += '</div>';

      const html = new HtmlMod(nested);

      // Modify root
      for (let index = 0; index < 100; index++) {
        const root = html.querySelector('div')!;
        root.setAttribute('data-i', String(index));
      }

      expect(html.querySelector('div')).not.toBeNull();
    });
  });

  describe('Attribute Name Edge Cases', () => {
    test('should handle attributes with hyphens', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      for (let index = 0; index < 100; index++) {
        div.setAttribute('data-user-id', String(index));
        div.setAttribute('aria-label', `label-${index}`);
        div.setAttribute('x-custom-attr', `value-${index}`);
      }

      expect(div.getAttribute('data-user-id')).toBe('99');
      expect(div.getAttribute('aria-label')).toBe('label-99');
      expect(div.getAttribute('x-custom-attr')).toBe('value-99');
    });

    test('should handle attributes with underscores', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      for (let index = 0; index < 100; index++) {
        div.setAttribute('data_user_id', String(index));
      }

      expect(div.getAttribute('data_user_id')).toBe('99');
    });

    test('should handle attributes with numbers', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      for (let index = 0; index < 100; index++) {
        div.setAttribute('data-item-123', String(index));
      }

      expect(div.getAttribute('data-item-123')).toBe('99');
    });
  });

  describe('Circular Reference Prevention', () => {
    test('should handle setting innerHTML to contain parent element', () => {
      const html = new HtmlMod('<div id="parent"><p>child</p></div>');
      const parent = html.querySelector('#parent')!;

      for (let index = 0; index < 10; index++) {
        parent.innerHTML = `<span>iteration-${index}</span>`;
      }

      expect(html.querySelector('#parent')).not.toBeNull();
    });

    test('should handle complex nested modifications', () => {
      const html = new HtmlMod('<div id="root"><section><article>content</article></section></div>');

      for (let index = 0; index < 100; index++) {
        const root = html.querySelector('#root')!;
        const section = html.querySelector('section')!;
        const article = html.querySelector('article')!;

        root.setAttribute('data-root', String(index));
        section.setAttribute('data-section', String(index));
        article.innerHTML = `content-${index}`;
      }

      expect(html.querySelector('#root')).not.toBeNull();
      expect(html.querySelector('section')).not.toBeNull();
      expect(html.querySelector('article')).not.toBeNull();
    });
  });

  describe('Round-Trip Integrity Verification', () => {
    test('should maintain integrity after 500 operations with full round-trip', () => {
      const html = new HtmlMod('<div id="root"><p class="text">initial</p></div>');

      for (let index = 0; index < 500; index++) {
        const div = html.querySelector('#root')!;
        const p = html.querySelector('p')!;

        div.setAttribute('data-iteration', String(index));
        p.innerHTML = `content-${index}`;

        // Every 50 operations, do a full round-trip validation
        if (index % 50 === 0) {
          const currentHTML = html.toString();

          // Parse HTML and verify structure
          const parsed = parseDocument(currentHTML);
          expect(parsed.children.length).toBeGreaterThan(0);

          // Re-create and verify
          const rebuilt = new HtmlMod(currentHTML);
          expect(rebuilt.querySelector('#root')).not.toBeNull();
          expect(rebuilt.querySelector('p')).not.toBeNull();
        }
      }

      // Final validation
      const finalHTML = html.toString();
      const finalParsed = new HtmlMod(finalHTML);

      expect(finalParsed.querySelector('#root')!.getAttribute('data-iteration')).toBe('499');
      expect(finalParsed.querySelector('p')!.innerHTML).toContain('content-499');
    });

    test('should detect position drift with character-level validation', () => {
      const html = new HtmlMod('<div class="test">content</div>');
      const div = html.querySelector('div')!;

      for (let index = 0; index < 1000; index++) {
        div.setAttribute('class', `iteration-${index}`);

        // Verify HTML structure every 100 iterations
        if (index % 100 === 0) {
          const htmlString = html.toString();

          // Verify opening tag exists
          expect(htmlString).toMatch(/<div /);

          // Verify class attribute exists
          expect(htmlString).toMatch(/class="iteration-\d+"/);

          // Verify closing tag exists
          expect(htmlString).toContain('</div>');

          // Verify no duplicate tags or corruption
          const divCount = (htmlString.match(/<div/g) || []).length;
          expect(divCount).toBe(1);
        }
      }

      // Final character-level validation
      const final = html.toString();
      expect(final).toBe('<div class="iteration-999">content</div>');
    });
  });
});
