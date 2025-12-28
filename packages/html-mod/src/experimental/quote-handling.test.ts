/**
 * Comprehensive Quote Handling Tests
 *
 * Tests all quote scenarios for attributes to ensure zero drift
 * in visual editors where quote consistency is critical.
 */

/* eslint-disable unicorn/prefer-dom-node-dataset */
import { describe, expect, test } from 'vitest';

import { HtmlMod } from './index';

describe('Quote Handling - Attribute Operations', () => {
  describe('Setting Attributes with Different Quote Types', () => {
    test('should handle setting attribute with double quotes in value', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      div.setAttribute('data-text', 'He said "hello"');
      expect(div.getAttribute('data-text')).toBe('He said "hello"');

      // Verify HTML is valid
      expect(html.toString()).toContain('data-text=');
    });

    test('should handle setting attribute with single quotes in value', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      div.setAttribute('data-text', "It's working");
      expect(div.getAttribute('data-text')).toBe("It's working");

      // Verify HTML is valid
      expect(html.toString()).toContain('data-text=');
    });

    test('should handle setting attribute with both quote types in value', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      div.setAttribute('data-text', `He said "it's working"`);
      expect(div.getAttribute('data-text')).toBe(`He said "it's working"`);
    });

    test('should handle empty string value', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      div.setAttribute('data-empty', '');
      expect(div.getAttribute('data-empty')).toBe('');
      expect(div.hasAttribute('data-empty')).toBe(true);
    });
  });

  describe('Parsing HTML with Different Quote Styles', () => {
    test('should handle HTML with double-quoted attributes', () => {
      const html = new HtmlMod('<div class="test" id="main">content</div>');
      const div = html.querySelector('div')!;

      expect(div.getAttribute('class')).toBe('test');
      expect(div.getAttribute('id')).toBe('main');

      // Modify and verify still works
      div.setAttribute('class', 'updated');
      expect(div.getAttribute('class')).toBe('updated');
    });

    test('should handle HTML with single-quoted attributes', () => {
      const html = new HtmlMod("<div class='test' id='main'>content</div>");
      const div = html.querySelector('div')!;

      expect(div.getAttribute('class')).toBe('test');
      expect(div.getAttribute('id')).toBe('main');

      // Modify and verify still works
      div.setAttribute('class', 'updated');
      expect(div.getAttribute('class')).toBe('updated');
    });

    test('should handle HTML with mixed quote styles', () => {
      const html = new HtmlMod(`<div class="double" id='single'>content</div>`);
      const div = html.querySelector('div')!;

      expect(div.getAttribute('class')).toBe('double');
      expect(div.getAttribute('id')).toBe('single');

      // Modify both and verify
      div.setAttribute('class', 'updated-double');
      div.setAttribute('id', 'updated-single');

      expect(div.getAttribute('class')).toBe('updated-double');
      expect(div.getAttribute('id')).toBe('updated-single');
    });

    test('should handle HTML with unquoted attributes', () => {
      const html = new HtmlMod('<div class=test id=main>content</div>');
      const div = html.querySelector('div')!;

      expect(div.getAttribute('class')).toBe('test');
      expect(div.getAttribute('id')).toBe('main');

      // Modify and verify
      div.setAttribute('class', 'updated');
      expect(div.getAttribute('class')).toBe('updated');
    });
  });

  describe('Modifying Attributes with Different Quote Styles', () => {
    test('should handle modifying double-quoted attribute 100 times', () => {
      const html = new HtmlMod('<div data-value="initial">content</div>');
      const div = html.querySelector('div')!;

      for (let index = 0; index < 100; index++) {
        div.setAttribute('data-value', `value-${index}`);
      }

      expect(div.getAttribute('data-value')).toBe('value-99');
      expect(html.querySelector('div')).not.toBeNull();
    });

    test('should handle modifying single-quoted attribute 100 times', () => {
      const html = new HtmlMod("<div data-value='initial'>content</div>");
      const div = html.querySelector('div')!;

      for (let index = 0; index < 100; index++) {
        div.setAttribute('data-value', `value-${index}`);
      }

      expect(div.getAttribute('data-value')).toBe('value-99');
      expect(html.querySelector('div')).not.toBeNull();
    });

    test('should handle modifying unquoted attribute 100 times', () => {
      const html = new HtmlMod('<div data-value=initial>content</div>');
      const div = html.querySelector('div')!;

      for (let index = 0; index < 100; index++) {
        div.setAttribute('data-value', `value-${index}`);
      }

      expect(div.getAttribute('data-value')).toBe('value-99');
      expect(html.querySelector('div')).not.toBeNull();
    });

    test('should handle switching between different quote styles', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      // Start with no quotes
      div.setAttribute('data-test', 'plain');

      // Add value with quotes inside
      div.setAttribute('data-test', 'with "double" quotes');

      // Add value with single quotes inside
      div.setAttribute('data-test', "with 'single' quotes");

      // Add value with both
      div.setAttribute('data-test', `with "both" 'types'`);

      // Verify final value
      expect(div.getAttribute('data-test')).toBe(`with "both" 'types'`);
      expect(html.querySelector('div')).not.toBeNull();
    });
  });

  describe('Quote Handling with Remove/Add Cycles', () => {
    test('should handle 100 remove/add cycles with double quotes', () => {
      const html = new HtmlMod('<div data-test="initial">content</div>');
      const div = html.querySelector('div')!;

      for (let index = 0; index < 100; index++) {
        div.removeAttribute('data-test');
        div.setAttribute('data-test', `value-${index}`);
      }

      expect(div.getAttribute('data-test')).toBe('value-99');
    });

    test('should handle 100 remove/add cycles with single quotes', () => {
      const html = new HtmlMod("<div data-test='initial'>content</div>");
      const div = html.querySelector('div')!;

      for (let index = 0; index < 100; index++) {
        div.removeAttribute('data-test');
        div.setAttribute('data-test', `value-${index}`);
      }

      expect(div.getAttribute('data-test')).toBe('value-99');
    });

    test('should handle 100 remove/add cycles with unquoted', () => {
      const html = new HtmlMod('<div data-test=initial>content</div>');
      const div = html.querySelector('div')!;

      for (let index = 0; index < 100; index++) {
        div.removeAttribute('data-test');
        div.setAttribute('data-test', `value-${index}`);
      }

      expect(div.getAttribute('data-test')).toBe('value-99');
    });

    test('should handle alternating between quote styles during cycles', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      for (let index = 0; index < 100; index++) {
        div.removeAttribute('data-test');

        if (index % 3 === 0) {
          div.setAttribute('data-test', 'plain');
        } else if (index % 3 === 1) {
          div.setAttribute('data-test', `with "quotes"`);
        } else {
          div.setAttribute('data-test', `with 'apostrophes'`);
        }
      }

      // i=99: 99 % 3 = 0, so final value should be 'plain'
      expect(div.getAttribute('data-test')).toBe('plain');
      expect(html.querySelector('div')).not.toBeNull();
    });
  });

  describe('Quote Handling with Multiple Attributes', () => {
    test('should handle multiple attributes with different quote styles', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      div.setAttribute('data-double', 'value with "double"');
      div.setAttribute('data-single', "value with 'single'");
      div.setAttribute('data-both', `value with "both" 'types'`);
      div.setAttribute('data-plain', 'plain value');

      expect(div.getAttribute('data-double')).toBe('value with "double"');
      expect(div.getAttribute('data-single')).toBe("value with 'single'");
      expect(div.getAttribute('data-both')).toBe(`value with "both" 'types'`);
      expect(div.getAttribute('data-plain')).toBe('plain value');
    });

    test('should handle 100 operations on multiple attributes with different quotes', () => {
      const html = new HtmlMod(`<div data-a="double" data-b='single' data-c=unquoted>content</div>`);
      const div = html.querySelector('div')!;

      for (let index = 0; index < 100; index++) {
        div.setAttribute('data-a', `a-${index}`);
        div.setAttribute('data-b', `b-${index}`);
        div.setAttribute('data-c', `c-${index}`);
      }

      expect(div.getAttribute('data-a')).toBe('a-99');
      expect(div.getAttribute('data-b')).toBe('b-99');
      expect(div.getAttribute('data-c')).toBe('c-99');
    });
  });

  describe('Edge Cases with Quotes', () => {
    test('should handle value with escaped quotes', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      div.setAttribute('data-json', '{"key":"value"}');
      expect(div.getAttribute('data-json')).toBe('{"key":"value"}');
    });

    test('should handle value with newlines and quotes', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      div.setAttribute('data-text', 'line1\n"quoted"\nline3');
      expect(div.getAttribute('data-text')).toContain('"quoted"');
    });

    test('should handle value with HTML-like content', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      div.setAttribute('data-html', '<a href="link">text</a>');
      expect(div.getAttribute('data-html')).toBe('<a href="link">text</a>');
    });

    test('should handle extremely long value with quotes', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      const longValue = 'start-' + 'x'.repeat(1000) + '-"quoted"-' + 'y'.repeat(1000) + '-end';
      div.setAttribute('data-long', longValue);

      expect(div.getAttribute('data-long')).toBe(longValue);
      expect(div.getAttribute('data-long')!.length).toBeGreaterThan(2000);
    });

    test('should handle consecutive quote characters', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      div.setAttribute('data-quotes', '""\'\'""\'\'');
      expect(div.getAttribute('data-quotes')).toBe('""\'\'""\'\'');
    });

    test('should handle backticks in attribute values', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      div.setAttribute('data-template', 'Value with `backticks`');
      expect(div.getAttribute('data-template')).toBe('Value with `backticks`');
    });
  });

  describe('Quote Handling During Complex Operations', () => {
    test('should preserve quote handling during innerHTML changes', () => {
      const html = new HtmlMod(`<div data-attr="value">content</div>`);
      const div = html.querySelector('div')!;

      for (let index = 0; index < 50; index++) {
        div.innerHTML = `<p>content-${index}</p>`;
        div.setAttribute('data-attr', `value-${index}`);
      }

      expect(div.getAttribute('data-attr')).toBe('value-49');
      expect(html.querySelector('p')).not.toBeNull();
    });

    test('should handle quotes during prepend/append operations', () => {
      const html = new HtmlMod(`<div data-attr="initial">content</div>`);
      const div = html.querySelector('div')!;

      for (let index = 0; index < 50; index++) {
        if (index % 2 === 0) {
          div.prepend(`<span data-id="${index}">pre</span>`);
        } else {
          div.append(`<span data-id='${index}'>post</span>`);
        }
        div.setAttribute('data-attr', `value-${index}`);
      }

      expect(div.getAttribute('data-attr')).toBe('value-49');
      expect(html.querySelectorAll('span').length).toBe(50);
    });

    test('should handle quotes during element removal', () => {
      const html = new HtmlMod(`<div><p data-test="value">text</p></div>`);

      for (let index = 0; index < 100; index++) {
        const div = html.querySelector('div')!;
        div.innerHTML = `<p data-test="value-${index}">text-${index}</p>`;

        const p = html.querySelector('p')!;
        expect(p.getAttribute('data-test')).toBe(`value-${index}`);

        if (index < 99) {
          p.remove();
        }
      }

      const finalP = html.querySelector('p')!;
      expect(finalP.getAttribute('data-test')).toBe('value-99');
    });
  });

  describe('Quote Handling with Dataset API', () => {
    test('should handle dataset with values containing quotes', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      for (let index = 0; index < 100; index++) {
        div.dataset.test = `value-with-"quotes"-${index}`;
      }

      expect(div.dataset.test).toContain('"quotes"');
      expect(div.dataset.test).toBe('value-with-"quotes"-99');
    });

    test('should handle mixing dataset and setAttribute with different quote styles', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      for (let index = 0; index < 100; index++) {
        if (index % 2 === 0) {
          div.dataset.test = `dataset-${index}`;
        } else {
          div.setAttribute('data-test', `setAttribute-${index}`);
        }
      }

      expect(div.dataset.test).toBe('setAttribute-99');
      expect(div.getAttribute('data-test')).toBe('setAttribute-99');
    });
  });

  describe('Stress Test - Quote Handling Under Load', () => {
    test('should handle 1000 operations with random quote scenarios', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      for (let index = 0; index < 1000; index++) {
        const scenario = index % 5;

        switch (scenario) {
          case 0: {
            div.setAttribute('data-test', 'plain');

            break;
          }
          case 1: {
            div.setAttribute('data-test', `with "double"`);

            break;
          }
          case 2: {
            div.setAttribute('data-test', `with 'single'`);

            break;
          }
          case 3: {
            div.setAttribute('data-test', `with "both" 'types'`);

            break;
          }
          default: {
            div.setAttribute('data-test', '{"json":"value"}');
          }
        }
      }

      // Verify element is still queryable
      expect(html.querySelector('div')).not.toBeNull();

      // Verify HTML is still valid
      expect(html.toString()).toContain('<div');
      expect(html.toString()).toContain('</div>');
    });
  });
});
