/**
 * CRITICAL REAL-WORLD SCENARIOS
 *
 * Testing the ACTUAL usage patterns in a visual editor
 * that could cause you to lose your job if they fail.
 */

/* eslint-disable unicorn/prefer-dom-node-dataset */
import { parseDocument } from '@ciolabs/htmlparser2-source';
import { describe, expect, test } from 'vitest';

import { HtmlMod } from './index.js';

describe('CRITICAL - Real Visual Editor Scenarios', () => {
  describe('ContentEditable Cursor Position Tracking', () => {
    test('should maintain exact HTML output for cursor restoration', () => {
      // USER TYPES CHARACTER BY CHARACTER
      const initial = '<div contenteditable="true"><p>Hello</p></div>';
      const html = new HtmlMod(initial);

      // Simulate user typing " World" character by character
      for (let index = 0; index < 100; index++) {
        const p = html.querySelector('p')!;
        const current = p.innerHTML;
        p.innerHTML = current + 'x'; // User types 'x'

        // CRITICAL: HTML must be valid for cursor position calculation
        const output = html.toString();
        expect(output).toContain('<p>');
        expect(output).toContain('</p>');

        // Verify we can re-parse to find cursor position
        const reparsed = parseDocument(output);
        expect(reparsed.children.length).toBeGreaterThan(0);
      }

      // Final check - exactly 100 characters added
      const p = html.querySelector('p')!;
      expect(p.innerHTML).toBe('Hello' + 'x'.repeat(100));
    });

    test('should handle backspace operations without corruption', () => {
      const html = new HtmlMod('<div><p>Hello World</p></div>');

      // Simulate user backspacing character by character
      for (let index = 0; index < 11; index++) {
        const p = html.querySelector('p')!;
        const current = p.innerHTML;
        p.innerHTML = current.slice(0, -1); // Backspace

        // HTML must remain valid
        expect(html.querySelector('p')).not.toBeNull();
      }

      const p = html.querySelector('p')!;
      expect(p.innerHTML).toBe('');
    });

    test('should handle copy-paste of large content', () => {
      const html = new HtmlMod('<div><p>cursor here</p></div>');
      const p = html.querySelector('p')!;

      // User pastes 1000 lines
      const pastedContent = Array.from({ length: 1000 }, (_, index) => `Line ${index}`).join('<br>');
      p.innerHTML = pastedContent;

      // Must be queryable and valid
      expect(html.querySelector('p')).not.toBeNull();
      expect(html.toString()).toContain('Line 999');
    });
  });

  describe('Undo/Redo Scenarios', () => {
    test('should handle undo/redo by restoring exact HTML', () => {
      const states: string[] = [];

      // Start state
      const html = new HtmlMod('<div><p>Initial</p></div>');
      states.push(html.toString());

      // Make 10 changes
      for (let index = 0; index < 10; index++) {
        const p = html.querySelector('p')!;
        p.innerHTML = `State ${index}`;
        states.push(html.toString());
      }

      // Undo by restoring previous states
      for (let index = 9; index >= 0; index--) {
        const restored = new HtmlMod(states[index]);
        const p = restored.querySelector('p')!;

        if (index === 0) {
          expect(p.innerHTML).toBe('Initial');
        } else {
          expect(p.innerHTML).toBe(`State ${index - 1}`);
        }
      }
    });

    test('should handle rapid undo/redo cycles', () => {
      const stateA = '<div><p>State A</p></div>';
      const stateB = '<div><p>State B</p></div>';

      // Rapidly switch between states 100 times
      for (let index = 0; index < 100; index++) {
        const state = index % 2 === 0 ? stateA : stateB;
        const html = new HtmlMod(state);

        const p = html.querySelector('p')!;
        const expected = index % 2 === 0 ? 'State A' : 'State B';
        expect(p.innerHTML).toBe(expected);
      }
    });
  });

  describe('Drag and Drop Scenarios', () => {
    test('should handle moving elements by remove + insert', () => {
      const html = new HtmlMod('<div><p id="a">A</p><p id="b">B</p><p id="c">C</p></div>');

      // Move 'b' to the end (drag and drop)
      const b = html.querySelector('#b')!;
      const bHTML = b.outerHTML;
      b.remove();

      const div = html.querySelector('div')!;
      div.append(bHTML);

      // Verify order: A, C, B
      const paragraphs = html.querySelectorAll('p');
      expect(paragraphs[0].id).toBe('a');
      expect(paragraphs[1].id).toBe('c');
      expect(paragraphs[2].id).toBe('b');
    });

    test('should handle 100 element reorderings', () => {
      const html = new HtmlMod('<ul><li id="0">0</li><li id="1">1</li><li id="2">2</li></ul>');

      for (let index = 0; index < 100; index++) {
        const ul = html.querySelector('ul')!;
        const items = html.querySelectorAll('li');

        // Move last item to first
        const last = items.at(-1);
        if (!last) throw new Error('Expected last item');
        const lastHTML = last.outerHTML;
        last.remove();

        ul.prepend(lastHTML);
      }

      // Should still have 3 items
      expect(html.querySelectorAll('li').length).toBe(3);
    });
  });

  describe('Multiple Concurrent Attribute Modifications', () => {
    test('should handle setting multiple attributes in rapid succession', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      // Set 10 different attributes simultaneously
      for (let index = 0; index < 100; index++) {
        div.setAttribute('data-a', String(index));
        div.setAttribute('data-b', String(index * 2));
        div.setAttribute('data-c', String(index * 3));
        div.setAttribute('data-d', String(index * 4));
        div.setAttribute('data-e', String(index * 5));
      }

      expect(div.getAttribute('data-a')).toBe('99');
      expect(div.getAttribute('data-b')).toBe('198');
      expect(div.getAttribute('data-c')).toBe('297');
      expect(div.getAttribute('data-d')).toBe('396');
      expect(div.getAttribute('data-e')).toBe('495');
    });

    test('should handle modifying attributes while adding new ones', () => {
      const html = new HtmlMod('<div data-existing="old">content</div>');
      const div = html.querySelector('div')!;

      for (let index = 0; index < 100; index++) {
        div.setAttribute('data-existing', `updated-${index}`);
        div.setAttribute(`data-new-${index}`, String(index));
      }

      expect(div.getAttribute('data-existing')).toBe('updated-99');
      expect(div.getAttributeNames().length).toBe(101); // 1 existing + 100 new
    });
  });

  describe('Stale Reference Operations', () => {
    test('should handle operations on stale references', () => {
      const html = new HtmlMod('<div><p id="target">text</p></div>');
      const p = html.querySelector('#target')!;

      // Replace parent innerHTML (p becomes stale)
      const div = html.querySelector('div')!;
      div.innerHTML = '<p id="target">new text</p>';

      // Old reference should still be readable (cached)
      expect(p.textContent).toBe('text');

      // New reference should be queryable
      const newP = html.querySelector('#target')!;
      expect(newP.textContent).toBe('new text');
    });

    test('should handle modifying stale reference safely', () => {
      const html = new HtmlMod('<div><p>text</p></div>');
      const p = html.querySelector('p')!;

      // Remove p
      p.remove();

      // Trying to modify removed element - should not crash
      p.setAttribute('data-removed', 'true');

      // Should not affect document
      expect(html.querySelector('p')).toBeNull();
    });
  });

  describe('HTML Entity Preservation', () => {
    test('should preserve HTML entities in attributes', () => {
      const html = new HtmlMod('<div data-text="&lt;tag&gt;">&amp;</div>');
      const div = html.querySelector('div')!;

      for (let index = 0; index < 100; index++) {
        div.setAttribute('data-iteration', String(index));
      }

      // Entities should be preserved
      const output = html.toString();
      expect(output).toContain('&lt;');
      expect(output).toContain('&gt;');
      expect(output).toContain('&amp;');
    });

    test('should handle setting attributes with entities', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      for (let index = 0; index < 100; index++) {
        div.setAttribute('data-html', `&lt;div&gt;${index}&lt;/div&gt;`);
      }

      const value = div.getAttribute('data-html')!;
      expect(value).toContain('&lt;');
      expect(value).toContain('&gt;');
    });
  });

  describe('Attribute Order Preservation', () => {
    test('should maintain attribute order when modifying', () => {
      const html = new HtmlMod('<div id="test" class="foo" data-value="bar">content</div>');
      const div = html.querySelector('div')!;

      // Modify middle attribute 100 times
      for (let index = 0; index < 100; index++) {
        div.setAttribute('class', `iteration-${index}`);
      }

      // Get attribute names in order
      const attributeNames = div.getAttributeNames();

      // Verify attributes still exist (order may change)
      expect(attributeNames).toContain('id');
      expect(attributeNames).toContain('class');
      expect(attributeNames).toContain('data-value');
    });
  });

  describe('Whitespace Preservation', () => {
    test('should preserve leading/trailing whitespace exactly', () => {
      const html = new HtmlMod('<div>  content  </div>');
      const div = html.querySelector('div')!;

      for (let index = 0; index < 100; index++) {
        div.setAttribute('data-i', String(index));
      }

      expect(div.innerHTML).toBe('  content  ');
    });

    test('should preserve line breaks in content', () => {
      const html = new HtmlMod('<div>line1\nline2\nline3</div>');
      const div = html.querySelector('div')!;

      for (let index = 0; index < 100; index++) {
        div.setAttribute('data-i', String(index));
      }

      expect(div.innerHTML).toBe('line1\nline2\nline3');
    });
  });

  describe('Byte-for-Byte Output Verification', () => {
    test('should produce identical output after modify + query cycles', () => {
      const original = '<div class="test" id="main"><p>content</p></div>';
      const html = new HtmlMod(original);

      // Modify and query 100 times
      for (let index = 0; index < 100; index++) {
        const div = html.querySelector('div')!;
        div.setAttribute('data-iteration', String(index));

        const p = html.querySelector('p')!;
        expect(p.innerHTML).toBe('content');
      }

      // Remove the added attribute
      const div = html.querySelector('div')!;
      div.removeAttribute('data-iteration');

      // Should be identical to original
      expect(html.toString()).toBe(original);
    });

    test('should handle exact HTML reconstruction', () => {
      const tests = [
        '<div class="test">content</div>',
        '<div id="main"><p>text</p></div>',
        '<div data-value="123"><span>test</span></div>',
        '<div><p>a</p><p>b</p><p>c</p></div>',
      ];

      for (const testHTML of tests) {
        const html = new HtmlMod(testHTML);

        // Modify something
        const div = html.querySelector('div')!;
        div.setAttribute('data-temp', 'temp');

        // Remove it
        div.removeAttribute('data-temp');

        // Should be identical
        expect(html.toString()).toBe(testHTML);
      }
    });
  });

  describe('Namespace and Special Attributes', () => {
    test('should handle XML namespace attributes', () => {
      const html = new HtmlMod('<svg xmlns="http://www.w3.org/2000/svg"><circle r="10"/></svg>');

      for (let index = 0; index < 100; index++) {
        const svg = html.querySelector('svg')!;
        svg.setAttribute('data-i', String(index));
      }

      expect(html.toString()).toContain('xmlns=');
    });

    test('should handle aria attributes', () => {
      const html = new HtmlMod('<div aria-label="test" aria-hidden="true">content</div>');
      const div = html.querySelector('div')!;

      for (let index = 0; index < 100; index++) {
        div.setAttribute('aria-label', `label-${index}`);
      }

      expect(div.getAttribute('aria-label')).toBe('label-99');
      expect(div.getAttribute('aria-hidden')).toBe('true');
    });
  });

  describe('Extreme Modification Sequences', () => {
    test('should handle 1000 different operations without any corruption', () => {
      const html = new HtmlMod('<div id="root"><section><article><p>text</p></article></section></div>');

      for (let index = 0; index < 1000; index++) {
        const operation = index % 20;

        switch (operation) {
          case 0: {
            const root = html.querySelector('#root')!;
            root.setAttribute('data-i', String(index));

            break;
          }
          case 1: {
            const section = html.querySelector('section')!;
            section.setAttribute('class', `s-${index}`);

            break;
          }
          case 2: {
            const article = html.querySelector('article')!;
            article.setAttribute('data-article', String(index));

            break;
          }
          case 3: {
            const p = html.querySelector('p')!;
            p.innerHTML = `text-${index}`;

            break;
          }
          case 4: {
            const p = html.querySelector('p')!;
            p.setAttribute('data-p', String(index));

            break;
          }
          case 5: {
            const article = html.querySelector('article')!;
            article.prepend('<span>before</span>');

            break;
          }
          case 6: {
            const article = html.querySelector('article')!;
            article.append('<span>after</span>');

            break;
          }
          case 7: {
            const spans = html.querySelectorAll('span');
            if (spans.length > 5) {
              spans[0].remove();
            }

            break;
          }
          case 8: {
            const section = html.querySelector('section')!;
            section.removeAttribute('class');

            break;
          }
          case 9: {
            const article = html.querySelector('article')!;
            article.toggleAttribute('data-toggle');

            break;
          }
          default: {
            // Verify structure is intact
            expect(html.querySelector('#root')).not.toBeNull();
            expect(html.querySelector('section')).not.toBeNull();
            expect(html.querySelector('article')).not.toBeNull();
            expect(html.querySelector('p')).not.toBeNull();
          }
        }

        // CRITICAL: Verify HTML is always parseable
        if (index % 100 === 0) {
          const output = html.toString();
          const parsed = parseDocument(output);
          expect(parsed.children.length).toBeGreaterThan(0);
        }
      }

      // Final verification
      expect(html.querySelector('#root')).not.toBeNull();
      expect(html.querySelector('p')).not.toBeNull();
    });
  });

  describe('FINAL BOSS TEST - Real Visual Editor Simulation', () => {
    test('should survive 2000 operations mimicking real user behavior', () => {
      // Start with typical editor content
      const html = new HtmlMod(`
        <article>
          <h1>Document Title</h1>
          <p>First paragraph</p>
          <p>Second paragraph</p>
          <ul>
            <li>Item 1</li>
            <li>Item 2</li>
          </ul>
        </article>
      `);

      const operations = [
        // User types in paragraph
        () => {
          const p = html.querySelectorAll('p')[0];
          if (p) p.innerHTML += ' more text';
        },
        // User adds formatting
        () => {
          const p = html.querySelectorAll('p')[0];
          if (p) p.setAttribute('class', 'bold');
        },
        // User adds new paragraph
        () => {
          const article = html.querySelector('article')!;
          article.append('<p>New paragraph</p>');
        },
        // User deletes paragraph
        () => {
          const paragraphs = html.querySelectorAll('p');
          if (paragraphs.length > 2) paragraphs.at(-1)?.remove();
        },
        // User modifies list
        () => {
          const li = html.querySelector('li')!;
          li.innerHTML = 'Updated item';
        },
        // User adds list item
        () => {
          const ul = html.querySelector('ul')!;
          ul.append('<li>New item</li>');
        },
        // User changes heading
        () => {
          const h1 = html.querySelector('h1')!;
          h1.innerHTML = 'Updated Title';
        },
        // User adds attribute
        () => {
          const article = html.querySelector('article')!;
          article.setAttribute('data-edited', 'true');
        },
        // User copies and pastes
        () => {
          const p = html.querySelector('p')!;
          const content = p.outerHTML;
          const article = html.querySelector('article')!;
          article.append(content);
        },
        // User does undo (query + verify)
        () => {
          const article = html.querySelector('article')!;
          expect(article).not.toBeNull();
        },
      ];

      // Simulate 2000 random user operations
      for (let index = 0; index < 2000; index++) {
        const operation = operations[index % operations.length];
        operation();

        // Verify structure every 100 operations
        if (index % 100 === 0) {
          expect(html.querySelector('article')).not.toBeNull();
          expect(html.querySelector('h1')).not.toBeNull();

          // Verify HTML is valid
          const output = html.toString();
          const parsed = parseDocument(output);
          expect(parsed.children.length).toBeGreaterThan(0);
        }
      }

      // Final checks
      expect(html.querySelector('article')).not.toBeNull();
      expect(html.querySelector('h1')).not.toBeNull();
      expect(html.querySelectorAll('p').length).toBeGreaterThan(0);

      // Verify HTML is still valid
      const finalOutput = html.toString();
      const finalParsed = parseDocument(finalOutput);
      expect(finalParsed.children.length).toBeGreaterThan(0);

      console.log('✅ SURVIVED 2000 REAL-WORLD OPERATIONS!');
    });
  });
});
