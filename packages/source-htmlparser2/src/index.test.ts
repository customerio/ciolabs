import { ElementType } from 'htmlparser2';
import { describe, expect, test } from 'vitest';

import { nodeToString, parseDocument } from './index';

describe('htmlparser2', () => {
  test('works with doctype', () => {
    const source = `<!DOCTYPE html><html>hello</html>`;
    const document = parseDocument(source);

    expect(nodeToString(document)).toBe(source);
  });

  test('should parse a opening and closing tag', () => {
    const source = `<div class="">hello</div>`;
    const document = parseDocument(source);
    const [element] = document.children;

    if (element.type !== ElementType.Tag) {
      throw new Error('Expected element');
    }

    expect(element.source.openTag.name).toBe('div');
    expect(element.source.openTag.isSelfClosing).toBe(false);
    expect(element.source.closeTag).not.toBe(null);

    expect(source.slice(element.startIndex, element.endIndex! + 1)).toBe(`<div class="">hello</div>`);

    expect(source.slice(element.source.openTag.startIndex, element.source.openTag.endIndex + 1)).toBe(`<div class="">`);

    expect(source.slice(element.source.closeTag!.startIndex, element.source.closeTag!.endIndex + 1)).toBe(`</div>`);

    expect(
      source.slice(
        element.source.attributes[0].name.startIndex,

        element.source.attributes[0].name.endIndex + 1
      )
    ).toBe(`class`);

    expect(
      source.slice(element.source.attributes[0].value!.startIndex, element.source.attributes[0].value!.endIndex + 1)
    ).toBe(``);

    expect(
      source.slice(element.source.attributes[0].source.startIndex, element.source.attributes[0].source.endIndex + 1)
    ).toBe(`class=""`);
  });

  test('should parse a self closing tag with a trailing slash', () => {
    const source = `<div class="foo"/>`;
    const document = parseDocument(source);
    const [element] = document.children;

    if (element.type !== ElementType.Tag) {
      throw new Error('Expected element');
    }

    expect(element.source.openTag.name).toBe('div');
    expect(element.source.openTag.isSelfClosing).toBe(true);
    expect(element.source.closeTag).toBe(null);
    expect(element.source.attributes).toEqual([
      {
        name: {
          startIndex: 5,
          endIndex: 9,
          data: 'class',
        },
        value: {
          startIndex: 12,
          endIndex: 14,
          data: 'foo',
        },
        quote: '"',
        source: {
          startIndex: 5,
          endIndex: 15,
          data: 'class="foo"',
        },
      },
    ]);

    expect(
      source.slice(
        element.source.openTag.startIndex,

        element.source.openTag.endIndex + 1
      )
    ).toBe(`<div class="foo"/>`);

    expect(
      source.slice(
        element.source.attributes[0].name.startIndex,

        element.source.attributes[0].name.endIndex + 1
      )
    ).toBe(`class`);

    expect(
      source.slice(element.source.attributes[0].value!.startIndex, element.source.attributes[0].value!.endIndex + 1)
    ).toBe(`foo`);

    expect(
      source.slice(element.source.attributes[0].source.startIndex, element.source.attributes[0].source.endIndex + 1)
    ).toBe(`class="foo"`);
  });

  test('should parse a self closing tag without a trailing slash', () => {
    const source = `<img class="foo">`;
    const document = parseDocument(source);
    const [element] = document.children;

    if (element.type !== ElementType.Tag) {
      throw new Error('Expected element');
    }

    expect(element.source.openTag.name).toBe('img');
    expect(element.source.openTag.isSelfClosing).toBe(true);
    expect(element.source.closeTag).toBe(null);
    expect(element.source.attributes).toEqual([
      {
        name: {
          startIndex: 5,
          endIndex: 9,
          data: 'class',
        },
        value: {
          startIndex: 12,
          endIndex: 14,
          data: 'foo',
        },
        quote: '"',
        source: {
          startIndex: 5,
          endIndex: 15,
          data: 'class="foo"',
        },
      },
    ]);

    expect(source.slice(element.source.openTag.startIndex, element.source.openTag.endIndex + 1)).toBe(
      `<img class="foo">`
    );

    expect(
      source.slice(element.source.attributes[0].name.startIndex, element.source.attributes[0].name.endIndex + 1)
    ).toBe(`class`);

    expect(
      source.slice(element.source.attributes[0].value!.startIndex, element.source.attributes[0].value!.endIndex + 1)
    ).toBe(`foo`);

    expect(
      source.slice(element.source.attributes[0].source.startIndex, element.source.attributes[0].source.endIndex + 1)
    ).toBe(`class="foo"`);
  });

  test('should parse a self closing tag with a trailing slash and space', () => {
    const source = `<div class="foo" />`;
    const document = parseDocument(source);
    const [element] = document.children;

    if (element.type !== ElementType.Tag) {
      throw new Error('Expected element');
    }

    expect(element.source.openTag.name).toBe('div');
    expect(element.source.openTag.isSelfClosing).toBe(true);
    expect(element.source.closeTag).toBe(null);
    expect(element.source.attributes).toEqual([
      {
        name: {
          startIndex: 5,
          endIndex: 9,
          data: 'class',
        },
        value: {
          startIndex: 12,
          endIndex: 14,
          data: 'foo',
        },
        quote: '"',
        source: {
          startIndex: 5,
          endIndex: 15,
          data: 'class="foo"',
        },
      },
    ]);

    expect(source.slice(element.source.openTag.startIndex, element.source.openTag.endIndex + 1)).toBe(
      `<div class="foo" />`
    );

    expect(
      source.slice(
        element.source.attributes[0].name.startIndex,

        element.source.attributes[0].name.endIndex + 1
      )
    ).toBe(`class`);

    expect(
      source.slice(element.source.attributes[0].value!.startIndex, element.source.attributes[0].value!.endIndex + 1)
    ).toBe(`foo`);

    expect(
      source.slice(element.source.attributes[0].source.startIndex, element.source.attributes[0].source.endIndex + 1)
    ).toBe(`class="foo"`);
  });

  test('should parse a opening tag with a missing closing tag', () => {
    const source = `<div class="foo">content`;
    const document = parseDocument(source);
    const [element] = document.children;

    if (element.type !== ElementType.Tag) {
      throw new Error('Expected element');
    }

    expect(element.source.openTag.name).toBe('div');
    expect(element.source.openTag.isSelfClosing).toBe(false);
    expect(element.source.closeTag).toBe(null);
    expect(element.source.attributes).toEqual([
      {
        name: {
          startIndex: 5,
          endIndex: 9,
          data: 'class',
        },
        value: {
          startIndex: 12,
          endIndex: 14,
          data: 'foo',
        },
        quote: '"',
        source: {
          startIndex: 5,
          endIndex: 15,
          data: 'class="foo"',
        },
      },
    ]);

    expect(source.slice(element.startIndex, element.endIndex! + 1)).toBe(`<div class="foo">content`);

    expect(source.slice(element.source.openTag.startIndex, element.source.openTag.endIndex + 1)).toBe(
      `<div class="foo">`
    );

    expect(
      source.slice(element.source.attributes[0].name.startIndex, element.source.attributes[0].name.endIndex + 1)
    ).toBe(`class`);

    expect(
      source.slice(element.source.attributes[0].value!.startIndex, element.source.attributes[0].value!.endIndex + 1)
    ).toBe(`foo`);

    expect(
      source.slice(element.source.attributes[0].source.startIndex, element.source.attributes[0].source.endIndex + 1)
    ).toBe(`class="foo"`);
  });

  test('should parse a opening tag with a partial closing tag (">" missing)', () => {
    const source = `<div class="foo">content</div`;
    const document = parseDocument(source);
    const [element] = document.children;

    if (element.type !== ElementType.Tag) {
      throw new Error('Expected element');
    }

    expect(element.source.openTag.name).toBe('div');
    expect(element.source.openTag.isSelfClosing).toBe(false);
    expect(element.source.closeTag).toBe(null);
    expect(element.source.attributes).toEqual([
      {
        name: {
          startIndex: 5,
          endIndex: 9,
          data: 'class',
        },
        value: {
          startIndex: 12,
          endIndex: 14,
          data: 'foo',
        },
        quote: '"',
        source: {
          startIndex: 5,
          endIndex: 15,
          data: 'class="foo"',
        },
      },
    ]);

    expect(source.slice(element.startIndex, element.endIndex! + 1)).toBe(`<div class="foo">content<`);

    expect(source.slice(element.source.openTag.startIndex, element.source.openTag.endIndex + 1)).toBe(
      `<div class="foo">`
    );

    expect(
      source.slice(element.source.attributes[0].name.startIndex, element.source.attributes[0].name.endIndex + 1)
    ).toBe(`class`);

    expect(
      source.slice(element.source.attributes[0].value!.startIndex, element.source.attributes[0].value!.endIndex + 1)
    ).toBe(`foo`);

    expect(
      source.slice(element.source.attributes[0].source.startIndex, element.source.attributes[0].source.endIndex + 1)
    ).toBe(`class="foo"`);
  });

  test('should match have the correct end indexes for tags missing closing tags based on the parents', () => {
    const source = '<main><div><span>ok</ main>';

    const document = parseDocument(source);
    const [main] = document.children;

    if (main.type !== ElementType.Tag) {
      throw new Error('Expected element');
    }

    expect(main.source.openTag.name).toBe('main');
    expect(main.source.openTag.isSelfClosing).toBe(false);
    expect(main.source.attributes).toEqual([]);

    expect(source.slice(main.startIndex, main.endIndex! + 1)).toBe('<main><div><span>ok</ main>');
    expect(source.slice(main.source.openTag.startIndex, main.source.openTag.endIndex + 1)).toBe('<main>');
    expect(source.slice(main.source.closeTag!.startIndex, main.source.closeTag!.endIndex + 1)).toBe('</ main>');

    const [div] = main.children;
    if (div.type !== ElementType.Tag) {
      throw new Error('Expected element');
    }

    expect(div.source.openTag.name).toBe('div');
    expect(div.source.openTag.isSelfClosing).toBe(false);
    expect(div.source.attributes).toEqual([]);

    expect(source.slice(div.startIndex, div.endIndex! + 1)).toBe('<div><span>ok');

    expect(source.slice(div.source.openTag.startIndex, div.source.openTag.endIndex + 1)).toBe('<div>');
    expect(div.source.closeTag).toBe(null);

    const [span] = div.children;
    if (span.type !== ElementType.Tag) {
      throw new Error('Expected element');
    }

    expect(span.source.openTag.name).toBe('span');
    expect(span.source.openTag.isSelfClosing).toBe(false);
    expect(span.source.attributes).toEqual([]);
    expect(source.slice(span.startIndex, span.endIndex! + 1)).toBe('<span>ok');

    expect(source.slice(span.source.openTag.startIndex, span.source.openTag.endIndex + 1)).toBe('<span>');

    expect(span.source.closeTag).toBe(null);
  });

  test('should match have the correct end indexes if all tags are missing closing tags', () => {
    const source = '<main><div><span>ok';

    const document = parseDocument(source);
    const [main] = document.children;

    if (main.type !== ElementType.Tag) {
      throw new Error('Expected element');
    }

    expect(main.source.openTag.name).toBe('main');
    expect(main.source.openTag.isSelfClosing).toBe(false);
    expect(main.source.attributes).toEqual([]);

    expect(source.slice(main.startIndex, main.endIndex! + 1)).toBe('<main><div><span>ok');
    expect(source.slice(main.source.openTag.startIndex, main.source.openTag.endIndex + 1)).toBe('<main>');
    expect(main.source.closeTag).toBe(null);

    const [div] = main.children;
    if (div.type !== ElementType.Tag) {
      throw new Error('Expected element');
    }

    expect(div.source.openTag.name).toBe('div');
    expect(div.source.openTag.isSelfClosing).toBe(false);
    expect(div.source.attributes).toEqual([]);

    expect(source.slice(div.startIndex, div.endIndex! + 1)).toBe('<div><span>ok');

    expect(source.slice(div.source.openTag.startIndex, div.source.openTag.endIndex + 1)).toBe('<div>');
    expect(div.source.closeTag).toBe(null);

    const [span] = div.children;
    if (span.type !== ElementType.Tag) {
      throw new Error('Expected element');
    }

    expect(span.source.openTag.name).toBe('span');
    expect(span.source.openTag.isSelfClosing).toBe(false);
    expect(span.source.attributes).toEqual([]);
    expect(source.slice(span.startIndex, span.endIndex! + 1)).toBe('<span>ok');

    expect(source.slice(span.source.openTag.startIndex, span.source.openTag.endIndex + 1)).toBe('<span>');

    expect(span.source.closeTag).toBe(null);
  });

  test('should correctly convert offset to line and character', () => {
    const dom = parseDocument(`this is the start
      <div>
        <span>hello</span>
      </div>
this is the end`);

    expect(dom.offsetToPosition(0)).toEqual({ line: 0, character: 0 });
    expect(dom.offsetToPosition(1)).toEqual({ line: 0, character: 1 });

    const div = dom.children[1];

    if (div.type !== ElementType.Tag) {
      throw new Error('Expected element');
    }

    expect(dom.offsetToPosition(div.source.openTag.startIndex)).toEqual({
      line: 1,
      character: 6,
    });

    expect(dom.offsetToPosition(div.source.openTag.endIndex + 1)).toEqual({
      line: 1,
      character: 11,
    });

    expect(dom.offsetToPosition(85)).toEqual({
      line: 4,
      character: 15,
    });
  });

  test('should parse a closing tag with a ">" missing followed by whitespace', () => {
    const source = `<div>content</div `;
    const document = parseDocument(source);
    const [element] = document.children;

    if (element.type !== ElementType.Tag) {
      throw new Error('Expected element');
    }

    expect(element.source.closeTag!.name).toBe('div');
    expect(element.source.closeTag!.startIndex).toBe(12);
    expect(element.source.closeTag!.endIndex).toBe(source.length);
  });

  describe('autofix', () => {
    test('should fix a partial closing tag', () => {
      const source = `<div>content</anything`;
      const document = parseDocument(source, {
        autofix: true,
      });
      const [element] = document.children;

      if (element.type !== ElementType.Tag) {
        throw new Error('Expected element');
      }

      expect(element.source.closeTag!.name).toBe('div');
      expect(element.source.closeTag!.startIndex).toBe(-1);
      expect(element.source.closeTag!.endIndex).toBe(-1);

      expect(nodeToString(document)).toBe(`<div>content</div>`);
    });

    test('should fix a missing closing tag', () => {
      const source = `<div>content`;
      const document = parseDocument(source, {
        autofix: true,
      });
      const [element] = document.children;

      if (element.type !== ElementType.Tag) {
        throw new Error('Expected element');
      }

      expect(element.source.closeTag!.name).toBe('div');
      expect(element.source.closeTag!.startIndex).toBe(-1);
      expect(element.source.closeTag!.endIndex).toBe(-1);

      expect(nodeToString(document)).toBe(`<div>content</div>`);
    });

    test('should fix a missing closing tag in a nested tag', () => {
      const source = `<main><div>content`;
      const document = parseDocument(source, {
        autofix: true,
      });
      const [main] = document.children;

      if (main.type !== ElementType.Tag) {
        throw new Error('Expected element');
      }

      expect(main.source.closeTag!.name).toBe('main');
      expect(main.source.closeTag!.startIndex).toBe(-1);
      expect(main.source.closeTag!.endIndex).toBe(-1);

      expect(nodeToString(document)).toBe(`<main><div>content</div></main>`);
    });

    test('should fix a missing closing tag in a valid parent', () => {
      const source = `<main><div>content</main>`;
      const document = parseDocument(source, {
        autofix: true,
      });
      const [main] = document.children;

      if (main.type !== ElementType.Tag) {
        throw new Error('Expected element');
      }

      expect(nodeToString(document)).toBe(`<main><div>content</div></main>`);
    });

    test('should allow self-closing custom components with `recognizeSelfClosing`', () => {
      const source = `<x-section>Before<x-image />after</x-section>`;
      const document = parseDocument(source, {
        autofix: true,
        recognizeSelfClosing: true,
      });
      const [main] = document.children;

      if (main.type !== ElementType.Tag) {
        throw new Error('Expected element');
      }

      expect(nodeToString(document)).toBe(`<x-section>Before<x-image />after</x-section>`);
    });

    test('should fix missing closing tag on a repeated element', () => {
      const source = `<div><p>content<p>more content</p></div>`;
      const document = parseDocument(source, {
        autofix: true,
      });
      const [main] = document.children;

      if (main.type !== ElementType.Tag) {
        throw new Error('Expected element');
      }

      expect(nodeToString(document)).toBe(`<div><p>content</p><p>more content</p></div>`);
    });

    test('should fix tables with missing closing tags', () => {
      const source = `
      <div>
        <table>
          <tr>
            <td>
      </div>
      </td>`;

      const document = parseDocument(source, {
        autofix: true,
      });

      const output = nodeToString(document);
      expect(output).toBe(`
      <div>
        <table>
          <tr>
            <td>
      </td></tr></table></div>
      </td>`);
    });
  });
});

describe('nodeToString', () => {
  test('works with valid html', () => {
    const source = '<div class="foo">content <!--cool--></div>';
    const document = parseDocument(source);

    expect(nodeToString(document)).toBe(source);
  });

  test('works with invalid html', () => {
    const source = '<div class={{foo}}>content <!--cool-->';

    const document = parseDocument(source);

    expect(nodeToString(document)).toBe(source);
  });

  test('works with mismatched close tags', () => {
    const justCloseTag = 'hello world </div>';
    const document = parseDocument(justCloseTag);
    expect(nodeToString(document)).toBe(justCloseTag);

    const mismatched = '<div>hello world </span>';
    const document2 = parseDocument(mismatched);
    expect(nodeToString(document2)).toBe(mismatched);
  });

  test('html entities should be left alone', () => {
    const source = '<div>&lt; and &lt;ul&gt;</div>';

    const document = parseDocument(source);

    expect(nodeToString(document)).toBe(source);
  });

  test('xml tags with uppercase characters should be left alone', () => {
    const source = `
    <noscript>
      <xml>
        <o:OfficeDocumentSettings>
          <o:PixelsPerInch>96</o:PixelsPerInch>
        </o:OfficeDocumentSettings>
      </xml>
    </noscript>`;

    const document = parseDocument(source);

    expect(nodeToString(document)).toBe(source);
  });

  test('works with mismatched tables', () => {
    const source = `
    <div>
      <table>
        <tr>
          <td>
    </div>
`;

    const document = parseDocument(source, {
      autofix: false,
    });

    const output = nodeToString(document);
    expect(output).toBe(source);
  });

  test('should pass through script tags', () => {
    const source = `<script>console.log('hello');</script>`;
    const document = parseDocument(source);

    expect(nodeToString(document)).toBe(source);
  });
});
