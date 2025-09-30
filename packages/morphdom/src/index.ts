import morphdomBase from 'morphdom';

import morphAttributes from './morph-attributes';
import { MorphOptions, MorphdomOptions } from './types';

export * from './types';

export { default as morphAttributes } from './morph-attributes';

export function morphdom(target: Node, source: Node | string, options?: MorphdomOptions) {
  return morphdomBase(target, source, {
    getNodeKey: options?.getNodeKey,
    filterNode: options?.filterNode,
    onBeforeNodeAdded: options?.onBeforeNodeAdded,
    addChild: options?.addChild,
    onNodeAdded: options?.onNodeAdded,
    onBeforeElUpdated: options?.onBeforeElementUpdated,
    updateEl: options?.updateElement,
    onElUpdated: options?.onElementUpdated,
    onBeforeNodeDiscarded: options?.onBeforeNodeDiscarded,
    discardChild: options?.discardChild,
    onNodeDiscarded: options?.onNodeDiscarded,
    onBeforeElChildrenUpdated: options?.onBeforeElementChildrenUpdated,
    childrenOnly: options?.childrenOnly,
  });
}

export function morph(target: Node, source: Node | string, options?: MorphOptions) {
  return morphdom(target, source, {
    filterNode(node) {
      // while the isEqualNode function will account for
      // different lengths of whitespace nodes, if a whitespace
      // node exists in the source but not in the target,
      // it will be considered as a node that needs to be added/removed
      //
      // to avoid this, we filter out whitespace nodes
      return !isWhitespace(node);
    },
    onBeforeElementUpdated(fromElement, toElement) {
      if (isEqualNode(fromElement, toElement, options)) {
        return false;
      }

      return true;
    },
    updateElement(fromElement, toElement) {
      morphAttributes(fromElement, toElement, options || {});
    },
  });
}

function isWhitespace(node: Node) {
  return node.nodeType === Node.TEXT_NODE && !node.textContent?.trim();
}

/**
 * Checks if the two nodes are equal
 *
 * Special rules:
 * - Whitespace nodes are considered equal, regardless of their length
 * - elements are considered equal if they match everything except for the ignored attributes
 *   and ignored classes
 */
function isEqualNode(fromNode: Node, toNode: Node, options: MorphOptions = {}) {
  if (fromNode.isEqualNode(toNode)) {
    return true;
  }

  if (isWhitespace(fromNode) && isWhitespace(toNode)) {
    return true;
  }

  // if we are not comparing elements, then respect the native isEqualNode of the browser
  if (fromNode.nodeType !== Node.ELEMENT_NODE || toNode.nodeType !== Node.ELEMENT_NODE) {
    return false;
  }

  /// if we are not given any options, then respect the native isEqualNode of the browser
  // now we check for the attributes and classes
  // we always ignore the class attribute since we are handling it separately
  const ignoredAttributes = new Set([...(options.ignoredAttributes || []), 'class']);
  const ignoredClasses = new Set(options.ignoredClasses || []);

  // now that we are comparing elements, we first need to check for general equality
  // we check if the namespace, namespace prefix, local name all match

  const fromElement = fromNode as Element;
  const toElement = toNode as Element;

  if (
    fromElement.namespaceURI !== toElement.namespaceURI ||
    fromElement.prefix !== toElement.prefix ||
    fromElement.localName !== toElement.localName
  ) {
    return false;
  }

  const fromAttributes = [...fromElement.attributes].filter(attribute => !ignoredAttributes.has(attribute.name));

  const toAttributes = [...toElement.attributes].filter(attribute => !ignoredAttributes.has(attribute.name));

  if (fromAttributes.length !== toAttributes.length) {
    return false;
  }

  for (const fromAttribute of fromAttributes) {
    const toAttribute = toElement.getAttributeNode(fromAttribute.name);
    if (!toAttribute || fromAttribute.value !== toAttribute.value) {
      return false;
    }
  }

  const fromClasses = [...fromElement.classList].filter(className => !ignoredClasses.has(className));

  const toClasses = [...toElement.classList].filter(className => !ignoredClasses.has(className));

  if (fromClasses.length !== toClasses.length) {
    return false;
  }

  for (const fromClass of fromClasses) {
    if (!toClasses.includes(fromClass)) {
      return false;
    }
  }

  const fromChildren = fromElement.childNodes;
  const toChildren = toElement.childNodes;

  if (fromChildren.length !== toChildren.length) {
    return false;
  }

  for (const [index, fromChild] of fromChildren.entries()) {
    if (!isEqualNode(fromChild, toChildren[index], options)) {
      return false;
    }
  }

  return true;
}

export const equality = {
  isWhitespace,
  isEqualNode,
};
