import { MorphOptions } from './types';

// modified from https://github.com/patrick-steele-idem/morphdom/blob/master/src/morphAttrs.js
export default function morphAttributes(
  fromNode: HTMLElement,
  toNode: HTMLElement,
  { ignoredAttributes = [], ignoredClasses = [] }: MorphOptions
) {
  const toNodeAttributes = toNode.attributes;
  let attribute: NamedNodeMap[0];
  let attributeName: string;
  let attributeNamespaceURI: string | null;
  let attributeValue: string;
  let fromValue: string | null;

  // document-fragments dont have attributes so lets not do anything
  if (toNode.nodeType === Node.DOCUMENT_FRAGMENT_NODE || fromNode.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
    return;
  }

  // update attributes on original DOM element
  for (let index = toNodeAttributes.length - 1; index >= 0; index--) {
    attribute = toNodeAttributes[index];
    attributeName = attribute.name;
    attributeNamespaceURI = attribute.namespaceURI;
    attributeValue = attribute.value;

    if (ignoredAttributes && ignoredAttributes.includes(attributeName)) {
      continue;
    }

    if (attributeNamespaceURI) {
      attributeName = attribute.localName || attributeName;
      fromValue = fromNode.getAttributeNS(attributeNamespaceURI, attributeName);

      if (fromValue !== attributeValue) {
        if (attribute.prefix === 'xmlns') {
          attributeName = attribute.name; // It's not allowed to set an attribute with the XMLNS namespace without specifying the `xmlns` prefix
        }
        fromNode.setAttributeNS(attributeNamespaceURI, attributeName, attributeValue);
      }
    } else {
      fromValue = fromNode.getAttribute(attributeName);

      if (attributeName === 'class' && fromValue != null) {
        const toNodeClasses = attributeValue.split(' ');
        const fromNodeClasses = fromValue.split(' ');

        for (const toNodeClass of toNodeClasses) {
          if (!fromNodeClasses.includes(toNodeClass)) {
            fromNodeClasses.push(toNodeClass);
          }
        }

        for (let index = 0; index < fromNodeClasses.length; index++) {
          const fromNodeClass = fromNodeClasses[index];

          if (ignoredClasses && ignoredClasses.includes(fromNodeClass)) {
            continue;
          }

          if (!toNodeClasses.includes(fromNodeClass)) {
            fromNodeClasses.splice(index, 1);
            index--;
          }
        }

        fromNode.setAttribute('class', fromNodeClasses.join(' '));

        continue;
      }

      if (fromValue !== attributeValue) {
        fromNode.setAttribute(attributeName, attributeValue);
      }
    }
  }

  // Remove any extra attributes found on the original DOM element that
  // weren't found on the target element.
  const fromNodeAttributes = fromNode.attributes;

  for (let d = fromNodeAttributes.length - 1; d >= 0; d--) {
    attribute = fromNodeAttributes[d];
    attributeName = attribute.name;
    attributeNamespaceURI = attribute.namespaceURI;

    if (ignoredAttributes && ignoredAttributes.includes(attributeName)) {
      continue;
    }

    if (attributeNamespaceURI) {
      attributeName = attribute.localName || attributeName;

      if (!toNode.hasAttributeNS(attributeNamespaceURI, attributeName)) {
        fromNode.removeAttributeNS(attributeNamespaceURI, attributeName);
      }
    } else {
      // if we are removing a class attribute and it includes ignored classes, we should not remove it
      if (
        attributeName === 'class' &&
        attribute.value.split(' ').some(className => ignoredClasses.includes(className))
      ) {
        continue;
      }

      if (!toNode.hasAttribute(attributeName)) {
        fromNode.removeAttribute(attributeName);
      }
    }
  }
}
