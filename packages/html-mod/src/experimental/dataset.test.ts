import { describe, expect, test } from 'vitest';

import { HtmlMod } from './index.js';

describe('Dataset API (Experimental)', () => {
  describe('Basic Operations', () => {
    test('should set data attribute via dataset', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      div.dataset.userId = '123';

      expect(div.dataset.userId).toBe('123');
      expect(html.toString()).toBe('<div data-user-id="123">content</div>');
    });

    test('should get data attribute via dataset', () => {
      const html = new HtmlMod('<div data-user-id="123">content</div>');
      const div = html.querySelector('div')!;

      expect(div.dataset.userId).toBe('123');
    });

    test('should delete data attribute via dataset', () => {
      const html = new HtmlMod('<div data-user-id="123">content</div>');
      const div = html.querySelector('div')!;

      delete div.dataset.userId;

      expect(div.dataset.userId).toBeNull();
      expect(html.toString()).toBe('<div>content</div>');
    });

    test('should check if data attribute exists via dataset', () => {
      const html = new HtmlMod('<div data-user-id="123">content</div>');
      const div = html.querySelector('div')!;

      expect('userId' in div.dataset).toBe(true);
      expect('userName' in div.dataset).toBe(false);
    });
  });

  describe('CamelCase Conversion', () => {
    test('should convert camelCase to kebab-case', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      div.dataset.firstName = 'John';
      div.dataset.lastName = 'Doe';

      expect(div.dataset.firstName).toBe('John');
      expect(div.dataset.lastName).toBe('Doe');
    });

    test('should convert kebab-case to camelCase', () => {
      const html = new HtmlMod('<div data-first-name="John" data-last-name="Doe">content</div>');
      const div = html.querySelector('div')!;

      expect(div.dataset.firstName).toBe('John');
      expect(div.dataset.lastName).toBe('Doe');
    });

    test('should handle multi-word attributes', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      div.dataset.veryLongAttributeName = 'value';

      expect(div.dataset.veryLongAttributeName).toBe('value');
    });

    test('should handle single lowercase word', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      div.dataset.id = '123';

      expect(div.dataset.id).toBe('123');
    });
  });

  describe('Multiple Attributes', () => {
    test('should handle multiple data attributes', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      div.dataset.id = '123';
      div.dataset.name = 'test';
      div.dataset.active = 'true';

      expect(div.dataset.id).toBe('123');
      expect(div.dataset.name).toBe('test');
      expect(div.dataset.active).toBe('true');
    });

    test('should enumerate data attributes', () => {
      const html = new HtmlMod('<div data-id="123" data-name="test" data-active="true">content</div>');
      const div = html.querySelector('div')!;

      const keys = Object.keys(div.dataset);

      expect(keys).toContain('id');
      expect(keys).toContain('name');
      expect(keys).toContain('active');
      expect(keys.length).toBe(3);
    });

    test('should not enumerate non-data attributes', () => {
      const html = new HtmlMod('<div class="test" id="main" data-user-id="123">content</div>');
      const div = html.querySelector('div')!;

      const keys = Object.keys(div.dataset);

      expect(keys).toContain('userId');
      expect(keys).not.toContain('class');
      expect(keys).not.toContain('id');
      expect(keys.length).toBe(1);
    });
  });

  describe('Type Coercion', () => {
    test('should convert numbers to strings', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      div.dataset.count = String(42);

      expect(div.dataset.count).toBe('42');
      expect(typeof div.dataset.count).toBe('string');
    });

    test('should convert boolean to string', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      div.dataset.active = String(true);

      expect(div.dataset.active).toBe('true');
    });

    test('should handle empty string', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      div.dataset.empty = '';

      expect(div.dataset.empty).toBe('');
      expect(Object.hasOwn(div.dataset, 'empty')).toBe(true);
    });
  });

  describe('Special Characters', () => {
    test('should handle values with spaces', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      div.dataset.message = 'hello world';

      expect(div.dataset.message).toBe('hello world');
    });

    test('should handle values with quotes', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      div.dataset.json = '{"key":"value"}';

      expect(div.dataset.json).toBe('{"key":"value"}');
    });

    test('should handle values with special characters', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      div.dataset.url = 'https://example.com?foo=bar&baz=qux';

      expect(div.dataset.url).toBe('https://example.com?foo=bar&baz=qux');
    });

    test('should handle unicode and emoji', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      div.dataset.emoji = '🎉 Hello 世界';

      expect(div.dataset.emoji).toBe('🎉 Hello 世界');
    });
  });

  describe('Integration with setAttribute/getAttribute', () => {
    test('should work alongside setAttribute', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      div.dataset.foo = 'bar';
      div.dataset.baz = 'qux';

      expect(div.dataset.foo).toBe('bar');
      expect(div.dataset.baz).toBe('qux');
    });

    test('should update when setAttribute is used', () => {
      const html = new HtmlMod('<div data-count="0">content</div>');
      const div = html.querySelector('div')!;

      expect(div.dataset.count).toBe('0');

      div.dataset.count = '1';

      expect(div.dataset.count).toBe('1');
    });

    test('should update when removeAttribute is used', () => {
      const html = new HtmlMod('<div data-temp="value">content</div>');
      const div = html.querySelector('div')!;

      expect(div.dataset.temp).toBe('value');

      delete div.dataset.temp;

      expect(div.dataset.temp).toBeNull();
      expect('temp' in div.dataset).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    test('should handle undefined properties', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      expect(div.dataset.nonExistent).toBeNull();
    });

    test('should handle overwriting existing attribute', () => {
      const html = new HtmlMod('<div data-value="old">content</div>');
      const div = html.querySelector('div')!;

      div.dataset.value = 'new';

      expect(div.dataset.value).toBe('new');
      expect(html.toString()).toBe('<div data-value="new">content</div>');
    });

    test('should handle rapid sequential operations', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      for (let index = 0; index < 10; index++) {
        div.dataset[`item${index}`] = `value${index}`;
      }

      for (let index = 0; index < 10; index++) {
        expect(div.dataset[`item${index}`]).toBe(`value${index}`);
      }
    });

    test('should handle delete then re-add', () => {
      const html = new HtmlMod('<div data-toggle="on">content</div>');
      const div = html.querySelector('div')!;

      delete div.dataset.toggle;
      expect(div.dataset.toggle).toBeNull();

      div.dataset.toggle = 'off';
      expect(div.dataset.toggle).toBe('off');
    });

    test('should work after element modification', () => {
      const html = new HtmlMod('<div data-id="123">content</div>');
      const div = html.querySelector('div')!;

      div.innerHTML = 'new content';
      div.setAttribute('class', 'modified');

      expect(div.dataset.id).toBe('123');

      div.dataset.updated = 'true';
      expect(div.dataset.updated).toBe('true');
    });
  });

  describe('Real-World Patterns', () => {
    test('should handle configuration data', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      div.dataset.apiUrl = 'https://api.example.com';
      div.dataset.apiKey = 'secret123';
      div.dataset.timeout = '5000';

      expect(div.dataset.apiUrl).toBe('https://api.example.com');
      expect(div.dataset.apiKey).toBe('secret123');
      expect(div.dataset.timeout).toBe('5000');
    });

    test('should handle state management', () => {
      const html = new HtmlMod('<button data-state="idle">Click me</button>');
      const button = html.querySelector('button')!;

      expect(button.dataset.state).toBe('idle');

      button.dataset.state = 'loading';
      expect(button.dataset.state).toBe('loading');

      button.dataset.state = 'complete';
      expect(button.dataset.state).toBe('complete');
    });

    test('should handle form data', () => {
      const html = new HtmlMod('<input type="text" />');
      const input = html.querySelector('input')!;

      input.dataset.validation = 'required';
      input.dataset.validationType = 'email';
      input.dataset.validationMessage = 'Please enter a valid email';

      expect(input.dataset.validation).toBe('required');
      expect(input.dataset.validationType).toBe('email');
      expect(input.dataset.validationMessage).toBe('Please enter a valid email');
    });

    test('should handle list item data', () => {
      const html = new HtmlMod('<ul></ul>');
      const ul = html.querySelector('ul')!;

      ul.innerHTML = '<li>Item 1</li><li>Item 2</li><li>Item 3</li>';

      const items = html.querySelectorAll('li');
      for (const [index, item] of items.entries()) {
        item.dataset.index = String(index);
        item.dataset.id = `item-${index}`;
      }

      expect(html.querySelectorAll('li[data-index]').length).toBe(3);
      expect(items[0].dataset.index).toBe('0');
      expect(items[1].dataset.id).toBe('item-1');
    });
  });

  describe('Performance', () => {
    test('should handle 100 dataset operations', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      for (let index = 0; index < 100; index++) {
        div.dataset[`attr${index}`] = `value${index}`;
      }

      expect(Object.keys(div.dataset).length).toBe(100);
    });

    test('should efficiently enumerate large dataset', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      // Add 50 data attributes
      for (let index = 0; index < 50; index++) {
        div.dataset[`item${index}`] = `value${index}`;
      }

      const keys = Object.keys(div.dataset);
      expect(keys.length).toBe(50);

      // Verify all keys are present
      for (let index = 0; index < 50; index++) {
        expect(keys).toContain(`item${index}`);
      }
    });
  });
});
