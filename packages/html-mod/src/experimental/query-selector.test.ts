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

    describe('complex :scope > patterns', () => {
      test('should handle :scope > div span (descendant)', () => {
        const html = new HtmlMod(`
          <div>
            <span>nested1</span>
          </div>
          <div>
            <span>nested2</span>
          </div>
          <p>
            <span>not in div</span>
          </p>
        `);

        const results = html.querySelectorAll(':scope > div span');

        expect(results.length).toBe(2);
        expect(results[0].textContent).toBe('nested1');
        expect(results[1].textContent).toBe('nested2');
      });

      test('should handle :scope > div > span (direct child)', () => {
        const html = new HtmlMod(`
          <div>
            <span>direct</span>
          </div>
          <div>
            <p><span>nested</span></p>
          </div>
        `);

        const results = html.querySelectorAll(':scope > div > span');

        expect(results.length).toBe(1);
        expect(results[0].textContent).toBe('direct');
      });

      test('should handle :scope > * span (any direct child with span descendants)', () => {
        const html = new HtmlMod(`
          <div>
            <span>in div</span>
          </div>
          <p>
            <span>in p</span>
          </p>
          <section>no span</section>
        `);

        const results = html.querySelectorAll(':scope > * span');

        expect(results.length).toBe(2);
      });

      test('should handle deeply nested selectors', () => {
        const html = new HtmlMod(`
          <container>
            <row>
              <column>
                <text>deep</text>
              </column>
            </row>
          </container>
        `);

        const results = html.querySelectorAll(':scope > container row column text');

        expect(results.length).toBe(1);
        expect(results[0].textContent).toBe('deep');
      });
    });

    describe('comma-separated :scope selectors', () => {
      test('should handle :scope > div, :scope > p', () => {
        const html = new HtmlMod(`
          <div>1</div>
          <span>2</span>
          <p>3</p>
        `);

        const results = html.querySelectorAll(':scope > div, :scope > p');

        expect(results.length).toBe(2);
        expect(results[0].tagName).toBe('div');
        expect(results[1].tagName).toBe('p');
      });

      test('should deduplicate results from comma-separated selectors', () => {
        const html = new HtmlMod(`
          <div class="foo">1</div>
          <div class="bar">2</div>
        `);

        const results = html.querySelectorAll(':scope > div, :scope > .foo');

        // Should get div.foo only once, plus div.bar
        expect(results.length).toBe(2);
      });

      test('should handle complex comma-separated patterns', () => {
        const html = new HtmlMod(`
          <div>
            <span>a</span>
          </div>
          <p>
            <span>b</span>
          </p>
        `);

        const results = html.querySelectorAll(':scope > div span, :scope > p span');

        expect(results.length).toBe(2);
      });
    });

    describe(':scope descendant patterns (without >)', () => {
      test('should handle :scope div (all divs)', () => {
        const html = new HtmlMod(`
          <div>top</div>
          <container>
            <div>nested</div>
          </container>
        `);

        const results = html.querySelectorAll(':scope div');

        expect(results.length).toBe(2);
      });

      test('should handle :scope .foo (all elements with class)', () => {
        const html = new HtmlMod(`
          <div class="foo">1</div>
          <p>
            <span class="foo">2</span>
          </p>
        `);

        const results = html.querySelectorAll(':scope .foo');

        expect(results.length).toBe(2);
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
