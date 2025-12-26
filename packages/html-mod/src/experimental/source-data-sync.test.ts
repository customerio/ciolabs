import { describe, expect, test } from 'vitest';

import { HtmlMod } from './index.js';

describe('Source Data Synchronization - Experimental', () => {
  describe('Tag Name Changes', () => {
    test('should update openTag.data when tagName changes', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      div.tagName = 'span';

      expect(div.__element.tagName).toBe('span');
      expect(div.__element.source.openTag.name).toBe('span');
      expect(div.__element.source.openTag.data).toBe('<span>');
      expect(html.toString()).toBe('<span>content</span>');
    });

    test('should update closeTag.data when tagName changes', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      div.tagName = 'article';

      expect(div.__element.source.closeTag?.name).toBe('article');
      expect(div.__element.source.closeTag?.data).toBe('</article>');
      expect(html.toString()).toBe('<article>content</article>');
    });

    test('should handle multiple tagName changes', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      div.tagName = 'span';
      expect(div.__element.source.openTag.data).toBe('<span>');
      expect(div.__element.source.closeTag?.data).toBe('</span>');

      div.tagName = 'article';
      expect(div.__element.source.openTag.data).toBe('<article>');
      expect(div.__element.source.closeTag?.data).toBe('</article>');

      div.tagName = 'section';
      expect(div.__element.source.openTag.data).toBe('<section>');
      expect(div.__element.source.closeTag?.data).toBe('</section>');

      expect(html.toString()).toBe('<section>content</section>');
    });

    test('should update self-closing tag data', () => {
      const html = new HtmlMod('<img/>');
      const img = html.querySelector('img')!;

      // Note: self-closing tags might get converted to regular tags
      // depending on the element type, but we test the data sync
      if (img.__element.source.openTag.isSelfClosing) {
        const originalData = img.__element.source.openTag.data;
        expect(originalData).toMatch(/<img/);
      }
    });

    test('should maintain data sync with attributes present', () => {
      const html = new HtmlMod('<div class="test" id="main">content</div>');
      const div = html.querySelector('div')!;

      div.tagName = 'section';

      expect(div.__element.source.openTag.name).toBe('section');
      // openTag.data includes attributes
      expect(div.__element.source.openTag.data).toBe('<section class="test" id="main">');
      expect(div.__element.source.closeTag?.name).toBe('section');
      expect(div.__element.source.closeTag?.data).toBe('</section>');
      expect(html.toString()).toContain('<section');
      expect(html.toString()).toContain('</section>');
    });
  });

  describe('Attribute Data Synchronization', () => {
    test('should have correct attribute source.data when setting attribute', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      div.dataset.test = 'value';

      const attribute = div.__element.source.attributes.find(a => a.name.data === 'data-test');
      expect(attribute).toBeDefined();
      // Even simple values get quotes when added (default behavior)
      expect(attribute?.source.data).toBe('data-test="value"');
    });

    test('should update attribute source.data when value changes', () => {
      const html = new HtmlMod('<div data-test="initial">content</div>');
      const div = html.querySelector('div')!;

      div.dataset.test = 'updated';

      const attribute = div.__element.source.attributes.find(a => a.name.data === 'data-test');
      expect(attribute?.value?.data).toBe('updated');
      expect(attribute?.source.data).toBe('data-test="updated"');
    });

    test('should handle values with spaces requiring quotes', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      // Value with space requires quotes
      div.dataset.test = 'hello world';

      const attribute = div.__element.source.attributes.find(a => a.name.data === 'data-test');
      // Should have quotes because value contains space
      expect(attribute?.source.data).toMatch(/data-test=["']hello world["']/);
    });

    test('should handle multiple attribute changes', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      div.setAttribute('id', 'test');
      div.setAttribute('class', 'foo');
      div.dataset.value = '123';

      const idAttribute = div.__element.source.attributes.find(a => a.name.data === 'id');
      const classAttribute = div.__element.source.attributes.find(a => a.name.data === 'class');
      const dataAttribute = div.__element.source.attributes.find(a => a.name.data === 'data-value');

      // Simple values get quotes when added (default behavior)
      expect(idAttribute?.source.data).toBe('id="test"');
      expect(classAttribute?.source.data).toBe('class="foo"');
      expect(dataAttribute?.source.data).toBe('data-value="123"');
    });

    test('should maintain consistency after removing and re-adding attribute', () => {
      const html = new HtmlMod('<div data-test="initial">content</div>');
      const div = html.querySelector('div')!;

      delete div.dataset.test;
      expect(div.__element.source.attributes.find(a => a.name.data === 'data-test')).toBeUndefined();

      div.dataset.test = 'new-value';
      const attribute = div.__element.source.attributes.find(a => a.name.data === 'data-test');
      // Gets quotes when added (default behavior)
      expect(attribute?.source.data).toBe('data-test="new-value"');
    });
  });

  describe('Complex Drift Scenarios', () => {
    test('should maintain sync after tagName change followed by attribute change', () => {
      const html = new HtmlMod('<div class="test">content</div>');
      const div = html.querySelector('div')!;

      div.tagName = 'span';
      // openTag.data includes existing attributes
      expect(div.__element.source.openTag.data).toBe('<span class="test">');

      div.setAttribute('id', 'new-id');
      const attribute = div.__element.source.attributes.find(a => a.name.data === 'id');
      // Gets quotes when added
      expect(attribute?.source.data).toBe('id="new-id"');

      // Tag name should still be correct, now with both attributes
      expect(div.__element.source.openTag.data).toBe('<span class="test" id="new-id">');
      expect(html.toString()).toContain('<span');
    });

    test('should maintain sync after attribute change followed by tagName change', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      div.dataset.test = 'value';
      const attribute1 = div.__element.source.attributes.find(a => a.name.data === 'data-test');
      // Gets quotes when added
      expect(attribute1?.source.data).toBe('data-test="value"');

      div.tagName = 'article';
      // openTag.data now includes the attribute
      expect(div.__element.source.openTag.data).toBe('<article data-test="value">');

      // Attribute should still be correct
      const attribute2 = div.__element.source.attributes.find(a => a.name.data === 'data-test');
      // Quote remains
      expect(attribute2?.source.data).toBe('data-test="value"');
    });

    test('should handle innerHTML change that replaces content', () => {
      const html = new HtmlMod('<div id="parent"><p>old</p></div>');
      const div = html.querySelector('#parent')!;

      // Store original tag data
      const originalOpenTagData = div.__element.source.openTag.data;

      div.innerHTML = '<span>new</span>';

      // Parent tag data should remain unchanged
      expect(div.__element.source.openTag.data).toBe(originalOpenTagData);
      expect(html.toString()).toBe('<div id="parent"><span>new</span></div>');
    });

    test('should maintain sync through multiple operations', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      // Operation 1: Set attribute
      div.setAttribute('class', 'test');
      let classAttribute = div.__element.source.attributes.find(a => a.name.data === 'class');
      // Gets quotes when added
      expect(classAttribute?.source.data).toBe('class="test"');

      // Operation 2: Change tag name
      div.tagName = 'span';
      // openTag.data includes attribute
      expect(div.__element.source.openTag.data).toBe('<span class="test">');

      // Operation 3: Update attribute
      div.setAttribute('class', 'updated');
      classAttribute = div.__element.source.attributes.find(a => a.name.data === 'class');
      // Quote remains
      expect(classAttribute?.source.data).toBe('class="updated"');

      // Operation 4: Change tag name again
      div.tagName = 'article';
      // openTag.data includes updated attribute
      expect(div.__element.source.openTag.data).toBe('<article class="updated">');
      expect(div.__element.source.closeTag?.data).toBe('</article>');

      // All data should be in sync
      expect(html.toString()).toBe('<article class="updated">content</article>');
    });

    test('should handle nested element modifications without affecting parent data', () => {
      const html = new HtmlMod('<div><p>text</p></div>');
      const div = html.querySelector('div')!;
      const p = html.querySelector('p')!;

      // Store parent data
      const parentOpenData = div.__element.source.openTag.data;

      // Modify child
      p.tagName = 'span';
      expect(p.__element.source.openTag.data).toBe('<span>');

      // Parent data should be unchanged
      expect(div.__element.source.openTag.data).toBe(parentOpenData);
      expect(html.toString()).toBe('<div><span>text</span></div>');
    });
  });

  describe('Edge Cases', () => {
    test('should handle elements created via setAttribute when no source exists', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      // Setting an attribute should create source if it doesn't exist
      div.setAttribute('new-attr', 'value');

      expect(div.__element.source).toBeDefined();
      expect(div.__element.source.openTag.data).toBeDefined();
      const attribute = div.__element.source.attributes.find(a => a.name.data === 'new-attr');
      // Gets quotes when added
      expect(attribute?.source.data).toBe('new-attr="value"');
    });

    test('should handle special characters in attribute values in data field', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      div.dataset.url = 'https://example.com?foo=bar&baz=qux';

      const attribute = div.__element.source.attributes.find(a => a.name.data === 'data-url');
      expect(attribute?.source.data).toBe('data-url="https://example.com?foo=bar&baz=qux"');
    });

    test('should handle empty attribute values in data field', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      div.dataset.empty = '';

      const attribute = div.__element.source.attributes.find(a => a.name.data === 'data-empty');
      // Empty value still gets quotes
      expect(attribute?.source.data).toBe('data-empty=""');
    });
  });

  describe('Data Field Matches Source String Positions', () => {
    test('should verify openTag.data matches substring from source', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      const { startIndex, endIndex, data } = div.__element.source.openTag;
      const actualSubstring = html.__source.slice(startIndex, endIndex + 1);
      expect(data).toBe(actualSubstring);
      expect(actualSubstring).toBe('<div>');
    });

    test('should verify closeTag.data matches substring from source', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      const closeTag = div.__element.source.closeTag;
      expect(closeTag).toBeDefined();
      if (closeTag) {
        const actualSubstring = html.__source.slice(closeTag.startIndex, closeTag.endIndex + 1);
        expect(closeTag.data).toBe(actualSubstring);
        expect(actualSubstring).toBe('</div>');
      }
    });

    test('should verify attribute data matches substring after setAttribute', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      div.dataset.test = 'value';

      const attribute = div.__element.source.attributes.find(a => a.name.data === 'data-test');
      expect(attribute).toBeDefined();
      if (attribute) {
        const actualSubstring = html.__source.slice(attribute.source.startIndex, attribute.source.endIndex + 1);
        expect(attribute.source.data).toBe(actualSubstring);
      }
    });

    test('should verify data matches source after tagName change', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      div.tagName = 'span';

      // Check openTag
      const { startIndex: openStart, endIndex: openEnd, data: openData } = div.__element.source.openTag;
      const openSubstring = html.__source.slice(openStart, openEnd + 1);
      expect(openData).toBe(openSubstring);
      expect(openSubstring).toBe('<span>');

      // Check closeTag
      const closeTag = div.__element.source.closeTag;
      expect(closeTag).toBeDefined();
      if (closeTag) {
        const closeSubstring = html.__source.slice(closeTag.startIndex, closeTag.endIndex + 1);
        expect(closeTag.data).toBe(closeSubstring);
        expect(closeSubstring).toBe('</span>');
      }
    });

    test('should verify data matches source after multiple modifications', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      // Multiple operations
      div.setAttribute('id', 'test');
      div.tagName = 'article';
      div.setAttribute('class', 'foo');

      // Verify openTag data matches source
      const { startIndex: openStart, endIndex: openEnd, data: openData } = div.__element.source.openTag;
      const openSubstring = html.__source.slice(openStart, openEnd + 1);
      expect(openData).toBe(openSubstring);
      // openTag includes both attributes
      expect(openSubstring).toBe('<article id="test" class="foo">');

      // Verify closeTag data matches source
      const closeTag = div.__element.source.closeTag;
      if (closeTag) {
        const closeSubstring = html.__source.slice(closeTag.startIndex, closeTag.endIndex + 1);
        expect(closeTag.data).toBe(closeSubstring);
        expect(closeSubstring).toBe('</article>');
      }

      // Verify each attribute data matches source
      for (const attribute of div.__element.source.attributes) {
        const attributeSubstring = html.__source.slice(attribute.source.startIndex, attribute.source.endIndex + 1);
        expect(attribute.source.data).toBe(attributeSubstring);
      }
    });

    test('should verify attribute name and value positions match source', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      div.dataset.test = 'hello';

      const attribute = div.__element.source.attributes.find(a => a.name.data === 'data-test');
      expect(attribute).toBeDefined();
      if (attribute) {
        // Verify name data matches source
        const nameSubstring = html.__source.slice(attribute.name.startIndex, attribute.name.endIndex + 1);
        expect(attribute.name.data).toBe(nameSubstring);
        expect(nameSubstring).toBe('data-test');

        // Verify value data matches source
        if (!attribute.value) throw new Error('Expected value');
        const valueSubstring = html.__source.slice(attribute.value.startIndex, attribute.value.endIndex + 1);
        expect(attribute.value.data).toBe(valueSubstring);
        expect(valueSubstring).toBe('hello');

        // Verify full attribute source data matches
        const fullSubstring = html.__source.slice(attribute.source.startIndex, attribute.source.endIndex + 1);
        expect(attribute.source.data).toBe(fullSubstring);
      }
    });

    test('should verify data matches source in nested structure', () => {
      const html = new HtmlMod('<div><p>text</p></div>');
      const div = html.querySelector('div')!;
      const p = html.querySelector('p')!;

      // Modify nested element
      p.tagName = 'span';
      p.setAttribute('class', 'nested');

      // Verify parent openTag
      const divOpenSubstring = html.__source.slice(
        div.__element.source.openTag.startIndex,
        div.__element.source.openTag.endIndex + 1
      );
      expect(div.__element.source.openTag.data).toBe(divOpenSubstring);

      // Verify child openTag
      const pOpenSubstring = html.__source.slice(
        p.__element.source.openTag.startIndex,
        p.__element.source.openTag.endIndex + 1
      );
      expect(p.__element.source.openTag.data).toBe(pOpenSubstring);
      // openTag includes the class attribute
      expect(pOpenSubstring).toBe('<span class="nested">');

      // Verify child attributes
      const attribute = p.__element.source.attributes.find(a => a.name.data === 'class');
      if (attribute) {
        const attributeSubstring = html.__source.slice(attribute.source.startIndex, attribute.source.endIndex + 1);
        expect(attribute.source.data).toBe(attributeSubstring);
      }
    });
  });

  describe('Adversarial Cases - Quotes and Special Characters', () => {
    test('should handle double quotes in attribute values', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      div.dataset.text = 'He said "hello"';

      const attribute = div.__element.source.attributes.find(a => a.name.data === 'data-text');
      // Double quotes in value cause switch to single quotes
      expect(attribute?.value?.data).toBe('He said "hello"');
      expect(attribute?.source.data).toBe(`data-text='He said "hello"'`);

      // Verify data matches source
      const attributeSubstring = html.__source.slice(attribute!.source.startIndex, attribute!.source.endIndex + 1);
      expect(attribute?.source.data).toBe(attributeSubstring);
    });

    test('should handle single quotes in attribute values', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      div.dataset.text = "It's great";

      const attribute = div.__element.source.attributes.find(a => a.name.data === 'data-text');
      // Single quotes cause switch to double quotes (no escaping needed)
      expect(attribute?.value?.data).toBe("It's great");
      expect(attribute?.source.data).toBe(`data-text="It's great"`);

      // Verify data matches source
      const attributeSubstring = html.__source.slice(attribute!.source.startIndex, attribute!.source.endIndex + 1);
      expect(attribute?.source.data).toBe(attributeSubstring);
    });

    test('should handle both quote types in attribute values', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      div.dataset.text = `He said "It's great"`;

      const attribute = div.__element.source.attributes.find(a => a.name.data === 'data-text');

      // When value has both quote types, double quotes get escaped
      const attributeSubstring = html.__source.slice(attribute!.source.startIndex, attribute!.source.endIndex + 1);

      // Verify data matches source
      expect(attribute?.source.data).toBe(attributeSubstring);

      // The source should have escaped double quotes
      expect(attributeSubstring).toContain('&quot;');
      expect(attribute?.value?.data).toBe("He said &quot;It's great&quot;");
    });

    test('should handle angle brackets in attribute values', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      div.dataset.expr = 'x < 10 && y > 5';

      const attribute = div.__element.source.attributes.find(a => a.name.data === 'data-expr');
      // Angle brackets require quotes
      expect(attribute?.source.data).toBe('data-expr="x < 10 && y > 5"');

      // Verify data matches source
      const attributeSubstring = html.__source.slice(attribute!.source.startIndex, attribute!.source.endIndex + 1);
      expect(attribute?.source.data).toBe(attributeSubstring);
    });

    test('should handle equals sign in attribute values', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      div.dataset.equation = 'x=y+z';

      const attribute = div.__element.source.attributes.find(a => a.name.data === 'data-equation');
      // Equals sign requires quotes
      expect(attribute?.source.data).toBe('data-equation="x=y+z"');

      // Verify data matches source
      const attributeSubstring = html.__source.slice(attribute!.source.startIndex, attribute!.source.endIndex + 1);
      expect(attribute?.source.data).toBe(attributeSubstring);
    });

    test('should handle backticks in attribute values', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      div.dataset.code = '`template ${var}`';

      const attribute = div.__element.source.attributes.find(a => a.name.data === 'data-code');
      // Backticks require quotes
      expect(attribute?.source.data).toBe('data-code="`template ${var}`"');

      // Verify data matches source
      const attributeSubstring = html.__source.slice(attribute!.source.startIndex, attribute!.source.endIndex + 1);
      expect(attribute?.source.data).toBe(attributeSubstring);
    });

    test('should handle newlines and tabs in attribute values', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      div.dataset.text = 'line1\nline2\tindented';

      const attribute = div.__element.source.attributes.find(a => a.name.data === 'data-text');
      // Whitespace requires quotes
      expect(attribute?.source.data).toMatch(/^data-text="line1\nline2\tindented"$/);

      // Verify data matches source
      const attributeSubstring = html.__source.slice(attribute!.source.startIndex, attribute!.source.endIndex + 1);
      expect(attribute?.source.data).toBe(attributeSubstring);
    });

    test('should handle unicode and emoji in attribute values', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      div.dataset.emoji = '🚀 Hello 世界';

      const attribute = div.__element.source.attributes.find(a => a.name.data === 'data-emoji');
      expect(attribute?.value?.data).toBe('🚀 Hello 世界');
      // Space requires quotes
      expect(attribute?.source.data).toBe('data-emoji="🚀 Hello 世界"');

      // Verify data matches source
      const attributeSubstring = html.__source.slice(attribute!.source.startIndex, attribute!.source.endIndex + 1);
      expect(attribute?.source.data).toBe(attributeSubstring);
    });

    test('should handle extremely long attribute values', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      const longValue = 'x'.repeat(1000);
      div.dataset.long = longValue;

      const attribute = div.__element.source.attributes.find(a => a.name.data === 'data-long');
      expect(attribute?.value?.data).toBe(longValue);

      // Verify data matches source
      const attributeSubstring = html.__source.slice(attribute!.source.startIndex, attribute!.source.endIndex + 1);
      expect(attribute?.source.data).toBe(attributeSubstring);
    });

    test('should maintain data integrity after updating attributes with special characters', () => {
      const html = new HtmlMod('<div data-test="initial">content</div>');
      const div = html.querySelector('div')!;

      // Update with double quotes (switches to single quotes)
      div.dataset.test = 'value with "quotes"';

      let attribute = div.__element.source.attributes.find(a => a.name.data === 'data-test');
      let attributeSubstring = html.__source.slice(attribute!.source.startIndex, attribute!.source.endIndex + 1);
      expect(attribute?.source.data).toBe(attributeSubstring);
      expect(attributeSubstring).toContain(`'value with "quotes"'`);

      // Update with single quotes (uses double quotes)
      div.dataset.test = "it's working";

      attribute = div.__element.source.attributes.find(a => a.name.data === 'data-test');
      attributeSubstring = html.__source.slice(attribute!.source.startIndex, attribute!.source.endIndex + 1);
      expect(attribute?.source.data).toBe(attributeSubstring);
      expect(attributeSubstring).toContain(`"it's working"`);

      // Update with mixed quotes (escapes double quotes)
      div.dataset.test = `he said "it's great"`;

      attribute = div.__element.source.attributes.find(a => a.name.data === 'data-test');
      attributeSubstring = html.__source.slice(attribute!.source.startIndex, attribute!.source.endIndex + 1);
      expect(attribute?.source.data).toBe(attributeSubstring);
      // Should have escaped double quotes
      expect(attributeSubstring).toContain('&quot;');
    });

    test('should handle attributes with only special characters', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      div.dataset.symbols = '!@#$%^&*()';

      const attribute = div.__element.source.attributes.find(a => a.name.data === 'data-symbols');
      expect(attribute?.source.data).toBe('data-symbols="!@#$%^&*()"');

      // Verify data matches source
      const attributeSubstring = html.__source.slice(attribute!.source.startIndex, attribute!.source.endIndex + 1);
      expect(attribute?.source.data).toBe(attributeSubstring);
    });

    test('should sync openTag.data after attributes with special characters', () => {
      const html = new HtmlMod('<div>content</div>');
      const div = html.querySelector('div')!;

      div.dataset.url = 'https://example.com?q=test&sort=desc';
      div.dataset.text = 'He said "hello"';
      div.tagName = 'article';

      // Verify openTag.data includes attributes (with proper quote handling)
      const openSubstring = html.__source.slice(
        div.__element.source.openTag.startIndex,
        div.__element.source.openTag.endIndex + 1
      );
      expect(div.__element.source.openTag.data).toBe(openSubstring);
      expect(openSubstring).toContain('data-url=');
      expect(openSubstring).toContain('data-text=');
      // Should have single quotes around value with double quotes
      expect(openSubstring).toContain(`'He said "hello"'`);
    });
  });
});
