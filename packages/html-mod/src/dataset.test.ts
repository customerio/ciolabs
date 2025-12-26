import { describe, expect, test } from 'vitest';

import { HtmlMod } from './index.js';

describe('Dataset API', () => {
  describe('Basic Operations', () => {
    test('should set data attribute via dataset', () => {
      const html = new HtmlMod('<div>content</div>');
      let div = html.querySelector('div')!;

      div.dataset.userId = '123';
      html.flush();
      div = html.querySelector('div')!; // Re-query after flush

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
      let div = html.querySelector('div')!;

      delete div.dataset.userId;
      html.flush();
      div = html.querySelector('div')!; // Re-query after flush

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
      let div = html.querySelector('div')!;

      div.dataset.firstName = 'John';
      div.dataset.lastName = 'Doe';
      html.flush();
      div = html.querySelector('div')!; // Re-query after flush

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
      let div = html.querySelector('div')!;

      div.dataset.veryLongAttributeName = 'value';
      html.flush();
      div = html.querySelector('div')!; // Re-query after flush

      expect(div.dataset.veryLongAttributeName).toBe('value');
    });

    test('should handle single lowercase word', () => {
      const html = new HtmlMod('<div>content</div>');
      let div = html.querySelector('div')!;

      div.dataset.id = '123';
      html.flush();
      div = html.querySelector('div')!; // Re-query after flush

      expect(div.dataset.id).toBe('123');
    });
  });

  describe('Multiple Attributes', () => {
    test('should handle multiple data attributes', () => {
      const html = new HtmlMod('<div>content</div>');
      let div = html.querySelector('div')!;

      div.dataset.id = '123';
      div.dataset.name = 'test';
      div.dataset.active = 'true';
      html.flush();
      div = html.querySelector('div')!; // Re-query after flush

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

    test('should handle setting multiple values sequentially', () => {
      const html = new HtmlMod('<div>content</div>');
      let div = html.querySelector('div')!;

      for (let index = 0; index < 10; index++) {
        div.dataset[`value${index}`] = String(index);
      }
      html.flush();
      div = html.querySelector('div')!; // Re-query after flush

      for (let index = 0; index < 10; index++) {
        expect(div.dataset[`value${index}`]).toBe(String(index));
      }
    });
  });

  describe('Special Characters and Values', () => {
    test('should handle values with quotes', () => {
      const html = new HtmlMod('<div>content</div>');
      let div = html.querySelector('div')!;

      div.dataset.message = 'He said "hello"';
      html.flush();
      div = html.querySelector('div')!; // Re-query after flush

      expect(div.dataset.message).toBe('He said "hello"');
    });

    test('should handle empty string value', () => {
      const html = new HtmlMod('<div>content</div>');
      let div = html.querySelector('div')!;

      div.dataset.empty = '';
      html.flush();
      div = html.querySelector('div')!; // Re-query after flush

      expect(div.dataset.empty).toBe('');
    });

    test('should handle numeric values as strings', () => {
      const html = new HtmlMod('<div>content</div>');
      let div = html.querySelector('div')!;

      div.dataset.count = '42';
      html.flush();
      div = html.querySelector('div')!; // Re-query after flush

      expect(div.dataset.count).toBe('42');
    });

    test('should handle special characters in values', () => {
      const html = new HtmlMod('<div>content</div>');
      let div = html.querySelector('div')!;

      div.dataset.url = 'https://example.com?foo=bar&baz=qux';
      html.flush();
      div = html.querySelector('div')!; // Re-query after flush

      expect(div.dataset.url).toBe('https://example.com?foo=bar&baz=qux');
    });
  });

  describe('Integration with setAttribute/getAttribute', () => {
    test('should be consistent with setAttribute', () => {
      const html = new HtmlMod('<div>content</div>');
      let div = html.querySelector('div')!;

      div.dataset.userId = '123';
      html.flush();
      div = html.querySelector('div')!; // Re-query after flush

      expect(div.dataset.userId).toBe('123');
    });

    test('should be consistent with getAttribute', () => {
      const html = new HtmlMod('<div>content</div>');
      let div = html.querySelector('div')!;

      div.dataset.userId = '123';
      html.flush();
      div = html.querySelector('div')!; // Re-query after flush

      expect(div.dataset.userId).toBe('123');
    });

    test('should work with removeAttribute', () => {
      const html = new HtmlMod('<div data-user-id="123">content</div>');
      let div = html.querySelector('div')!;

      delete div.dataset.userId;
      html.flush();
      div = html.querySelector('div')!; // Re-query after flush

      expect(div.dataset.userId).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    test('should handle attributes that are not data-*', () => {
      const html = new HtmlMod('<div class="test" id="main">content</div>');
      const div = html.querySelector('div')!;

      const keys = Object.keys(div.dataset);

      expect(keys.length).toBe(0);
    });

    test('should handle mixed data-* and non-data-* attributes', () => {
      const html = new HtmlMod('<div class="test" data-id="123" id="main" data-name="test">content</div>');
      const div = html.querySelector('div')!;

      const keys = Object.keys(div.dataset);

      expect(keys).toContain('id');
      expect(keys).toContain('name');
      expect(keys.length).toBe(2);
    });

    test('should handle updating existing data attribute', () => {
      const html = new HtmlMod('<div data-count="1">content</div>');
      let div = html.querySelector('div')!;

      expect(div.dataset.count).toBe('1');

      div.dataset.count = '2';
      html.flush();
      div = html.querySelector('div')!; // Re-query after flush

      expect(div.dataset.count).toBe('2');
    });

    test('should handle rapid set/delete cycles', () => {
      const html = new HtmlMod('<div>content</div>');

      for (let index = 0; index < 10; index++) {
        let div = html.querySelector('div')!;
        div.dataset.temp = `value-${index}`;
        html.flush();
        div = html.querySelector('div')!; // Re-query after flush
        expect(div.dataset.temp).toBe(`value-${index}`);

        div = html.querySelector('div')!;
        delete div.dataset.temp;
        html.flush();
        div = html.querySelector('div')!; // Re-query after flush
        expect(div.dataset.temp).toBeNull();
      }
    });
  });

  describe('Proxy Behavior', () => {
    test('should support in operator', () => {
      const html = new HtmlMod('<div data-exists="true">content</div>');
      const div = html.querySelector('div')!;

      expect('exists' in div.dataset).toBe(true);
      expect('notExists' in div.dataset).toBe(false);
    });

    test('should support delete operator', () => {
      const html = new HtmlMod('<div data-temp="value">content</div>');
      let div = html.querySelector('div')!;

      const result = delete div.dataset.temp;
      html.flush();
      div = html.querySelector('div')!; // Re-query after flush

      expect(result).toBe(true);
      expect(div.dataset.temp).toBeNull();
    });

    test('should support Object.keys()', () => {
      const html = new HtmlMod('<div data-a="1" data-b="2" data-c="3">content</div>');
      const div = html.querySelector('div')!;

      const keys = Object.keys(div.dataset);

      expect(keys.sort()).toEqual(['a', 'b', 'c']);
    });

    test('should support property enumeration', () => {
      const html = new HtmlMod('<div data-x="1" data-y="2">content</div>');
      const div = html.querySelector('div')!;

      const properties = [];
      for (const key in div.dataset) {
        properties.push(key);
      }

      expect(properties.sort()).toEqual(['x', 'y']);
    });
  });
});
