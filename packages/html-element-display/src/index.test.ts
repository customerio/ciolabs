import { test, expect, describe } from 'vitest';

import { getElementDisplay, isInlineElement } from './index';

describe('getElementDisplay', () => {
  test('block elements', () => {
    expect(getElementDisplay('div')).toBe('block');
    expect(getElementDisplay('p')).toBe('block');
    expect(getElementDisplay('h1')).toBe('block');
    expect(getElementDisplay('h6')).toBe('block');
    expect(getElementDisplay('blockquote')).toBe('block');
    expect(getElementDisplay('section')).toBe('block');
    expect(getElementDisplay('article')).toBe('block');
    expect(getElementDisplay('header')).toBe('block');
    expect(getElementDisplay('footer')).toBe('block');
    expect(getElementDisplay('form')).toBe('block');
    expect(getElementDisplay('fieldset')).toBe('block');
    expect(getElementDisplay('pre')).toBe('block');
    expect(getElementDisplay('hr')).toBe('block');
    expect(getElementDisplay('ul')).toBe('block');
    expect(getElementDisplay('ol')).toBe('block');
  });

  test('table elements', () => {
    expect(getElementDisplay('table')).toBe('table');
    expect(getElementDisplay('tr')).toBe('table-row');
    expect(getElementDisplay('td')).toBe('table-cell');
    expect(getElementDisplay('th')).toBe('table-cell');
    expect(getElementDisplay('thead')).toBe('table-header-group');
    expect(getElementDisplay('tbody')).toBe('table-row-group');
    expect(getElementDisplay('tfoot')).toBe('table-footer-group');
    expect(getElementDisplay('caption')).toBe('table-caption');
    expect(getElementDisplay('col')).toBe('table-column');
    expect(getElementDisplay('colgroup')).toBe('table-column-group');
  });

  test('list-item', () => {
    expect(getElementDisplay('li')).toBe('list-item');
  });

  test('none (hidden elements)', () => {
    expect(getElementDisplay('head')).toBe('none');
    expect(getElementDisplay('script')).toBe('none');
    expect(getElementDisplay('style')).toBe('none');
    expect(getElementDisplay('meta')).toBe('none');
    expect(getElementDisplay('template')).toBe('none');
    expect(getElementDisplay('title')).toBe('none');
  });

  test('inline elements (not in map, default)', () => {
    expect(getElementDisplay('span')).toBe('inline');
    expect(getElementDisplay('a')).toBe('inline');
    expect(getElementDisplay('strong')).toBe('inline');
    expect(getElementDisplay('em')).toBe('inline');
    expect(getElementDisplay('b')).toBe('inline');
    expect(getElementDisplay('i')).toBe('inline');
    expect(getElementDisplay('img')).toBe('inline');
    expect(getElementDisplay('br')).toBe('inline');
    expect(getElementDisplay('code')).toBe('inline');
    expect(getElementDisplay('small')).toBe('inline');
    expect(getElementDisplay('sub')).toBe('inline');
    expect(getElementDisplay('sup')).toBe('inline');
  });

  test('legacy inline elements', () => {
    expect(getElementDisplay('font')).toBe('inline');
    expect(getElementDisplay('strike')).toBe('inline');
    expect(getElementDisplay('big')).toBe('inline');
    expect(getElementDisplay('tt')).toBe('inline');
    expect(getElementDisplay('acronym')).toBe('inline');
    expect(getElementDisplay('u')).toBe('inline');
  });

  test('unknown and custom elements default to inline', () => {
    expect(getElementDisplay('x-button')).toBe('inline');
    expect(getElementDisplay('x-image')).toBe('inline');
    expect(getElementDisplay('custom-element')).toBe('inline');
    expect(getElementDisplay('mj-column')).toBe('inline');
  });

  test('case insensitive', () => {
    expect(getElementDisplay('DIV')).toBe('block');
    expect(getElementDisplay('Span')).toBe('inline');
    expect(getElementDisplay('TABLE')).toBe('table');
  });

  test('inline-block elements', () => {
    expect(getElementDisplay('button')).toBe('inline-block');
    expect(getElementDisplay('select')).toBe('inline-block');
  });

  test('ruby', () => {
    expect(getElementDisplay('ruby')).toBe('ruby');
    expect(getElementDisplay('rt')).toBe('ruby-text');
  });
});

describe('isInlineElement', () => {
  test('returns true for inline elements', () => {
    expect(isInlineElement('span')).toBe(true);
    expect(isInlineElement('a')).toBe(true);
    expect(isInlineElement('strong')).toBe(true);
    expect(isInlineElement('img')).toBe(true);
    expect(isInlineElement('font')).toBe(true);
  });

  test('returns true for inline-block elements', () => {
    expect(isInlineElement('button')).toBe(true);
    expect(isInlineElement('select')).toBe(true);
  });

  test('returns true for unknown/custom elements', () => {
    expect(isInlineElement('x-button')).toBe(true);
    expect(isInlineElement('custom-thing')).toBe(true);
  });

  test('returns false for block elements', () => {
    expect(isInlineElement('div')).toBe(false);
    expect(isInlineElement('p')).toBe(false);
    expect(isInlineElement('h1')).toBe(false);
    expect(isInlineElement('section')).toBe(false);
  });

  test('returns false for table elements', () => {
    expect(isInlineElement('table')).toBe(false);
    expect(isInlineElement('tr')).toBe(false);
    expect(isInlineElement('td')).toBe(false);
  });

  test('returns false for hidden elements', () => {
    expect(isInlineElement('script')).toBe(false);
    expect(isInlineElement('style')).toBe(false);
    expect(isInlineElement('head')).toBe(false);
  });

  test('returns false for list-item', () => {
    expect(isInlineElement('li')).toBe(false);
  });
});
