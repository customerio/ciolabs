import type { SourceElement } from '@ciolabs/htmlparser2-source';
import { describe, test, expect } from 'vitest';

import { HtmlMod, HtmlModElement } from './index';

interface HtmlElementInternal extends HtmlModElement {
  __element: SourceElement;
}

function getInternalElement(element: HtmlModElement): SourceElement {
  return (element as HtmlElementInternal).__element;
}

describe('Targeted AST Update Optimization', () => {
  test('should only update following siblings, not preceding siblings', () => {
    const html = new HtmlMod('<div id="a">A</div><div id="b">B</div><div id="c">C</div>');

    const divB = html.querySelector('#b')!;
    const divA = html.querySelector('#a')!;
    const divC = html.querySelector('#c')!;

    const aStartBefore = getInternalElement(divA).startIndex;
    const aEndBefore = getInternalElement(divA).endIndex;

    divB.setAttribute('class', 'modified');

    expect(getInternalElement(divA).startIndex).toBe(aStartBefore);
    expect(getInternalElement(divA).endIndex).toBe(aEndBefore);
    expect(getInternalElement(divC).startIndex).toBeGreaterThan(getInternalElement(divB).endIndex);

    expect(html.toString()).toContain('<div id="a">A</div>');
    expect(html.toString()).toContain('<div id="b" class="modified">B</div>');
    expect(html.toString()).toContain('<div id="c">C</div>');
  });

  test('should update ancestors endIndex when modifying nested element', () => {
    const html = new HtmlMod('<div id="outer"><div id="middle"><div id="inner">text</div></div></div>');

    const outer = html.querySelector('#outer')!;
    const middle = html.querySelector('#middle')!;
    const inner = html.querySelector('#inner')!;

    const outerEndBefore = getInternalElement(outer).endIndex;
    const middleEndBefore = getInternalElement(middle).endIndex;

    // Modify inner - should update ancestors' endIndex
    inner.setAttribute('class', 'modified');

    // Ancestors' endIndex should increase
    expect(getInternalElement(outer).endIndex).toBeGreaterThan(outerEndBefore);
    expect(getInternalElement(middle).endIndex).toBeGreaterThan(middleEndBefore);

    // Verify structure is correct
    expect(html.querySelector('#outer #middle #inner.modified')).toBeTruthy();
  });

  test('should update following siblings at multiple levels', () => {
    const html = new HtmlMod(`
      <div id="branch1">
        <p id="p1">Text1</p>
        <p id="p2">Text2</p>
      </div>
      <div id="branch2">
        <p id="p3">Text3</p>
      </div>
    `);

    const p1 = html.querySelector('#p1')!;
    const p2 = html.querySelector('#p2')!;
    const branch2 = html.querySelector('#branch2')!;

    const p2StartBefore = getInternalElement(p2).startIndex;
    const branch2StartBefore = getInternalElement(branch2).startIndex;

    // Modify p1 - should update p2 (sibling) and branch2 (parent's sibling)
    p1.setAttribute('class', 'modified');

    // Following sibling in same parent should be updated
    expect(getInternalElement(p2).startIndex).toBeGreaterThan(p2StartBefore);

    // Following sibling at parent level should be updated
    expect(getInternalElement(branch2).startIndex).toBeGreaterThan(branch2StartBefore);

    // Verify query still works
    expect(html.querySelector('#branch2 #p3')).toBeTruthy();
  });

  test('should handle deep nesting (10+ levels)', () => {
    let htmlString = '<div id="d0">';
    for (let index = 1; index <= 10; index++) {
      htmlString += `<div id="d${index}">`;
    }
    htmlString += 'deep content';
    for (let index = 10; index >= 0; index--) {
      htmlString += '</div>';
    }

    const html = new HtmlMod(htmlString);
    const deepest = html.querySelector('#d10')!;

    // Modify the deepest element
    deepest.setAttribute('class', 'deepest');

    // All ancestors should still be queryable
    for (let index = 0; index <= 9; index++) {
      expect(html.querySelector(`#d${index}`)).toBeTruthy();
    }

    // Verify the modification worked
    expect(html.querySelector('#d10.deepest')).toBeTruthy();
    expect(deepest.innerHTML).toBe('deep content');
  });

  test('should handle wide tree (many siblings)', () => {
    let htmlString = '';
    for (let index = 0; index < 50; index++) {
      htmlString += `<div id="d${index}">Content ${index}</div>`;
    }

    const html = new HtmlMod(htmlString);

    // Modify element in the middle
    const d25 = html.querySelector('#d25')!;
    d25.setAttribute('class', 'modified');

    // All elements should still be queryable
    for (let index = 0; index < 50; index++) {
      expect(html.querySelector(`#d${index}`)).toBeTruthy();
    }

    // Verify the modification
    expect(html.querySelector('#d25.modified')).toBeTruthy();
  });

  test('should fall back to full update when element is removed from tree', () => {
    const html = new HtmlMod('<div id="parent"><div id="child">text</div></div><div id="sibling">other</div>');

    const child = html.querySelector('#child')!;

    // Remove child
    child.remove();

    // Element is now detached (parent is null)
    // Any operation on it should fall back to full tree update
    // This shouldn't crash and sibling should still be queryable
    expect(html.querySelector('#sibling')).toBeTruthy();
    expect(html.querySelector('#child')).toBeNull();

    // Verify output
    expect(html.toString()).toContain('<div id="parent"></div>');
    expect(html.toString()).toContain('<div id="sibling">other</div>');
  });

  test('should correctly update when moving elements between parents', () => {
    const html = new HtmlMod('<div id="source"><p>moveme</p></div><div id="target"></div>');

    const p = html.querySelector('p')!;
    const target = html.querySelector('#target')!;
    const pHTML = p.outerHTML;

    // Move element
    p.remove();
    target.innerHTML = pHTML;

    // Verify the move worked
    expect(html.querySelector('#source p')).toBeNull();
    expect(html.querySelector('#target p')).toBeTruthy();
    expect(html.querySelector('#target p')!.innerHTML).toBe('moveme');
  });

  test('should handle multiple modifications to different branches', () => {
    const html = new HtmlMod(`
      <div id="branch1"><p id="p1">Text1</p></div>
      <div id="branch2"><p id="p2">Text2</p></div>
      <div id="branch3"><p id="p3">Text3</p></div>
    `);

    // Modify different branches
    html.querySelector('#p1')!.setAttribute('class', 'c1');
    html.querySelector('#p2')!.setAttribute('class', 'c2');
    html.querySelector('#p3')!.setAttribute('class', 'c3');

    // All modifications should work
    expect(html.querySelector('#p1.c1')).toBeTruthy();
    expect(html.querySelector('#p2.c2')).toBeTruthy();
    expect(html.querySelector('#p3.c3')).toBeTruthy();
  });

  test('should correctly update positions for innerHTML replacement', () => {
    const html = new HtmlMod('<div id="container"><p>old</p></div><div id="after">after</div>');

    const container = html.querySelector('#container')!;
    const after = html.querySelector('#after')!;
    const afterStartBefore = getInternalElement(after).startIndex;

    // Replace innerHTML
    container.innerHTML = '<span>new</span><span>content</span>';

    // Following sibling should be updated
    expect(getInternalElement(after).startIndex).not.toBe(afterStartBefore);

    // New content should be queryable
    expect(html.querySelectorAll('#container span')).toHaveLength(2);
    expect(html.querySelector('#after')).toBeTruthy();
  });

  test('should handle modification of first child', () => {
    const html = new HtmlMod('<div><p id="first">1</p><p id="second">2</p><p id="third">3</p></div>');

    const first = html.querySelector('#first')!;
    const second = html.querySelector('#second')!;
    const third = html.querySelector('#third')!;

    const secondStartBefore = getInternalElement(second).startIndex;
    const thirdStartBefore = getInternalElement(third).startIndex;

    // Modify first child
    first.setAttribute('class', 'modified');

    // Following siblings should be updated
    expect(getInternalElement(second).startIndex).toBeGreaterThan(secondStartBefore);
    expect(getInternalElement(third).startIndex).toBeGreaterThan(thirdStartBefore);

    // All should be queryable
    expect(html.querySelector('#first.modified')).toBeTruthy();
    expect(html.querySelector('#second')).toBeTruthy();
    expect(html.querySelector('#third')).toBeTruthy();
  });

  test('should handle modification of last child', () => {
    const html = new HtmlMod('<div><p id="first">1</p><p id="second">2</p><p id="last">3</p></div>');

    const first = html.querySelector('#first')!;
    const second = html.querySelector('#second')!;
    const last = html.querySelector('#last')!;

    const firstStartBefore = getInternalElement(first).startIndex;
    const secondStartBefore = getInternalElement(second).startIndex;

    // Modify last child
    last.setAttribute('class', 'modified');

    // Preceding siblings should NOT be updated
    expect(getInternalElement(first).startIndex).toBe(firstStartBefore);
    expect(getInternalElement(second).startIndex).toBe(secondStartBefore);

    // Last child should be queryable
    expect(html.querySelector('#last.modified')).toBeTruthy();
  });

  test('should correctly update with text node modifications', () => {
    const html = new HtmlMod('<div id="a">text</div><div id="b">more</div>');

    const divA = html.querySelector('#a')!;
    const divB = html.querySelector('#b')!;
    const bStartBefore = getInternalElement(divB).startIndex;

    // Modify text content
    divA.innerHTML = 'much longer text content';

    // Following sibling should be updated
    expect(getInternalElement(divB).startIndex).toBeGreaterThan(bStartBefore);

    // Verify content
    expect(divA.innerHTML).toBe('much longer text content');
    expect(divB.innerHTML).toBe('more');
  });

  test('should handle complex real-world scenario', () => {
    const html = new HtmlMod(`
      <header>
        <nav><a href="/">Home</a></nav>
      </header>
      <main>
        <article id="post">
          <h1>Title</h1>
          <p id="content">Content</p>
        </article>
        <aside id="sidebar">Sidebar</aside>
      </main>
      <footer>Footer</footer>
    `);

    // Modify content in the middle
    const content = html.querySelector('#content')!;
    content.setAttribute('class', 'highlight');

    // All structure should still be queryable
    expect(html.querySelector('header nav a')).toBeTruthy();
    expect(html.querySelector('main article h1')).toBeTruthy();
    expect(html.querySelector('#content.highlight')).toBeTruthy();
    expect(html.querySelector('#sidebar')).toBeTruthy();
    expect(html.querySelector('footer')).toBeTruthy();

    // Modify multiple elements
    html.querySelector('nav')!.setAttribute('id', 'main-nav');
    html.querySelector('h1')!.innerHTML = 'New Title';
    html.querySelector('footer')!.setAttribute('class', 'main-footer');

    // Everything should still work
    expect(html.querySelector('#main-nav a')).toBeTruthy();
    expect(html.querySelector('h1')!.innerHTML).toBe('New Title');
    expect(html.querySelector('footer.main-footer')).toBeTruthy();
  });
});
