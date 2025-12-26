/**
 * AST Manipulation Engine
 *
 * This module provides functions to directly manipulate the AST structure
 * without reparsing, keeping the AST in sync with string modifications.
 */
import { parseDocument, SourceElement, SourceChildNode, SourceText, isTag, Options } from '@ciolabs/htmlparser2-source';

/**
 * Internal types for AST manipulation that expose mutable properties
 * These properties exist at runtime but aren't in the public types
 */
type MutableNode = {
  parent?: SourceElement;
  children?: SourceChildNode[];
};

type MutableElement = SourceElement & MutableNode;
type MutableChildNode = SourceChildNode & MutableNode;

/**
 * Parse HTML string and create AST nodes positioned at a specific offset
 */
export function parseHtmlAtPosition(html: string, startPosition: number, options?: Options): SourceChildNode[] {
  // Parse the HTML string
  const doc = parseDocument(html, options);

  // Adjust all positions by the start offset
  adjustNodePositions(doc.children, startPosition);

  return doc.children;
}

/**
 * Recursively adjust all positions in nodes by an offset
 */
function adjustNodePositions(nodes: SourceChildNode[], offset: number): void {
  for (const node of nodes) {
    if ('startIndex' in node && typeof node.startIndex === 'number') {
      node.startIndex += offset;
    }
    if ('endIndex' in node && typeof node.endIndex === 'number') {
      node.endIndex += offset;
    }

    if (isTag(node)) {
      // Adjust element-specific positions
      if (node.source?.openTag) {
        node.source.openTag.startIndex += offset;
        node.source.openTag.endIndex += offset;
      }

      if (node.source?.closeTag) {
        node.source.closeTag.startIndex += offset;
        node.source.closeTag.endIndex += offset;
      }

      // Adjust attribute positions
      if (node.source?.attributes) {
        for (const attribute of node.source.attributes) {
          if (attribute.name) {
            attribute.name.startIndex += offset;
            attribute.name.endIndex += offset;
          }
          if (attribute.value) {
            attribute.value.startIndex += offset;
            attribute.value.endIndex += offset;
          }
          if (attribute.source) {
            attribute.source.startIndex += offset;
            attribute.source.endIndex += offset;
          }
        }
      }

      // Recursively adjust children
      if (node.children) {
        adjustNodePositions(node.children, offset);
      }
    }
  }
}

/**
 * Replace all children of an element with new nodes
 */
export function replaceChildren(element: SourceElement, newChildren: SourceChildNode[]): void {
  const mutableElement = element as MutableElement;

  // Update parent references
  for (const child of newChildren) {
    (child as MutableChildNode).parent = element;
  }

  // Replace children array
  mutableElement.children = newChildren;
}

/**
 * Append children to an element
 */
export function appendChild(element: SourceElement, newChildren: SourceChildNode[]): void {
  const mutableElement = element as MutableElement;

  // Update parent references
  for (const child of newChildren) {
    (child as MutableChildNode).parent = element;
  }

  // Append to children array
  if (!mutableElement.children) {
    mutableElement.children = [];
  }
  mutableElement.children.push(...newChildren);
}

/**
 * Prepend children to an element
 */
export function prependChild(element: SourceElement, newChildren: SourceChildNode[]): void {
  const mutableElement = element as MutableElement;

  // Update parent references
  for (const child of newChildren) {
    (child as MutableChildNode).parent = element;
  }

  // Prepend to children array
  if (!mutableElement.children) {
    mutableElement.children = [];
  }
  mutableElement.children.unshift(...newChildren);
}

/**
 * Insert children before a specific node in its parent
 */
export function insertBefore(referenceNode: SourceChildNode, newChildren: SourceChildNode[]): void {
  const parent = (referenceNode as MutableChildNode).parent as MutableElement | undefined;
  if (!parent || !parent.children) {
    throw new Error('Cannot insert before node without parent');
  }

  const index = parent.children.indexOf(referenceNode);
  if (index === -1) {
    throw new Error('Reference node not found in parent children');
  }

  // Update parent references
  for (const child of newChildren) {
    (child as MutableChildNode).parent = parent;
  }

  // Insert at index
  parent.children.splice(index, 0, ...newChildren);
}

/**
 * Insert children after a specific node in its parent
 */
export function insertAfter(referenceNode: SourceChildNode, newChildren: SourceChildNode[]): void {
  const parent = (referenceNode as MutableChildNode).parent as MutableElement | undefined;
  if (!parent || !parent.children) {
    throw new Error('Cannot insert after node without parent');
  }

  const index = parent.children.indexOf(referenceNode);
  if (index === -1) {
    throw new Error('Reference node not found in parent children');
  }

  // Update parent references
  for (const child of newChildren) {
    (child as MutableChildNode).parent = parent;
  }

  // Insert after index
  parent.children.splice(index + 1, 0, ...newChildren);
}

/**
 * Remove a node from its parent
 */
export function removeNode(node: SourceChildNode): void {
  const parent = (node as MutableChildNode).parent as MutableElement | undefined;
  if (!parent || !parent.children) {
    return;
  }

  const index = parent.children.indexOf(node);
  if (index !== -1) {
    parent.children.splice(index, 1);
  }
}

/**
 * Replace a node with new children in its parent
 */
export function replaceNode(oldNode: SourceChildNode, newChildren: SourceChildNode[]): void {
  const parent = (oldNode as MutableChildNode).parent as MutableElement | undefined;
  if (!parent || !parent.children) {
    throw new Error('Cannot replace node without parent');
  }

  const index = parent.children.indexOf(oldNode);
  if (index === -1) {
    throw new Error('Node not found in parent children');
  }

  // Update parent references
  for (const child of newChildren) {
    (child as MutableChildNode).parent = parent;
  }

  // Replace at index
  parent.children.splice(index, 1, ...newChildren);
}

/**
 * Update or add an attribute to an element
 */
export function setAttribute(
  element: SourceElement,
  name: string,
  value: string,
  quote: '"' | "'" | null,
  nameStart: number,
  valueStart: number,
  sourceStart: number,
  sourceEnd: number
): void {
  if (!element.source) {
    element.source = {
      openTag: {
        startIndex: element.startIndex,
        endIndex: element.startIndex,
        data: `<${element.tagName}>`,
        name: element.tagName,
        isSelfClosing: false,
      },
      closeTag: null,
      attributes: [],
    };
  }

  if (!element.source.attributes) {
    element.source.attributes = [];
  }

  // Find existing attribute
  const existingIndex = element.source.attributes.findIndex(a => a.name.data === name);

  const quoteChar = quote === '"' ? '"' : quote === "'" ? "'" : '';
  const attribute = {
    name: {
      data: name,
      startIndex: nameStart,
      endIndex: nameStart + name.length - 1,
    },
    value: {
      data: value,
      startIndex: valueStart,
      endIndex: valueStart + value.length - 1,
    },
    source: {
      startIndex: sourceStart,
      endIndex: sourceEnd,
      data: `${name}=${quoteChar}${value}${quoteChar}`,
    },
    quote,
  };

  if (existingIndex === -1) {
    // Add new
    element.source.attributes.push(attribute);
  } else {
    // Replace existing
    element.source.attributes[existingIndex] = attribute;
  }

  // Also update the attribs object
  if (!element.attribs) {
    element.attribs = {};
  }
  element.attribs[name] = value;
}

/**
 * Remove an attribute from an element
 */
export function removeAttribute(element: SourceElement, name: string): void {
  if (!element.source?.attributes) {
    return;
  }

  // Remove from attributes array
  element.source.attributes = element.source.attributes.filter(a => a.name.data !== name);

  // Remove from attribs object
  if (element.attribs) {
    delete element.attribs[name];
  }
}

/**
 * Update element tag name
 */
export function setTagName(element: SourceElement, tagName: string): void {
  element.tagName = tagName;
  element.name = tagName;

  // Keep source data in sync
  if (element.source) {
    element.source.openTag.name = tagName;
    element.source.openTag.data = element.source.openTag.isSelfClosing ? `<${tagName}/>` : `<${tagName}>`;

    if (element.source.closeTag) {
      element.source.closeTag.name = tagName;
      element.source.closeTag.data = `</${tagName}>`;
    }
  }
}

/**
 * Update text node data
 */
export function setTextData(text: SourceText, data: string): void {
  text.data = data;
}

/**
 * Convert self-closing tag to regular tag with closeTag
 */
export function convertToRegularTag(
  element: SourceElement,
  openTagEnd: number,
  closeTagStart: number,
  closeTagEnd: number
): void {
  // Update the openTag to not be self-closing
  if (element.source) {
    element.source.openTag.isSelfClosing = false;
    element.source.openTag.endIndex = openTagEnd; // Update '>' position

    // Add closeTag information
    element.source.closeTag = {
      startIndex: closeTagStart,
      endIndex: closeTagEnd,
      data: `</${element.tagName}>`,
      name: element.tagName,
    };
  }
}
