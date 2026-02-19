/**
 * AST Position Update Engine
 *
 * This module updates AST node positions after MagicString operations,
 * keeping the AST synchronized with the string state without reparsing.
 */
import { SourceDocument, SourceElement, SourceChildNode, SourceText, isTag, isText } from '@ciolabs/htmlparser2-source';

import { PositionDelta, applyDeltaToPosition } from './position-delta';

/**
 * Type guard to check if a node has position tracking
 */
interface NodeWithPositions {
  startIndex: number;
  endIndex: number;
}

function hasPositions(node: SourceChildNode): node is SourceChildNode & NodeWithPositions {
  return (
    'startIndex' in node &&
    'endIndex' in node &&
    typeof node.startIndex === 'number' &&
    typeof node.endIndex === 'number'
  );
}

export class AstUpdater {
  /**
   * Update positions starting from a specific element (targeted update)
   * This is more efficient when we know which element was modified
   */
  updateFromElement(element: SourceElement, rootNode: SourceDocument, delta: PositionDelta): void {
    if (delta.delta === 0) {
      return;
    }

    if (!element.parent) {
      this.updateNodePositions(rootNode, delta);
      return;
    }

    this.updateElementNode(element, delta);
    this.updateAncestors(element, rootNode, delta);
    this.updateFollowingSiblings(element, rootNode, delta);
  }

  private updateFollowingSiblings(element: SourceElement, rootNode: SourceDocument, delta: PositionDelta): void {
    let parent = element.parent as SourceElement | SourceDocument | null;
    let child: SourceChildNode = element;

    while (parent) {
      const siblings = isTag(parent) ? parent.children : parent === rootNode ? rootNode.children : [];
      const childIndex = siblings.indexOf(child);

      for (let index = childIndex + 1; index < siblings.length; index++) {
        this.updateNode(siblings[index], delta);
      }

      if (parent === rootNode) break;
      child = parent as SourceChildNode;
      parent = isTag(parent) ? (parent.parent as SourceElement | SourceDocument | null) : null;
    }
  }

  updateNodePositions(rootNode: SourceDocument, delta: PositionDelta): void {
    if (delta.delta === 0) {
      return;
    }

    for (const child of rootNode.children) {
      this.updateNode(child, delta);
    }
  }

  private updateAncestors(element: SourceElement, rootNode: SourceDocument, delta: PositionDelta): void {
    const ancestors: SourceElement[] = [];
    let current = element.parent as SourceElement | SourceDocument | null;

    while (current && current !== rootNode) {
      if (isTag(current)) {
        ancestors.push(current);
      }
      current = current.parent as SourceElement | SourceDocument | null;
    }

    for (const ancestor of ancestors) {
      if (ancestor.endIndex >= delta.mutationStart) {
        ancestor.endIndex = applyDeltaToPosition(ancestor.endIndex, delta);
      }

      if (ancestor.source?.closeTag && ancestor.source.closeTag.startIndex >= delta.mutationStart) {
        ancestor.source.closeTag.startIndex = applyDeltaToPosition(ancestor.source.closeTag.startIndex, delta);
        ancestor.source.closeTag.endIndex = applyDeltaToPosition(ancestor.source.closeTag.endIndex, delta);
      }
    }
  }

  private updateNode(node: SourceChildNode, delta: PositionDelta): void {
    if (isTag(node)) {
      this.updateElementNode(node, delta);
    } else if (isText(node)) {
      this.updateTextNode(node, delta);
    } else {
      this.updateBasicNode(node, delta);
    }
  }

  private updateElementNode(element: SourceElement, delta: PositionDelta): void {
    if (element.endIndex < delta.mutationStart) {
      return;
    }

    element.startIndex = applyDeltaToPosition(element.startIndex, delta);
    element.endIndex = applyDeltaToPosition(element.endIndex, delta);

    const openTagEnd = element.source?.openTag?.endIndex ?? element.startIndex;
    const tagsAffected = openTagEnd >= delta.mutationStart;

    if (tagsAffected) {
      if (element.source?.openTag) {
        element.source.openTag.startIndex = applyDeltaToPosition(element.source.openTag.startIndex, delta);
        element.source.openTag.endIndex = applyDeltaToPosition(element.source.openTag.endIndex, delta);
      }

      if (element.source?.attributes) {
        for (const attribute of element.source.attributes) {
          this.updateAttributePositions(attribute, delta);
        }
      }
    }

    if (element.source?.closeTag) {
      element.source.closeTag.startIndex = applyDeltaToPosition(element.source.closeTag.startIndex, delta);
      element.source.closeTag.endIndex = applyDeltaToPosition(element.source.closeTag.endIndex, delta);
    }

    if (element.children) {
      for (const child of element.children) {
        this.updateNode(child, delta);
      }
    }
  }

  private updateTextNode(text: SourceText, delta: PositionDelta): void {
    if (text.endIndex < delta.mutationStart) {
      return;
    }

    text.startIndex = applyDeltaToPosition(text.startIndex, delta);
    text.endIndex = applyDeltaToPosition(text.endIndex, delta);
  }

  private updateBasicNode(node: SourceChildNode, delta: PositionDelta): void {
    if (!hasPositions(node)) {
      return;
    }

    if (node.endIndex < delta.mutationStart) {
      return;
    }

    node.startIndex = applyDeltaToPosition(node.startIndex, delta);
    node.endIndex = applyDeltaToPosition(node.endIndex, delta);
  }

  private updateAttributePositions(
    attribute: SourceElement['source']['attributes'][number],
    delta: PositionDelta
  ): void {
    if (attribute.name) {
      attribute.name.startIndex = applyDeltaToPosition(attribute.name.startIndex, delta);
      attribute.name.endIndex = applyDeltaToPosition(attribute.name.endIndex, delta);
    }

    if (attribute.value) {
      attribute.value.startIndex = applyDeltaToPosition(attribute.value.startIndex, delta);
      attribute.value.endIndex = applyDeltaToPosition(attribute.value.endIndex, delta);
    }

    if (attribute.source) {
      attribute.source.startIndex = applyDeltaToPosition(attribute.source.startIndex, delta);
      attribute.source.endIndex = applyDeltaToPosition(attribute.source.endIndex, delta);
    }
  }
}
