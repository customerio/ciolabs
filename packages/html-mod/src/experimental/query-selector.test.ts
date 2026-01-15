import { describe, expect, test } from 'vitest';

import { HtmlMod } from './index';

describe('querySelector and querySelectorAll', () => {
  describe(':scope selector', () => {
    describe('on HtmlMod (root document)', () => {
      test('should select direct children with :scope > *', () => {
        const html = new HtmlMod(`
          <div>first</div>
          <span>second</span>
        `);

        const children = html.querySelectorAll(':scope > *');

        expect(children.length).toBe(2);
        expect(children[0].tagName).toBe('div');
        expect(children[1].tagName).toBe('span');
      });

      test('should select nested direct children with :scope > tag', () => {
        const html = new HtmlMod(`
          <container>
            <row>
              <column></column>
            </row>
          </container>
        `);

        const containers = html.querySelectorAll(':scope > container');

        expect(containers.length).toBe(1);
        expect(containers[0].tagName).toBe('container');
      });

      test('should not select nested descendants with :scope > *', () => {
        const html = new HtmlMod(`
          <div>
            <span>nested</span>
          </div>
        `);

        const children = html.querySelectorAll(':scope > *');

        // Should only get div, not the nested span
        expect(children.length).toBe(1);
        expect(children[0].tagName).toBe('div');
      });

      test('should work with multiple top-level elements', () => {
        const html = new HtmlMod(`
          <header>1</header>
          <main>2</main>
          <footer>3</footer>
        `);

        const children = html.querySelectorAll(':scope > *');

        expect(children.length).toBe(3);
        expect(children[0].tagName).toBe('header');
        expect(children[1].tagName).toBe('main');
        expect(children[2].tagName).toBe('footer');
      });

      test('should work with :scope and class selector', () => {
        const html = new HtmlMod(`
          <div class="foo">first</div>
          <div class="bar">second</div>
          <span class="foo">third</span>
        `);

        const fooElements = html.querySelectorAll(':scope > .foo');

        expect(fooElements.length).toBe(2);
        expect(fooElements[0].tagName).toBe('div');
        expect(fooElements[1].tagName).toBe('span');
      });
    });

    describe('on HtmlModElement', () => {
      test('should select direct children with :scope > *', () => {
        const html = new HtmlMod(`
          <container>
            <div>first</div>
            <span>second</span>
          </container>
        `);

        const container = html.querySelector('container')!;
        const children = container.querySelectorAll(':scope > *');

        expect(children.length).toBe(2);
        expect(children[0].tagName).toBe('div');
        expect(children[1].tagName).toBe('span');
      });

      test('should not select nested descendants with :scope > *', () => {
        const html = new HtmlMod(`
          <container>
            <div>
              <span>nested</span>
            </div>
          </container>
        `);

        const container = html.querySelector('container')!;
        const children = container.querySelectorAll(':scope > *');

        // Should only get div, not the nested span
        expect(children.length).toBe(1);
        expect(children[0].tagName).toBe('div');
      });

      test('should work with :scope and attribute selector', () => {
        const html = new HtmlMod(`
          <parent>
            <child slot="header">1</child>
            <child slot="body">2</child>
            <child slot="header">3</child>
          </parent>
        `);

        const parent = html.querySelector('parent')!;
        const headerChildren = parent.querySelectorAll(':scope > [slot="header"]');

        expect(headerChildren.length).toBe(2);
        expect(headerChildren[0].getAttribute('slot')).toBe('header');
        expect(headerChildren[1].getAttribute('slot')).toBe('header');
      });
    });

    describe('edge cases', () => {
      test('should return empty array when no children exist', () => {
        const html = new HtmlMod('');
        const children = html.querySelectorAll(':scope > *');

        expect(children).toEqual([]);
      });

      test('should handle :scope with complex selectors', () => {
        const html = new HtmlMod(`
          <div id="a" class="foo">1</div>
          <div id="b" class="bar">2</div>
          <span id="c" class="foo">3</span>
        `);

        const results = html.querySelectorAll(':scope > div.foo');

        expect(results.length).toBe(1);
        expect(results[0].getAttribute('id')).toBe('a');
      });

      test('should work after modifying the document', () => {
        const html = new HtmlMod('<div>initial</div>');

        let children = html.querySelectorAll(':scope > *');
        expect(children.length).toBe(1);

        const div = html.querySelector('div')!;
        div.after('<span>new</span>');

        children = html.querySelectorAll(':scope > *');
        expect(children.length).toBe(2);
        expect(children[0].tagName).toBe('div');
        expect(children[1].tagName).toBe('span');
      });
    });
  });
});
