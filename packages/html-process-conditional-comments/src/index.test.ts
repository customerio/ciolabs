import { describe, expect, it } from 'vitest';

import { getEmbeddedDocument, postprocess, preprocess } from './index';

describe('preprocess', () => {
  it('should do nothing if there are no conditional comments', () => {
    const source = `
    <!DOCTYPE html>
    <html>
        <head>
            <title>Test</title>
        </head>
        <body>
            <p>Hello World</p>
        </body>
    </html>`;

    expect(preprocess(source)).toBe(source);
  });

  it('should do nothing to bubble conditional comments', () => {
    const source = `
    <body>
        <!--[if !mso]><!-->
        <p>Hello World</p>
        <!--<![endif]-->
    </body>`;
    expect(preprocess(source)).toBe(source);
  });

  it('should do nothing to the weird alternate syntax', () => {
    const source = `
    <body>
    <![if !mso]> HTML <![endif]>
    </body>`;

    expect(preprocess(source)).toBe(source);
  });

  it('should unwrap the html in conditional comments', () => {
    const source = `
    <body>
        <!--[if mso]>HTML<![endif]-->
    </body>`;

    expect(preprocess(source)).toBe(`
    <body>
        <!--[if mso]>__PROCESS_CONDITIONAL_COMMENTS-->HTML<!--__PROCESS_CONDITIONAL_COMMENTS<![endif]-->
    </body>`);
  });
});

describe('postprocess', () => {
  it('should do nothing if there are no conditional comments', () => {
    const source = `
        <!DOCTYPE html>
        <html>
            <head>
                <title>Test</title>
            </head>
            <body>
                <p>Hello World</p>
            </body>
        </html>`;

    expect(postprocess(source)).toBe(source);
  });

  it('should do nothing to bubble conditional comments', () => {
    const source = `
        <body>
            <!--[if !mso]><!-->
            <p>Hello World</p>
            <!--<![endif]-->
        </body>`;
    expect(postprocess(source)).toBe(source);
  });

  it('should undo the modifications done in preprocess', () => {
    const source = `
    <body>
        <!--[if mso]>HTML<![endif]-->
    </body>`;

    expect(preprocess(source)).not.toBe(source);
    expect(postprocess(preprocess(source))).toBe(source);
  });
});

describe('new MSO comment format with spaces', () => {
  it('should handle new format in getEmbeddedDocument', () => {
    const source = `<div>
    <!--[if !mso]><! -->some content<!-- <![endif]-->
</div>`;

    // The closing comment marker `<!-- <![endif]-->` (17 chars) is replaced with 17 spaces
    expect(getEmbeddedDocument(source)).toBe(
      `<div>
                        some content` +
        ' '.repeat(17) +
        `
</div>`
    );
  });

  it('should handle old format in getEmbeddedDocument', () => {
    const source = `<div>
    <!--[if !mso]><!-->some content<!--<![endif]-->
</div>`;

    // The closing comment marker `<!--<![endif]-->` (16 chars) is replaced with 16 spaces
    expect(getEmbeddedDocument(source)).toBe(
      `<div>
                       some content` +
        ' '.repeat(16) +
        `
</div>`
    );
  });
});

describe('getEmbeddedDocument', () => {
  it('should do nothing if there are no conditional comments', () => {
    const source = `
        <!DOCTYPE html>
        <html>
            <head>
                <title>Test</title>
            </head>
            <body>
                <p>Hello World</p>
            </body>
        </html>`;

    expect(getEmbeddedDocument(source)).toBe(source);
  });

  it('should do nothing to the weird alternate syntax', () => {
    const source = `
    <body>
    <![if !mso]> HTML <![endif]>
    </body>`;

    expect(getEmbeddedDocument(source)).toBe(source);
  });

  it('should replace bubble comments', () => {
    const source = `
        <body>
            <!--[if !mso]><!-->
            <p>Hello World</p>
            <!--<![endif]-->
        </body>`;
    expect(getEmbeddedDocument(source)).toBe(`
        <body>
                               
            <p>Hello World</p>
                            
        </body>`);
  });

  it('should extract the html in conditional comments', () => {
    const source = `
    <body>
        <!--[if mso]>HTML<![endif]-->
    </body>`;

    expect(getEmbeddedDocument(source)).toEqual(`
    <body>
                     HTML            
    </body>`);
  });
});
