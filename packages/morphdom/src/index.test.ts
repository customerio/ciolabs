/**
 * @vitest-environment jsdom
 */
import { describe, test, expect } from 'vitest';

import { equality } from '.';

describe('isEqualNode', () => {
  describe('comments', () => {
    test('comment nodes should be checked based on data', () => {
      const comment1 = document.createComment('foo');
      const comment2 = document.createComment('foo');

      expect(equality.isEqualNode(comment1, comment2)).toBe(true);

      comment2.data = 'bar';

      expect(equality.isEqualNode(comment1, comment2)).toBe(false);
    });
  });

  describe('text', () => {
    test('text nodes should be checked based on data', () => {
      const text1 = document.createTextNode('foo');
      const text2 = document.createTextNode('foo');

      expect(equality.isEqualNode(text1, text2)).toBe(true);

      text2.data = 'bar';

      expect(equality.isEqualNode(text1, text2)).toBe(false);
    });

    test('two whitespace text nodes should be considered equal', () => {
      const text1 = document.createTextNode(' ');
      const text2 = document.createTextNode('      \t\n');

      expect(equality.isEqualNode(text1, text2)).toBe(true);

      text2.data = 'foo';

      expect(equality.isEqualNode(text1, text2)).toBe(false);
    });
  });

  describe('doctype', () => {
    test('doctype nodes should be checked based on data', () => {
      const doctype1 = document.implementation.createDocumentType('html', '', '');
      const doctype2 = document.implementation.createDocumentType('html', '', '');

      expect(equality.isEqualNode(doctype1, doctype2)).toBe(true);

      const doctype3 = document.implementation.createDocumentType('html', 'foo', '');

      expect(equality.isEqualNode(doctype1, doctype3)).toBe(false);
    });
  });

  describe('elements', () => {
    test('two elements should not be equal if they have different amount of attributes', () => {
      const div1 = document.createElement('div');
      const div2 = document.createElement('div');

      div1.setAttribute('id', 'foo');
      div2.setAttribute('id', 'bar');
      div2.dataset.another = 'baz';

      expect(equality.isEqualNode(div1, div2)).toBe(false);
    });

    test('two elements should not be equal if they are different tags', () => {
      const div = document.createElement('div');
      const span = document.createElement('span');

      expect(equality.isEqualNode(div, span)).toBe(false);
    });

    test("two elements should not be equal if their children don't match", () => {
      const div1 = document.createElement('div');
      const div2 = document.createElement('div');

      div1.innerHTML = '<span>foo</span>';
      div2.innerHTML = '<span>bar</span>';

      div1.setAttribute('id', 'foo');
      div2.setAttribute('id', 'foo');

      div1.setAttribute('class', 'bar');
      div2.setAttribute('class', 'bar');

      expect(equality.isEqualNode(div1, div2)).toBe(false);
    });

    test('two element should not be equal if they have different classes', () => {
      const div1 = document.createElement('div');
      const div2 = document.createElement('div');

      div1.classList.add('foo');
      div2.classList.add('bar');

      expect(equality.isEqualNode(div1, div2)).toBe(false);
    });

    test('two elements should be equal if they match everything except the ignored attributes', () => {
      const div1 = document.createElement('div');
      const div2 = document.createElement('div');

      div1.dataset.ignored = 'foo';
      div2.dataset.ignored = 'bar';

      expect(
        equality.isEqualNode(div1, div2, {
          ignoredAttributes: ['data-ignored'],
        })
      ).toBe(true);
      expect(equality.isEqualNode(div1, div2)).toBe(false);
    });

    test('two elements should be consider equal if they match everything except the ignored classes', () => {
      const div1 = document.createElement('div');
      const div2 = document.createElement('div');

      div1.classList.add('foo');

      expect(equality.isEqualNode(div1, div2, { ignoredClasses: ['foo'] })).toBe(true);
      expect(equality.isEqualNode(div1, div2)).toBe(false);
    });

    test('two elements should not be consider equal if they have different classes even if one has an ignored class', () => {
      const div1 = document.createElement('div');
      const div2 = document.createElement('div');

      div1.classList.add('foo');
      div1.classList.add('baz');
      div2.classList.add('bar');

      expect(equality.isEqualNode(div1, div2, { ignoredClasses: ['foo'] })).toBe(false);
    });
  });
});
