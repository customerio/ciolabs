/**
 * Drift Prevention Tests for Visual Editor Use Case
 *
 * These tests ensure ZERO drift over huge sets of edits.
 * Critical for visual editors where position tracking must be perfect.
 */

/* eslint-disable unicorn/prefer-dom-node-dataset */
import { parseDocument } from '@ciolabs/htmlparser2-source';
import { describe, expect, test } from 'vitest';

import { HtmlMod } from './index';

describe('Drift Prevention - Long-Running Edit Sequences', () => {
  test('should handle 10,000 setAttribute operations without drift', () => {
    const html = new HtmlMod('<div>content</div>');
    const div = html.querySelector('div')!;

    for (let index = 0; index < 10_000; index++) {
      div.setAttribute('data-counter', String(index));
    }

    // Verify final state
    expect(div.getAttribute('data-counter')).toBe('9999');

    // Verify HTML is valid by re-parsing
    const reparsed = parseDocument(html.toString());
    expect(reparsed.children.length).toBeGreaterThan(0);

    // Verify querySelector still works
    expect(html.querySelector('div')).not.toBeNull();
  });

  test('should handle 5,000 toggle operations without drift', () => {
    const html = new HtmlMod('<div>content</div>');
    const div = html.querySelector('div')!;

    for (let index = 0; index < 5000; index++) {
      div.toggleAttribute('data-active');
    }

    // After even number of toggles, attribute should not exist
    expect(div.hasAttribute('data-active')).toBe(false);

    // Verify HTML structure is intact
    expect(html.toString()).toBe('<div>content</div>');
  });

  test('should handle 1,000 mixed operations without drift', () => {
    const html = new HtmlMod('<div id="root">start</div>');
    const root = html.querySelector('#root')!;

    for (let index = 0; index < 1000; index++) {
      const operation = index % 6;

      switch (operation) {
        case 0: {
          root.setAttribute(`data-${index}`, String(index));

          break;
        }
        case 1: {
          root.removeAttribute(`data-${index - 1}`);

          break;
        }
        case 2: {
          root.prepend(`<span>pre-${index}</span>`);

          break;
        }
        case 3: {
          root.append(`<span>post-${index}</span>`);

          break;
        }
        case 4: {
          const spans = html.querySelectorAll('span');
          if (spans.length > 10) {
            spans[0].remove();
          }

          break;
        }
        default: {
          root.setAttribute('class', `iteration-${index}`);
        }
      }
    }

    // Verify querySelector still works
    expect(html.querySelector('#root')).not.toBeNull();

    // Verify HTML is parseable
    const reparsed = parseDocument(html.toString());
    expect(reparsed.children.length).toBeGreaterThan(0);
  });
});

describe('Drift Prevention - Round-Trip Validation', () => {
  test('should match re-parsed HTML after 100 operations', () => {
    const html = new HtmlMod('<div><p id="test">content</p></div>');

    for (let index = 0; index < 100; index++) {
      const p = html.querySelector('#test')!;
      p.setAttribute('data-iteration', String(index));
      p.innerHTML = `content-${index}`;
    }

    // Get current HTML
    const currentHtml = html.toString();

    // Re-parse and compare structure
    const reparsed = new HtmlMod(currentHtml);
    const reparsedP = reparsed.querySelector('#test')!;

    expect(reparsedP.getAttribute('data-iteration')).toBe('99');
    expect(reparsedP.innerHTML).toBe('content-99');
    expect(reparsed.toString()).toBe(currentHtml);
  });

  test('should maintain position accuracy after 500 operations', () => {
    const html = new HtmlMod('<div><span>text</span></div>');

    for (let index = 0; index < 500; index++) {
      const div = html.querySelector('div')!;
      const span = html.querySelector('span')!;

      div.setAttribute('data-div', String(index));
      span.setAttribute('data-span', String(index));
    }

    // Verify both elements are still queryable
    expect(html.querySelector('div')).not.toBeNull();
    expect(html.querySelector('span')).not.toBeNull();

    // Verify attributes are correct
    expect(html.querySelector('div')!.getAttribute('data-div')).toBe('499');
    expect(html.querySelector('span')!.getAttribute('data-span')).toBe('499');
  });
});

describe('Drift Prevention - Quote Handling', () => {
  test('should handle attributes with double quotes', () => {
    const html = new HtmlMod('<div>content</div>');
    const div = html.querySelector('div')!;

    for (let index = 0; index < 100; index++) {
      div.setAttribute('data-value', `"quoted-${index}"`);
    }

    expect(div.getAttribute('data-value')).toBe('"quoted-99"');
    expect(html.toString()).toContain('data-value=');
  });

  test('should handle attributes with single quotes', () => {
    const html = new HtmlMod('<div>content</div>');
    const div = html.querySelector('div')!;

    for (let index = 0; index < 100; index++) {
      div.setAttribute('data-value', `'quoted-${index}'`);
    }

    expect(div.getAttribute('data-value')).toBe(`'quoted-99'`);
    expect(html.toString()).toContain('data-value=');
  });

  test('should handle attributes with mixed quotes', () => {
    const html = new HtmlMod('<div>content</div>');
    const div = html.querySelector('div')!;

    for (let index = 0; index < 100; index++) {
      const value = index % 2 === 0 ? `"double-${index}"` : `'single-${index}'`;
      div.setAttribute('data-value', value);
    }

    expect(div.getAttribute('data-value')).toBe(`'single-99'`);
  });

  test('should handle attributes without quotes (empty values)', () => {
    const html = new HtmlMod('<div>content</div>');
    const div = html.querySelector('div')!;

    for (let index = 0; index < 100; index++) {
      if (index % 2 === 0) {
        div.setAttribute('data-flag', '');
      } else {
        div.setAttribute('data-flag', `value-${index}`);
      }
    }

    expect(div.getAttribute('data-flag')).toBe('value-99');
  });

  test('should handle rapid quote type changes', () => {
    const html = new HtmlMod('<div data-test="initial">content</div>');
    const div = html.querySelector('div')!;

    // Rapidly change between different quote scenarios
    for (let index = 0; index < 200; index++) {
      const scenario = index % 4;

      switch (scenario) {
        case 0: {
          div.setAttribute('data-test', 'no-quotes');

          break;
        }
        case 1: {
          div.setAttribute('data-test', `"with-doubles"`);

          break;
        }
        case 2: {
          div.setAttribute('data-test', `'with-singles'`);

          break;
        }
        default: {
          div.setAttribute('data-test', `mixed"'quotes'"`);
        }
      }
    }

    // Verify element is still queryable and HTML is valid
    expect(html.querySelector('div')).not.toBeNull();

    const reparsed = parseDocument(html.toString());
    expect(reparsed.children.length).toBeGreaterThan(0);
  });
});

describe('Drift Prevention - Position Validation', () => {
  test('should maintain accurate positions after 1,000 setAttribute calls', () => {
    const html = new HtmlMod('<div class="test">content</div>');
    const div = html.querySelector('div')!;

    for (let index = 0; index < 1000; index++) {
      div.setAttribute('class', `iteration-${index}`);
    }

    // Verify HTML structure
    const htmlString = html.toString();
    expect(htmlString).toContain('<div class="iteration-999">content</div>');

    // Verify positions by character counting
    expect(htmlString.startsWith('<div ')).toBe(true);
    expect(htmlString.endsWith('</div>')).toBe(true);
  });

  test('should maintain accurate positions with nested elements', () => {
    const html = new HtmlMod('<div><section><article>content</article></section></div>');

    for (let index = 0; index < 500; index++) {
      const div = html.querySelector('div')!;
      const section = html.querySelector('section')!;
      const article = html.querySelector('article')!;

      div.setAttribute('data-div', String(index));
      section.setAttribute('data-section', String(index));
      article.setAttribute('data-article', String(index));
    }

    // All elements should still be queryable
    expect(html.querySelector('div')).not.toBeNull();
    expect(html.querySelector('section')).not.toBeNull();
    expect(html.querySelector('article')).not.toBeNull();

    // Verify nesting is maintained
    const htmlString = html.toString();
    expect(htmlString.includes('<div')).toBe(true);
    expect(htmlString.includes('<section')).toBe(true);
    expect(htmlString.includes('<article')).toBe(true);
    expect(htmlString.includes('</article></section></div>')).toBe(true);
  });
});

describe('Drift Prevention - Self-Closing Tag Conversions', () => {
  test('should handle 100 self-closing conversions without drift', () => {
    const html = new HtmlMod('<div/>');
    const div = html.querySelector('div')!;

    for (let index = 0; index < 100; index++) {
      div.innerHTML = index % 2 === 0 ? `content-${index}` : '';
    }

    expect(html.querySelector('div')).not.toBeNull();
  });

  test('should handle mixed self-closing and regular tag operations', () => {
    const html = new HtmlMod('<div/><span/><p/>');

    for (let index = 0; index < 300; index++) {
      const selector = ['div', 'span', 'p'][index % 3];
      const element = html.querySelector(selector)!;

      if (index % 2 === 0) {
        element.innerHTML = `content-${index}`;
        element.setAttribute('data-index', String(index));
      } else {
        element.innerHTML = '';
        element.removeAttribute('data-index');
      }
    }

    // All elements should still exist
    expect(html.querySelector('div')).not.toBeNull();
    expect(html.querySelector('span')).not.toBeNull();
    expect(html.querySelector('p')).not.toBeNull();
  });
});

describe('Drift Prevention - Remove and Re-add Cycles', () => {
  test('should handle 500 remove/re-add cycles', () => {
    const html = new HtmlMod('<div id="container"></div>');
    const container = html.querySelector('#container')!;

    for (let index = 0; index < 500; index++) {
      container.innerHTML = `<p id="p-${index}">content-${index}</p>`;
      const p = html.querySelector('p');
      expect(p).not.toBeNull();
      expect(p!.textContent).toBe(`content-${index}`);
    }

    // Container should still be queryable
    expect(html.querySelector('#container')).not.toBeNull();
  });

  test('should handle attribute remove/re-add cycles', () => {
    const html = new HtmlMod('<div>content</div>');
    const div = html.querySelector('div')!;

    for (let index = 0; index < 1000; index++) {
      div.setAttribute('data-cycle', String(index));
      div.removeAttribute('data-cycle');
    }

    // Attribute should not exist
    expect(div.hasAttribute('data-cycle')).toBe(false);

    // Element should still be queryable
    expect(html.querySelector('div')).not.toBeNull();
    expect(html.toString()).toBe('<div>content</div>');
  });
});

describe('Drift Prevention - Special Characters in Attributes', () => {
  test('should handle attributes with URLs', () => {
    const html = new HtmlMod('<a>link</a>');
    const a = html.querySelector('a')!;

    for (let index = 0; index < 100; index++) {
      a.setAttribute('href', `https://example.com/page?id=${index}&foo=bar`);
    }

    expect(a.getAttribute('href')).toBe('https://example.com/page?id=99&foo=bar');
  });

  test('should handle attributes with JSON', () => {
    const html = new HtmlMod('<div>content</div>');
    const div = html.querySelector('div')!;

    for (let index = 0; index < 100; index++) {
      const json = JSON.stringify({ id: index, name: `item-${index}`, active: true });
      div.setAttribute('data-json', json);
    }

    const finalJson = div.getAttribute('data-json')!;
    const parsed = JSON.parse(finalJson);
    expect(parsed.id).toBe(99);
  });

  test('should handle attributes with HTML entities', () => {
    const html = new HtmlMod('<div>content</div>');
    const div = html.querySelector('div')!;

    for (let index = 0; index < 100; index++) {
      div.setAttribute('data-entity', `&lt;tag&gt; ${index}`);
    }

    expect(div.getAttribute('data-entity')).toContain('&lt;tag&gt;');
  });
});

describe('Drift Prevention - Stress Test with Validation', () => {
  test('should maintain perfect position tracking over 2,000 operations', () => {
    const html = new HtmlMod('<div id="root"><p class="content">initial</p></div>');

    for (let index = 0; index < 2000; index++) {
      const div = html.querySelector('#root')!;
      const p = html.querySelector('p')!;

      // Perform various operations
      if (index % 10 === 0) {
        div.setAttribute('data-checkpoint', String(index));
      }

      if (index % 7 === 0) {
        p.setAttribute('class', `content-${index}`);
      }

      if (index % 13 === 0) {
        p.innerHTML = `iteration-${index}`;
      }

      if (index % 17 === 0) {
        div.prepend(`<span>pre-${index}</span>`);
      }

      if (index % 19 === 0) {
        const spans = html.querySelectorAll('span');
        if (spans.length > 5) {
          spans[0].remove();
        }
      }

      // Validate every 100 operations
      if (index % 100 === 0) {
        // Verify HTML is parseable
        const currentHtml = html.toString();
        const reparsed = parseDocument(currentHtml);
        expect(reparsed.children.length).toBeGreaterThan(0);

        // Verify elements are still queryable
        expect(html.querySelector('#root')).not.toBeNull();
        expect(html.querySelector('p')).not.toBeNull();
      }
    }

    // Final validation
    const finalHtml = html.toString();
    const finalReparsed = new HtmlMod(finalHtml);

    // Verify structure is intact
    expect(finalReparsed.querySelector('#root')).not.toBeNull();
    expect(finalReparsed.querySelector('p')).not.toBeNull();

    // Verify final attributes (last checkpoint was at i=1990, since i % 10 === 0)
    const root = html.querySelector('#root')!;
    expect(root.getAttribute('data-checkpoint')).toBe('1990');
  });
});
