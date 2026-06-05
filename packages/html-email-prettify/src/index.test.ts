import { HtmlMod } from '@ciolabs/html-mod';
import { test, expect, describe } from 'vitest';

import prettify from './index';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Get the formatted string from either HtmlMod or string input */
function format(html: string): string {
  const result = prettify(html);
  return result.__source;
}

// ---------------------------------------------------------------------------
// Basic formatting
// ---------------------------------------------------------------------------

describe('basic formatting', () => {
  test('indents nested elements', () => {
    const result = format('<div><p>hello</p></div>');
    expect(result).toBe(
      `<div>
  <p>hello</p>
</div>`
    );
  });

  test('fixes inconsistent indentation', () => {
    const result = format(`
      <div>
    <p>hello</p>
          <span>world</span>
      </div>
    `);
    expect(result).toBe(
      `<div>
  <p>hello</p>
  <span>world</span>
</div>`
    );
  });

  test('handles empty input', () => {
    const result = format('');
    expect(result).toBe('');
  });

  test('preserves self-closing tags', () => {
    const result = format('<div><br/><img src="test.png"/></div>');
    // AST-based formatter preserves original self-closing syntax
    expect(result).toBe(`<div><br/><img src="test.png"/></div>`);
  });

  test('formats a full HTML document', () => {
    const result = format(
      `<!DOCTYPE html><html><head><title>Test</title></head><body><div><p>hello</p></div></body></html>`
    );
    // DOCTYPE and html should be on separate lines
    expect(result).toMatch(/<!DOCTYPE html>\n<html>/);
    expect(result).toContain('</html>');
    // Content should be indented
    expect(result).toMatch(/\s+<p>hello<\/p>/);
  });

  test('preserves attributes', () => {
    const result = format('<div class="foo" id="bar" style="color: red;"><p>hello</p></div>');
    expect(result).toContain('class="foo"');
    expect(result).toContain('id="bar"');
    expect(result).toContain('style="color: red;"');
  });
});

// ---------------------------------------------------------------------------
// Pre/code preservation
// ---------------------------------------------------------------------------

describe('pre and code preservation', () => {
  test('preserves whitespace inside <pre> tags', () => {
    const result = format(
      `<div><pre>  line 1
    line 2
      line 3</pre></div>`
    );
    expect(result).toContain(
      `<pre>  line 1
    line 2
      line 3</pre>`
    );
  });

  test('preserves whitespace inside <code> tags', () => {
    const result = format(`<div><code>  function() { return true; }  </code></div>`);
    expect(result).toContain('  function() { return true; }  ');
  });

  test('preserves whitespace inside <textarea> tags', () => {
    const result = format(
      `<div><textarea>  some
    preformatted
      text  </textarea></div>`
    );
    expect(result).toContain(
      `<textarea>  some
    preformatted
      text  </textarea>`
    );
  });
});

// ---------------------------------------------------------------------------
// Conditional comments — single-line
// ---------------------------------------------------------------------------

describe('single-line conditional comments', () => {
  test('preserves single-line conditional comment content', () => {
    const result = format(
      `<div><!--[if mso]><table cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]--></div>`
    );
    expect(result).toContain('<!--[if mso]><table cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->');
  });

  test('preserves single-line conditional comment when it has no content', () => {
    const result = format(`<div><!--[if mso]><![endif]--></div>`);
    expect(result).toContain('<!--[if mso]><![endif]-->');
  });

  test("preserves Mark's link button pattern", () => {
    const input = `<a href="https://parcel.io" style="background-color:#005959; text-decoration: none; padding: .5em 2em; color: #FCFDFF; display:inline-block; border-radius:.4em; mso-padding-alt:0;text-underline-color:#005959"><!--[if mso]><i style="mso-font-width:200%;mso-text-raise:100%" hidden>&emsp;</i><span style="mso-text-raise:50%;"><![endif]-->My link text<!--[if mso]></span><i style="mso-font-width:200%;" hidden>&emsp;&#8203;</i><![endif]--></a>`;

    const result = format(input);

    // Both conditional comments should remain single-line with original content
    expect(result).toContain(
      '<!--[if mso]><i style="mso-font-width:200%;mso-text-raise:100%" hidden>&emsp;</i><span style="mso-text-raise:50%;"><![endif]-->'
    );
    expect(result).toContain(
      '<!--[if mso]></span><i style="mso-font-width:200%;" hidden>&emsp;&#8203;</i><![endif]-->'
    );
  });

  test('preserves paired ghost table conditional comments', () => {
    const result = format(`<div>
  <!--[if mso]><table cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="background-color: rgb(255, 255, 255);"><![endif]-->
  <p>Content</p>
  <!--[if mso]></td></tr></table><![endif]-->
</div>`);

    expect(result).toContain(
      '<!--[if mso]><table cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="background-color: rgb(255, 255, 255);"><![endif]-->'
    );
    expect(result).toContain('<!--[if mso]></td></tr></table><![endif]-->');
  });

  test('keeps no whitespace if there was none', () => {
    const result = format('<div><!--[if MAC]>hello<![endif]--></div>');
    expect(result).toContain('<!--[if MAC]>hello<![endif]-->');
  });
});

// ---------------------------------------------------------------------------
// Conditional comments — multi-line
// ---------------------------------------------------------------------------

describe('multi-line conditional comments', () => {
  test('formats content inside multi-line conditional comments', () => {
    const result = format(`<div>
<!--[if mso]>
<table cellpadding="0" cellspacing="0">
<tr>
<td>Content</td>
</tr>
</table>
<![endif]-->
</div>`);

    // The content inside should be indented
    expect(result).toContain('<!--[if mso]>');
    expect(result).toContain('<![endif]-->');
    expect(result).toContain('<table');
    expect(result).toContain('</table>');
  });

  test('aligns open and close tags of multi-line conditional comments', () => {
    const result = format(`
    <div>
    <!--[if MAC]>
    <div>
    <span>
    <![endif]-->
    <!--[if MAC]>
    </span>
    </div>
    <![endif]-->
    </div>
  `);

    const lines = result.split('\n');

    // Find lines with conditional comment open/close tags
    for (const line of lines) {
      if (line.includes('<!--[if MAC]>')) {
        // Find the matching close
        const openIndent = line.match(/^(\s*)/)?.[1] ?? '';
        const closeLineIndex = lines.indexOf(
          lines.find((l, index) => index > lines.indexOf(line) && l.includes('<![endif]-->'))!
        );
        if (closeLineIndex >= 0) {
          const closeIndent = lines[closeLineIndex].match(/^(\s*)/)?.[1] ?? '';
          expect(openIndent).toBe(closeIndent);
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Inline element whitespace preservation
// ---------------------------------------------------------------------------

describe('inline element whitespace', () => {
  test('does not add whitespace between adjacent inline elements', () => {
    const result = format('<div><span>a</span><span>b</span></div>');
    expect(result).toContain('<span>a</span><span>b</span>');
  });

  test('does not add whitespace between adjacent img elements', () => {
    const result = format('<div><img src="a.png"/><img src="b.png"/></div>');
    expect(result).toContain('<img src="a.png"/><img src="b.png"/>');
  });

  test('does not add whitespace between adjacent anchor elements', () => {
    const result = format('<div><a href="#">link1</a><a href="#">link2</a></div>');
    expect(result).toContain('<a href="#">link1</a><a href="#">link2</a>');
  });

  test('preserves space between inline elements when it exists', () => {
    const result = format('<div><span>a</span> <span>b</span></div>');
    // The space between the spans should be preserved
    expect(result).toMatch(/<span>a<\/span>\s+<span>b<\/span>/);
  });

  test('does not add whitespace between mixed inline elements', () => {
    const result = format('<div><strong>bold</strong><em>italic</em><span>text</span></div>');
    expect(result).toContain('<strong>bold</strong><em>italic</em><span>text</span>');
  });
});

// ---------------------------------------------------------------------------
// Table adjacency
// ---------------------------------------------------------------------------

describe('table element formatting', () => {
  test('formats table structure with proper indentation', () => {
    const result = format('<table><tr><td>cell1</td><td>cell2</td></tr></table>');
    expect(result).toContain('<table>');
    expect(result).toContain('</table>');
    expect(result).toContain('<td>cell1</td>');
    expect(result).toContain('<td>cell2</td>');
  });

  test('handles nested tables', () => {
    const result = format('<table><tr><td><table><tr><td>inner</td></tr></table></td></tr></table>');
    expect(result).toContain('inner');
    // Should have some indentation structure
    const lines = result.split('\n');
    expect(lines.length).toBeGreaterThan(1);
  });
});

// ---------------------------------------------------------------------------
// Ghost table pattern
// ---------------------------------------------------------------------------

describe('ghost table patterns', () => {
  test('formats a complete ghost table layout', () => {
    const result =
      format(`<!--[if mso]><table cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td><![endif]-->
<div style="max-width: 600px; margin: 0 auto;">
<p>Content here</p>
</div>
<!--[if mso]></td></tr></table><![endif]-->`);

    // Single-line conditional comments should be preserved
    expect(result).toContain('<!--[if mso]>');
    expect(result).toContain('<![endif]-->');
    // Content should be formatted
    expect(result).toContain('<p>Content here</p>');
  });

  test('handles multiple ghost table columns', () => {
    const result = format(`<!--[if true]>
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0">
<tr>
<td width="300">
<![endif]-->
<div style="display:inline-block; width:300px;">
Column 1
</div>
<!--[if true]>
</td>
<td width="300">
<![endif]-->
<div style="display:inline-block; width:300px;">
Column 2
</div>
<!--[if true]>
</td>
</tr>
</table>
<![endif]-->`);

    expect(result).toContain('Column 1');
    expect(result).toContain('Column 2');
  });
});

// ---------------------------------------------------------------------------
// HtmlMod integration
// ---------------------------------------------------------------------------

describe('HtmlMod integration', () => {
  test('accepts a string and returns HtmlMod', () => {
    const result = prettify('<div><p>hello</p></div>');
    expect(result).toBeInstanceOf(HtmlMod);
    expect(result.__source).toContain('<div>');
  });

  test('accepts HtmlMod and returns the same instance', () => {
    const mod = new HtmlMod('<div><p>hello</p></div>');
    const result = prettify(mod);
    expect(result).toBe(mod); // Same reference
  });

  test('mutates HtmlMod source in place', () => {
    const mod = new HtmlMod('  <div><p>hello</p></div>  ');
    prettify(mod);
    // Source should be updated
    expect(mod.__source).not.toBe('  <div><p>hello</p></div>  ');
  });

  test('returned HtmlMod can be queried', () => {
    const result = prettify('<div class="test"><p>hello</p></div>');
    const div = result.querySelector('.test');
    expect(div).not.toBeNull();
    expect(div!.innerHTML).toContain('<p>hello</p>');
  });

  test('returned HtmlMod can be modified after formatting', () => {
    const result = prettify('<div><p>hello</p></div>');
    const p = result.querySelector('p');
    expect(p).not.toBeNull();
    p!.textContent = 'world';
    expect(result.__source).toContain('world');
  });

  test('HtmlMod modifications followed by prettify', () => {
    const mod = new HtmlMod('<div><p>hello</p></div>');
    const p = mod.querySelector('p')!;
    p.after('<span>added</span>');

    prettify(mod);

    expect(mod.__source).toContain('<p>hello</p>');
    expect(mod.__source).toContain('<span>added</span>');
    // Should be properly formatted
    const lines = mod.__source.split('\n');
    expect(lines.length).toBeGreaterThan(1);
  });

  test('preserves HtmlMod options', () => {
    const mod = new HtmlMod('<div />', { recognizeSelfClosing: true });
    prettify(mod);
    expect(mod.__options.recognizeSelfClosing).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Real-world email patterns
// ---------------------------------------------------------------------------

describe('real-world email patterns', () => {
  test('formats a typical email structure', () => {
    const result = format(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Email</title><style>body { margin: 0; }</style></head><body><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center"><table role="presentation" width="600" cellpadding="0" cellspacing="0"><tr><td><h1>Hello!</h1><p>This is an email.</p></td></tr></table></td></tr></table></body></html>`);

    expect(result).toContain('<!DOCTYPE html>');
    expect(result).toContain('<h1>Hello!</h1>');
    expect(result).toContain('<p>This is an email.</p>');
    // Should have meaningful indentation
    const lines = result.split('\n');
    expect(lines.length).toBeGreaterThan(5);
  });

  test('formats email with MSO conditional head styles', () => {
    const result = format(`<!DOCTYPE html>
<html>
<head>
<!--[if mso]>
<style>
.button { padding: 10px; }
</style>
<![endif]-->
</head>
<body>
<p>Hello</p>
</body>
</html>`);

    expect(result).toContain('<!--[if mso]>');
    expect(result).toContain('<![endif]-->');
    expect(result).toContain('<p>Hello</p>');
  });

  test('handles Outlook button with VML-style padding', () => {
    const input = `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="padding: 20px;">
<a href="https://example.com" style="background:#005959;text-decoration:none;padding:.5em 2em;color:#FCFDFF;display:inline-block;border-radius:.4em;mso-padding-alt:0;text-underline-color:#005959"><!--[if mso]><i style="mso-font-width:200%;mso-text-raise:100%" hidden>&emsp;</i><span style="mso-text-raise:50%;"><![endif]-->Click Here<!--[if mso]></span><i style="mso-font-width:200%;" hidden>&emsp;&#8203;</i><![endif]--></a>
</td></tr></table>`;

    const result = format(input);

    // The button pattern MUST stay intact — whitespace here breaks Outlook
    expect(result).toContain(
      '<!--[if mso]><i style="mso-font-width:200%;mso-text-raise:100%" hidden>&emsp;</i><span style="mso-text-raise:50%;"><![endif]-->'
    );
    expect(result).toContain(
      '<!--[if mso]></span><i style="mso-font-width:200%;" hidden>&emsp;&#8203;</i><![endif]-->'
    );
  });

  test('preserves inline whitespace in single-line conditional comments', () => {
    const result = format('<div> <!--[if MAC]> hello    <![endif]-->      </div>');
    expect(result).toContain('<!--[if MAC]> hello    <![endif]-->');
  });

  test('handles downlevel-revealed (negated) conditional comments', () => {
    const result = format(`<!--[if !mso]><!--><div>Non-Outlook content</div><!--<![endif]-->`);
    // Bubble/revealed comments should pass through
    expect(result).toContain('Non-Outlook content');
  });

  test('formats from existing tests: properly format from a single line', () => {
    const result = format(`<!DOCTYPE html>
  <html style="">

    <body class="">

      <!--[if mso]><table cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="background-color: rgb(255, 255, 255);"><![endif]-->

      <!--[if mso]></td></tr></table><![endif]-->

       </body>
  </html>`);

    expect(result).toContain('<!DOCTYPE html>');
    expect(result).toContain('</html>');
    // Single-line conditional comments should be preserved
    expect(result).toContain(
      '<!--[if mso]><table cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="background-color: rgb(255, 255, 255);"><![endif]-->'
    );
    expect(result).toContain('<!--[if mso]></td></tr></table><![endif]-->');
  });
});

// ---------------------------------------------------------------------------
// Options pass-through
// ---------------------------------------------------------------------------

describe('options', () => {
  test('respects custom indentSize', () => {
    const result = prettify('<div><p>hello</p></div>', { indentSize: 4 });
    expect(result.__source).toContain('    <p>hello</p>');
  });

  test('respects custom indentChar', () => {
    const result = prettify('<div><p>hello</p></div>', {
      indentSize: 1,
      indentChar: '\t',
    });
    expect(result.__source).toContain('\t<p>hello</p>');
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('edge cases', () => {
  test('handles multiple conditional comments on the same line', () => {
    const result = format('<!--[if mso]><table><![endif]--><!--[if mso]></table><![endif]-->');
    expect(result).toContain('<!--[if mso]><table><![endif]-->');
    expect(result).toContain('<!--[if mso]></table><![endif]-->');
  });

  test('handles nested conditional comments', () => {
    const result = format(`<!--[if mso]>
<table>
<!--[if gte mso 9]>
<tr><td>inner</td></tr>
<![endif]-->
</table>
<![endif]-->`);

    expect(result).toContain('<!--[if mso]>');
    expect(result).toContain('<!--[if gte mso 9]>');
    expect(result).toContain('<![endif]-->');
  });

  test('handles conditional comments with no content', () => {
    const result = format('<div><!--[if mso]><![endif]--></div>');
    expect(result).toContain('<!--[if mso]><![endif]-->');
  });

  test('handles deeply nested HTML', () => {
    const result = format('<div><div><div><div><div><p>deep</p></div></div></div></div></div>');
    expect(result).toContain('deep');
    const lines = result.split('\n');
    expect(lines.length).toBeGreaterThan(5);
  });

  test('does not crash on malformed HTML', () => {
    const result = format('<div><p>unclosed');
    expect(result).toContain('unclosed');
  });

  test('handles empty conditional comment between content', () => {
    const result = format('<p>before</p><!--[if mso]><![endif]--><p>after</p>');
    expect(result).toContain('before');
    expect(result).toContain('after');
    expect(result).toContain('<!--[if mso]><![endif]-->');
  });

  test('handles HTML with only whitespace', () => {
    const result = format('   \n\n   ');
    expect(result.trim()).toBe('');
  });

  test('handles single element', () => {
    const result = format('<br/>');
    expect(result).toContain('<br');
  });

  test('handles comment-only HTML', () => {
    const result = format('<!-- just a comment -->');
    expect(result).toContain('<!-- just a comment -->');
  });
});

// ---------------------------------------------------------------------------
// Idempotency
// ---------------------------------------------------------------------------

describe('idempotency', () => {
  test('formatting twice produces the same result', () => {
    const input = `<div>
      <p>hello</p>
        <span>world</span>
    </div>`;

    const first = format(input);
    const second = format(first);
    expect(second).toBe(first);
  });

  test('formatting a well-formatted document is a no-op', () => {
    const input = `<div>
  <p>hello</p>
  <span>world</span>
</div>`;

    const result = format(input);
    expect(result).toBe(input);
  });

  test('idempotent with conditional comments', () => {
    const input = `<div>
  <!--[if mso]><table><tr><td><![endif]-->
  <p>Content</p>
  <!--[if mso]></td></tr></table><![endif]-->
</div>`;

    const first = format(input);
    const second = format(first);
    expect(second).toBe(first);
  });

  test("idempotent with Mark's button pattern", () => {
    const input = `<a href="https://parcel.io" style="background:#005959;text-decoration:none;padding:.5em 2em;color:#FCFDFF;display:inline-block"><!--[if mso]><i style="mso-font-width:200%;mso-text-raise:100%" hidden>&emsp;</i><span style="mso-text-raise:50%;"><![endif]-->Click<!--[if mso]></span><i style="mso-font-width:200%;" hidden>&emsp;&#8203;</i><![endif]--></a>`;

    const first = format(input);
    const second = format(first);
    expect(second).toBe(first);
  });
});

// ---------------------------------------------------------------------------
// Multiple sequential edits + format
// ---------------------------------------------------------------------------

describe('edit then format workflow', () => {
  test('format after adding elements', () => {
    const mod = new HtmlMod('<div><p>original</p></div>');
    const p = mod.querySelector('p')!;
    p.after('<p>added1</p><p>added2</p>');

    prettify(mod);

    const source = mod.__source;
    expect(source).toContain('<p>original</p>');
    expect(source).toContain('<p>added1</p>');
    expect(source).toContain('<p>added2</p>');

    // All p tags should be at the same indentation level
    const lines = source.split('\n');
    const pLines = lines.filter(l => l.trim().startsWith('<p>'));
    const indents = pLines.map(l => l.match(/^(\s*)/)?.[1]?.length ?? 0);
    expect(new Set(indents).size).toBe(1);
  });

  test('format after removing elements', () => {
    const mod = new HtmlMod(`<div>
  <p>keep</p>
  <p>remove</p>
  <p>keep too</p>
</div>`);
    const toRemove = mod.querySelectorAll('p')[1];
    toRemove.remove();

    prettify(mod);

    expect(mod.__source).toContain('<p>keep</p>');
    expect(mod.__source).not.toContain('remove');
    expect(mod.__source).toContain('<p>keep too</p>');
  });

  test('format after changing innerHTML', () => {
    const mod = new HtmlMod('<div><p>old</p></div>');
    const div = mod.querySelector('div')!;
    div.innerHTML = '<table><tr><td>cell1</td><td>cell2</td></tr></table>';

    prettify(mod);

    expect(mod.__source).toContain('<table>');
    expect(mod.__source).toContain('cell1');
    expect(mod.__source).toContain('cell2');
    // Should be formatted, not all on one line
    const lines = mod.__source.split('\n');
    expect(lines.length).toBeGreaterThan(1);
  });

  test('format after setAttribute', () => {
    const mod = new HtmlMod('<div><p>text</p></div>');
    const p = mod.querySelector('p')!;
    p.setAttribute('class', 'highlight');
    p.setAttribute('style', 'color: red;');

    prettify(mod);

    expect(mod.__source).toContain('class="highlight"');
    expect(mod.__source).toContain('style="color: red;"');
  });

  test('multiple format calls on same HtmlMod', () => {
    const mod = new HtmlMod('<div><p>hello</p></div>');

    // First format
    prettify(mod);
    const after1 = mod.__source;

    // Add content
    mod.querySelector('p')!.after('<p>world</p>');

    // Second format
    prettify(mod);
    const after2 = mod.__source;

    expect(after2).toContain('<p>hello</p>');
    expect(after2).toContain('<p>world</p>');
    expect(after2).not.toBe(after1);
  });
});

// ---------------------------------------------------------------------------
// Whitespace-sensitive email patterns (deeper coverage)
// ---------------------------------------------------------------------------

describe('whitespace-sensitive email patterns', () => {
  test('inline-block columns with no gap', () => {
    // This is the #1 email whitespace issue — space between inline-block
    // elements causes columns to stack on iOS/Android.
    // When two elements are directly adjacent (no whitespace text node),
    // the formatter must NOT insert whitespace between them.
    const result = format(
      '<div style="font-size:0;"><div style="display:inline-block;width:50%;">Col 1</div><div style="display:inline-block;width:50%;">Col 2</div></div>'
    );
    expect(result).toContain('</div><div style="display:inline-block;width:50%;">Col 2</div>');
  });

  test('inline-block columns with existing whitespace text node stay adjacent', () => {
    // Already-formatted source with a space between inline-block elements.
    // The formatter must not expand this to a newline + indent.
    const result = format(
      '<div style="font-size:0;"><div style="display:inline-block;width:50%;">Col 1</div> <div style="display:inline-block;width:50%;">Col 2</div></div>'
    );
    // Should NOT have a newline between the two inline-block divs
    expect(result).not.toMatch(/<\/div>\n\s*<div style="display:inline-block;width:50%;">Col 2/);
  });

  test('inline-block div next to block element gets separated', () => {
    const result = format('<td><div style="display:inline-block;">A</div><p>B</p></td>');
    // The p is not inline-block, so whitespace should be inserted
    expect(result).toContain('</div>\n');
    expect(result).toContain('<p>B</p>');
  });

  test('adjacent regular divs get separated', () => {
    const result = format('<td><div>A</div><div>B</div></td>');
    expect(result).toContain('<div>A</div>\n');
    expect(result).toContain('<div>B</div>');
    // Both divs should be on separate lines
    const lines = result.split('\n').filter(l => l.includes('<div>'));
    expect(lines.length).toBe(2);
  });

  test('adjacent spans in button text', () => {
    const result = format(
      '<a href="#"><span style="color:white;">Click</span><span style="color:white;"> Here</span></a>'
    );
    // Inline elements should stay adjacent
    expect(result).toContain('<span style="color:white;">Click</span><span style="color:white;"> Here</span>');
  });

  test('conditional comment between text content', () => {
    const result = format('<td>Before<!--[if mso]>&nbsp;<![endif]-->After</td>');
    expect(result).toContain('<!--[if mso]>&nbsp;<![endif]-->');
  });

  test('multiple single-line conditional comments in email', () => {
    const result = format(`<body>
<!--[if mso]><table width="600"><tr><td><![endif]-->
<div style="max-width:600px;">
  <h1>Title</h1>
  <a href="#"><!--[if mso]><i hidden>&emsp;</i><span><![endif]-->Button<!--[if mso]></span><i hidden>&emsp;</i><![endif]--></a>
</div>
<!--[if mso]></td></tr></table><![endif]-->
</body>`);

    // All 4 single-line conditional comments should be preserved
    expect(result).toContain('<!--[if mso]><table width="600"><tr><td><![endif]-->');
    expect(result).toContain('<!--[if mso]></td></tr></table><![endif]-->');
    expect(result).toContain('<!--[if mso]><i hidden>&emsp;</i><span><![endif]-->');
    expect(result).toContain('<!--[if mso]></span><i hidden>&emsp;</i><![endif]-->');
  });

  test('preserves comment with HTML entities in content', () => {
    const result = format('<div><!--[if mso]><i hidden>&emsp;&nbsp;&#8203;</i><![endif]--></div>');
    expect(result).toContain('<!--[if mso]><i hidden>&emsp;&nbsp;&#8203;</i><![endif]-->');
  });

  test('adjacent block elements with no whitespace between them', () => {
    const result = format('<div><p>hello</p><p>world</p></div>');
    expect(result).toBe(`<div>\n  <p>hello</p>\n  <p>world</p>\n</div>`);
  });

  test('ghost table open/close in separate comments with compact content', () => {
    const result = format(
      '<!--[if mso]><table><tr><td><![endif]--><div><p>hello</p><p>world</p></div><!--[if mso]></td></tr></table><![endif]-->'
    );

    // Single-line conditional comments preserved
    expect(result).toContain('<!--[if mso]><table><tr><td><![endif]-->');
    expect(result).toContain('<!--[if mso]></td></tr></table><![endif]-->');
    // Content between them is formatted
    expect(result).toContain('<div>');
    expect(result).toContain('  <p>hello</p>');
    expect(result).toContain('  <p>world</p>');
    expect(result).toContain('</div>');
    // Comments are on their own lines, not glued to content
    const lines = result.split('\n');
    expect(lines[0].trim()).toBe('<!--[if mso]><table><tr><td><![endif]-->');
    expect(lines.at(-1)!.trim()).toBe('<!--[if mso]></td></tr></table><![endif]-->');
  });

  test('ghost table with messy table content gets formatted', () => {
    const result = format(
      '<!--[if mso]><table><tr><td><![endif]-->\n<div><table><tr><td>cell1</td><td>cell2</td></tr><tr><td>cell3</td><td>cell4</td></tr></table></div>\n<!--[if mso]></td></tr></table><![endif]-->'
    );

    // Table inside should be properly indented
    expect(result).toContain('  <table>');
    expect(result).toContain('      <td>cell1</td>');
    expect(result).toContain('      <td>cell3</td>');
  });

  test('html-mod insertion between ghost table comments gets formatted', () => {
    const mod = new HtmlMod(
      '<div><!--[if mso]><table><tr><td><![endif]--><p>original</p><!--[if mso]></td></tr></table><![endif]--></div>'
    );
    mod.querySelector('p')!.after('<table><tr><td>inserted</td></tr></table>');

    prettify(mod);

    expect(mod.__source).toContain('<p>original</p>');
    expect(mod.__source).toContain('<td>inserted</td>');
    // The inserted table should be properly indented
    expect(mod.__source).toContain('  <table>');
    // Both conditional comments preserved
    expect(mod.__source).toContain('<!--[if mso]><table><tr><td><![endif]-->');
    expect(mod.__source).toContain('<!--[if mso]></td></tr></table><![endif]-->');
  });

  test('conditional comment wrapping an entire table structure', () => {
    const result = format(`<!--[if mso]>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" align="center">
<tr>
<td>
<![endif]-->
<div style="max-width: 600px; margin: 0 auto;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%">
<tr>
<td style="padding: 20px;">
<h1>Hello World</h1>
<p>This is an email body.</p>
</td>
</tr>
</table>
</div>
<!--[if mso]>
</td>
</tr>
</table>
<![endif]-->`);

    // Multi-line conditional comments should be formatted
    expect(result).toContain('<!--[if mso]>');
    expect(result).toContain('<![endif]-->');
    expect(result).toContain('<h1>Hello World</h1>');
    expect(result).toContain('<p>This is an email body.</p>');
  });
});

// ---------------------------------------------------------------------------
// Regression: multi-line conditional comment followed by content
// ---------------------------------------------------------------------------

describe('multi-line conditional comment AST integrity', () => {
  test('comment ranges do not bleed into following elements', () => {
    const mod = prettify('<!--[if mso]>\n<table><tr><td>x</td></tr></table>\n<![endif]--><div><p>after</p></div>');

    // The <div> should be queryable and its positions correct
    const div = mod.querySelector('div');
    expect(div).not.toBeNull();
    expect(div!.innerHTML).toContain('<p>after</p>');
    expect(div!.outerHTML).toContain('<div>');

    // The <p> inside should also be valid
    const paragraph = mod.querySelector('p');
    expect(paragraph).not.toBeNull();
    expect(paragraph!.textContent).toBe('after');
  });

  test('further edits after formatting multi-line comments stay valid', () => {
    const mod = prettify('<!--[if mso]>\n<table><tr><td>x</td></tr></table>\n<![endif]--><div><p>after</p></div>');

    // Modify content after the conditional comment
    const paragraph = mod.querySelector('p')!;
    paragraph.textContent = 'changed';

    expect(mod.__source).toContain('changed');
    expect(mod.__source).toContain('<![endif]-->');
    // The change should not corrupt the conditional comment
    expect(mod.__source).not.toContain('changed</td>');
  });
});

// ---------------------------------------------------------------------------
// Regression: preserved elements treated as block for sibling formatting
// ---------------------------------------------------------------------------

describe('preserved element sibling formatting', () => {
  test('pre inside div gets indentation around it', () => {
    const result = format('<div><pre>  line1\n  line2</pre></div>');
    expect(result).toBe(`<div>\n  <pre>  line1\n  line2</pre>\n</div>`);
  });

  test('textarea inside div gets indentation around it', () => {
    const result = format('<div><textarea>content</textarea></div>');
    expect(result).toBe(`<div>\n  <textarea>content</textarea>\n</div>`);
  });

  test('pre alongside other elements gets formatted correctly', () => {
    const result = format('<div><p>before</p><pre>  preserved  </pre><p>after</p></div>');
    expect(result).toContain('  <p>before</p>');
    expect(result).toContain('  <pre>  preserved  </pre>');
    expect(result).toContain('  <p>after</p>');
  });
});

// ---------------------------------------------------------------------------
// Regression: multi-line conditional comment as only child
// ---------------------------------------------------------------------------

describe('multi-line conditional comment as only child', () => {
  test('formats content inside comment when it is the only child', () => {
    const result = format(`<div>
<!--[if mso]>
<table><tr><td>x</td></tr></table>
<![endif]-->
</div>`);

    // The comment's inner content should be formatted
    expect(result).toContain('<table>');
    expect(result).toContain('<tr>');
    expect(result).toContain('<td>x</td>');
    // Inner content should have proper indentation (not left-aligned)
    const lines = result.split('\n');
    const tableLine = lines.find(l => l.includes('<table>'));
    expect(tableLine).toBeDefined();
    expect(tableLine!.startsWith(' ')).toBe(true);
  });

  test('multi-line conditional comment inner content has consistent indentation', () => {
    const result = format('<!--[if mso]>\n<table><tr><td>x</td></tr></table>\n<![endif]-->');

    // Should produce clean indentation, not ragged
    expect(result).toContain('<table>');
    expect(result).toContain('</table>');
    // The table content should be indented relative to the table
    expect(result).toMatch(/<tr>\s*\n\s+<td>/);
  });

  test('multi-line conditional with nested tables formats cleanly', () => {
    const result = format(`<body>
<!--[if mso]>
<table cellpadding="0" cellspacing="0" border="0" width="600">
<tr>
<td>
<![endif]-->
<div>content</div>
<!--[if mso]>
</td>
</tr>
</table>
<![endif]-->
</body>`);

    expect(result).toContain('<!--[if mso]>');
    expect(result).toContain('<![endif]-->');
    expect(result).toContain('<div>content</div>');
  });

  test('multi-line conditional with closing tags only gets consistent indentation', () => {
    const result = format(`<div>
<!--[if mso]>
</td>
</tr>
</table>
<![endif]-->
</div>`);

    // Each closing tag line should have the same indentation
    const lines = result.split('\n');
    const closingTagLines = lines.filter(l => /^\s*<\/(?:td|tr|table)>/.test(l));
    expect(closingTagLines.length).toBe(3);
    const indents = closingTagLines.map(l => l.match(/^(\s*)/)?.[1] ?? '');
    // All closing tags should have consistent indentation
    expect(new Set(indents).size).toBe(1);
    // And it should be indented (not at column 0)
    expect(indents[0].length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Regression: downlevel-revealed conditional comments
// ---------------------------------------------------------------------------

describe('downlevel-revealed conditional comments', () => {
  test('does not insert whitespace inside single-line revealed conditional', () => {
    const result = format(
      '<!--[if !mso]><!--><div style="display:inline-block">A</div><div style="display:inline-block">B</div><!--<![endif]-->'
    );

    // The inline-block divs should stay adjacent
    expect(result).toContain('</div><div style="display:inline-block">B</div>');
    // No whitespace between the comments and the content
    expect(result).toContain('<!--><div style="display:inline-block">A</div>');
    expect(result).toContain('</div><!--<![endif]-->');
  });

  test('preserves revealed conditional with inline content', () => {
    const result = format('<td><!--[if !mso]><!--><span>web only</span><!--<![endif]--></td>');

    expect(result).toContain('<!--[if !mso]><!-->');
    expect(result).toContain('<!--<![endif]-->');
    expect(result).toContain('<span>web only</span>');
  });

  test('stale ranges: bubble conditional after formatted content stays protected', () => {
    // Repro: formatting compact tables BEFORE a bubble conditional shifts
    // positions.  The bubble conditional content must still be protected.
    const result = format(
      '<div><table><tr><td>cell</td></tr></table></div><!--[if !mso]><!--><p>A</p> <p>B</p><!--<![endif]-->'
    );

    // The space between <p>A</p> and <p>B</p> must survive — it's inside
    // a single-line bubble conditional.
    expect(result).toContain('<p>A</p> <p>B</p>');
  });

  test('two bubble conditionals in same sibling list: gap between them is formatted', () => {
    // Two separate revealed conditionals with a block element between them.
    // The whitespace between the first close and second open should NOT
    // be protected — it's outside both conditionals.
    const result = format(
      '<div><!--[if !mso]><!--><span>A</span><!--<![endif]--><p>middle</p><!--[if !mso]><!--><span>B</span><!--<![endif]--></div>'
    );

    // Content inside each conditional is preserved
    expect(result).toContain('<span>A</span>');
    expect(result).toContain('<span>B</span>');
    // The <p> between them should be on its own line (formatted)
    expect(result).toMatch(/\n\s+<p>middle<\/p>/);
  });

  test('single-line bubble does not protect later multi-line bubble', () => {
    // First conditional is single-line, second is multi-line.
    // The multi-line one's <p> should still be indented.
    const result = format(
      '<div><!--[if !mso]><!--><span>A</span><!--<![endif]--><!--[if !mso]><!-->\n<p>B</p>\n<!--<![endif]--></div>'
    );

    expect(result).toContain('<span>A</span>');
    // The <p>B</p> inside the multi-line conditional should be formatted
    expect(result).toMatch(/\n\s+<p>B<\/p>/);
  });
});

// ---------------------------------------------------------------------------
// Regression: legacy inline elements
// ---------------------------------------------------------------------------

describe('legacy inline elements', () => {
  test('font tags stay adjacent', () => {
    const result = format('<p><font>A</font><font>B</font></p>');
    expect(result).toContain('<font>A</font><font>B</font>');
  });

  test('strike tags stay adjacent', () => {
    const result = format('<p><strike>old</strike><b>new</b></p>');
    expect(result).toContain('<strike>old</strike><b>new</b>');
  });

  test('big and tt tags stay inline', () => {
    const result = format('<p><big>large</big><tt>mono</tt></p>');
    expect(result).toContain('<big>large</big><tt>mono</tt>');
  });

  test('wbr stays inline', () => {
    const result = format('<p>longword<wbr/>here</p>');
    expect(result).toContain('longword<wbr/>here');
  });
});

// ---------------------------------------------------------------------------
// Regression: case-insensitive conditional comments
// ---------------------------------------------------------------------------

describe('case-insensitive conditional comments', () => {
  test('uppercase IF is recognized as multi-line conditional', () => {
    const result = format(`<!--[IF mso]>
<table><tr><td>x</td></tr></table>
<![endif]-->`);

    expect(result).toContain('<table>');
    expect(result).toContain('<tr>');
    expect(result).toContain('<td>x</td>');
  });

  test('mixed case conditional comment gets formatted', () => {
    const result = format(`<div>
<!--[IF MSO]>
<table><tr><td>content</td></tr></table>
<![ENDIF]-->
</div>`);

    expect(result).toContain('<!--[IF MSO]>');
    expect(result).toContain('<![ENDIF]-->');
    expect(result).toContain('<table>');
  });
});

// ---------------------------------------------------------------------------
// Regression: DOCTYPE directive formatting
// ---------------------------------------------------------------------------

describe('DOCTYPE formatting', () => {
  test('html tag goes on its own line after DOCTYPE', () => {
    const result = format('<!DOCTYPE html><html><body><p>hi</p></body></html>');
    const lines = result.split('\n');
    expect(lines[0]).toBe('<!DOCTYPE html>');
    expect(lines[1]).toBe('<html>');
  });

  test('DOCTYPE is preserved exactly', () => {
    const result = format('<!DOCTYPE html><html><body></body></html>');
    expect(result).toContain('<!DOCTYPE html>');
  });
});

// ---------------------------------------------------------------------------
// Regression: NBSP and Unicode spaces
// ---------------------------------------------------------------------------

describe('NBSP preservation', () => {
  test('NBSP between block elements is not treated as formatting whitespace', () => {
    const result = format('<td><p>A</p>\u00A0<p>B</p></td>');
    expect(result).toContain('\u00A0');
  });

  test('NBSP text node is not replaced with indentation', () => {
    const result = format('<div><p>hello</p>\u00A0<p>world</p></div>');
    // The NBSP should survive — it's content, not formatting
    expect(result).toContain('\u00A0');
  });

  test('regular whitespace between blocks is still normalized', () => {
    const result = format('<div><p>hello</p>   \n   <p>world</p></div>');
    // Regular whitespace is formatting — should be normalized
    expect(result).toContain('<p>hello</p>\n');
    expect(result).toContain('<p>world</p>');
  });

  test('NBSP at document boundaries is preserved', () => {
    const result = format('\u00A0<div><p>x</p></div>\u00A0');
    expect(result.startsWith('\u00A0')).toBe(true);
    expect(result.endsWith('\u00A0')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Regression: case-insensitive tag names
// ---------------------------------------------------------------------------

describe('uppercase tag names', () => {
  test('uppercase inline elements stay adjacent', () => {
    const mod = new HtmlMod('<p><SPAN>A</SPAN><SPAN>B</SPAN></p>', { lowerCaseTags: false });
    prettify(mod);
    expect(mod.__source).toContain('<SPAN>A</SPAN><SPAN>B</SPAN>');
  });

  test('uppercase block elements get formatted', () => {
    const mod = new HtmlMod('<DIV><P>hello</P></DIV>', { lowerCaseTags: false });
    prettify(mod);
    expect(mod.__source).toContain('\n');
  });

  test('uppercase pre content is preserved', () => {
    const mod = new HtmlMod('<DIV><PRE>  preserved  </PRE></DIV>', { lowerCaseTags: false });
    prettify(mod);
    expect(mod.__source).toContain('  preserved  ');
  });
});

// ---------------------------------------------------------------------------
// Regression: string vs HtmlMod input detection
// ---------------------------------------------------------------------------

describe('input type detection', () => {
  test('string input returns HtmlMod', () => {
    const result = prettify('<div><p>hello</p></div>');
    expect(result.__source).toBeDefined();
  });

  test('HtmlMod input returns same instance', () => {
    const mod = new HtmlMod('<div><p>hello</p></div>');
    const result = prettify(mod);
    expect(result).toBe(mod);
  });
});
