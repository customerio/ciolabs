import { describe, test, expect } from 'vitest';

import findConditionalComments from './index';

describe('findConditionalComments', () => {
  test('find conditional comments', () => {
    const comments = findConditionalComments(`
    Basic  
    <!--[if mso]><![endif]-->

    Basic multi-line
    <!--[if MAC]>
      Multi-line
    <![endif]-->

    Great than
    <!--[if gt mso 14]> Everything above Outlook 2010 <![endif]-->
    
    Less than
    <!--[if lt mso 14]> Everything below Outlook 2010 <![endif]-->
    
    Greater than or equal
    <!--[if gte mso 14]> Outlook 2010 and above <![endif]-->
    
    Less than or equal
    <!--[if lte mso 14]> Outlook 2010 and below <![endif]-->
    
    Or statement
    <!--[if (mso 12)|(mso 16)]> Outlook 2007 / 2016 only <![endif]-->
    
    And statement
    <!--[if (mso 12)&(mso 16)]> Outlook 2007 / 2016 only <![endif]-->
    
    Not statement
    <!--[if !mso]><!--> All Outlooks will ignore this <!--<![endif]-->

    Alt-syntax
    <![if mso]><![endif]>


    Not these folks. They look like they could match but don't 
    really work for some reasons.

    <!-- regular HTML comment -->
    <!--[if ]><!--> No condition <!--<![endif]-->
    <!--[if mso]
    >
      The condition is broken with a new line
    <![endif]-->
  `);

    expect(comments).toHaveLength(10);

    // Test basic MSO comment
    expect(comments[0]).toEqual({
      bubble: false,
      close: '<![endif]-->',
      downlevel: 'hidden',
      isComment: true,
      open: '<!--[if mso]>',
      range: [17, 42],
    });

    // Test MAC comment
    expect(comments[1]).toEqual({
      bubble: false,
      close: '<![endif]-->',
      downlevel: 'hidden',
      isComment: true,
      open: '<!--[if MAC]>',
      range: [69, 116],
    });

    // Test bubble comment (downlevel-revealed)
    expect(comments[8]).toEqual({
      bubble: true,
      close: '<!--<![endif]-->',
      downlevel: 'revealed',
      isComment: true,
      open: '<!--[if !mso]><!-->',
      range: [679, 745],
    });

    // Test alt-syntax (non-comment)
    expect(comments[9]).toEqual({
      bubble: false,
      close: '<![endif]>',
      downlevel: 'revealed',
      isComment: false,
      open: '<![if mso]>',
      range: [766, 787],
    });
  });

  test('correctly marks comments as downlevel-revealed or downlevel-hidden', () => {
    expect(
      findConditionalComments(`
      <!--[if true]>downlevel-hidden<![endif]-->
    `)[0].downlevel
    ).toEqual('hidden');

    expect(
      findConditionalComments(`
      <![if !mso]>downlevel-revealed<![endif]>
    `)[0].downlevel
    ).toEqual('revealed');

    expect(
      findConditionalComments(`
      <!--[if !mso]><!-->downlevel-revealed<!--<![endif]-->
    `)[0].downlevel
    ).toEqual('revealed');
  });

  test('supports nested conditional comments', () => {
    const html = `
    <!--[if mso]>
      Outer start
      <!--[if gte mso 15]>Inner<![endif]-->
      Outer end
    <![endif]-->
  `;

    const result = findConditionalComments(html);

    expect(result.length).toBe(2);

    // Identify outer and inner by range size
    const sorted = [...result].sort((a, b) => a.range[1] - a.range[0] - (b.range[1] - b.range[0]));
    const inner = sorted[0];
    const outer = sorted[1];

    expect(inner.open.startsWith('<!--[if gte mso 15]>')).toBe(true);
    expect(inner.close).toMatch(/<!\[endif]-->/);
    expect(inner.isComment).toBe(true);
    expect(inner.downlevel).toBe('hidden');

    expect(outer.open.startsWith('<!--[if mso]>')).toBe(true);
    expect(outer.close).toMatch(/<!\[endif]-->/);
    expect(outer.isComment).toBe(true);
    expect(outer.downlevel).toBe('hidden');

    // Inner range should be fully inside outer range
    expect(inner.range[0]).toBeGreaterThan(outer.range[0]);
    expect(inner.range[1]).toBeLessThan(outer.range[1]);
  });

  test('rejects mismatched closing dashes for HTML-comment style open', () => {
    const html = `
    <!--[if mso]>Bad<![endif]>
  `;
    const result = findConditionalComments(html);
    expect(result.length).toBe(0);
  });

  test('rejects mismatched closing dashes for downlevel-revealed open (non-comment)', () => {
    const html = `
    <![if mso]>Bad<![endif]-->
  `;
    const result = findConditionalComments(html);
    expect(result.length).toBe(0);
  });

  test('handles new MSO comment format with spaces', () => {
    // New format with space after <! and before -->
    const html = `<div>
    <!--[if !mso]><! -->some content<!-- <![endif]-->
</div>`;
    const result = findConditionalComments(html);
    expect(result.length).toBe(1);
    expect(result[0]).toEqual({
      bubble: true,
      close: '<!-- <![endif]-->',
      downlevel: 'revealed',
      isComment: true,
      open: '<!--[if !mso]><! -->',
      range: [10, 59],
    });
  });

  test('handles MSO comment format without spaces', () => {
    // format without space
    const html = `<div>
    <!--[if !mso]><!-->some content<!--<![endif]-->
</div>`;
    const result = findConditionalComments(html);
    expect(result.length).toBe(1);
    expect(result[0]).toEqual({
      bubble: true,
      close: '<!--<![endif]-->',
      downlevel: 'revealed',
      isComment: true,
      open: '<!--[if !mso]><!-->',
      range: [10, 57],
    });
  });
});
