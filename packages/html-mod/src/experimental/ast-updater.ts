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
    // If delta is zero, no positions need updating
    if (delta.delta === 0) {
      return;
    }

    // Safety check: if element has been removed from tree, fall back to full update
    if (!element.parent) {
      this.updateNodePositions(rootNode, delta);
      return;
    }

    // 1. Update the element itself and all its descendants
    this.updateElementNode(element, delta);

    // 2. Walk up to update all ancestors
    this.updateAncestors(element, rootNode, delta);

    // 3. Update following siblings at all ancestor levels
    this.updateFollowingSiblings(element, rootNode, delta);
  }

  /**
   * Update following siblings at all levels
   */
  private updateFollowingSiblings(element: SourceElement, rootNode: SourceDocument, delta: PositionDelta): void {
    // Start from the element's parent
    let parent = element.parent as SourceElement | SourceDocument | null;
    let child: SourceChildNode = element;

    while (parent) {
      // Get siblings at this level
      const siblings = isTag(parent) ? parent.children : parent === rootNode ? rootNode.children : [];

      // Find index of current child
      const childIndex = siblings.indexOf(child);

      // Update all following siblings
      for (let index = childIndex + 1; index < siblings.length; index++) {
        this.updateNode(siblings[index], delta);
      }

      // Move up to next level
      if (parent === rootNode) break;
      child = parent as SourceChildNode;
      parent = isTag(parent) ? (parent.parent as SourceElement | SourceDocument | null) : null;
    }
  }

  /**
   * Update all affected node positions in the AST based on a position delta
   * Falls back to full tree walk when we don't know which element was modified
   */
  updateNodePositions(rootNode: SourceDocument, delta: PositionDelta): void {
    // If delta is zero, no positions need updating
    if (delta.delta === 0) {
      return;
    }

    // Walk the tree and update all affected nodes
    for (const child of rootNode.children) {
      this.updateNode(child, delta);
    }
  }

  /**
   * Update all ancestors of the given element
   */
  private updateAncestors(element: SourceElement, rootNode: SourceDocument, delta: PositionDelta): void {
    // Walk up the tree to find and update all ancestors
    const ancestors: SourceElement[] = [];
    let current = element.parent as SourceElement | SourceDocument | null;

    while (current && current !== rootNode) {
      if (isTag(current)) {
        ancestors.push(current);
      }
      current = current.parent as SourceElement | SourceDocument | null;
    }

    // Update each ancestor's boundary positions and close tag
    for (const ancestor of ancestors) {
      // Only update endIndex for ancestors (startIndex won't change)
      if (ancestor.endIndex >= delta.mutationStart) {
        ancestor.endIndex = applyDeltaToPosition(ancestor.endIndex, delta);
      }

      // Update closeTag if it exists and is affected
      if (ancestor.source?.closeTag && ancestor.source.closeTag.startIndex >= delta.mutationStart) {
        ancestor.source.closeTag.startIndex = applyDeltaToPosition(ancestor.source.closeTag.startIndex, delta);
        ancestor.source.closeTag.endIndex = applyDeltaToPosition(ancestor.source.closeTag.endIndex, delta);
      }
    }
  }

  /**
   * Update a single node and its descendants
   */
  private updateNode(node: SourceChildNode, delta: PositionDelta): void {
    if (isTag(node)) {
      this.updateElementNode(node, delta);
    } else if (isText(node)) {
      this.updateTextNode(node, delta);
    } else {
      // Other node types (comments, CDATA, processing instructions, etc.) have basic position tracking
      this.updateBasicNode(node, delta);
    }
  }

  /**
   * Update positions for an element node
   */
  private updateElementNode(element: SourceElement, delta: PositionDelta): void {
    // Optimization: if this element ends before the mutation, skip entire subtree
    if (element.endIndex < delta.mutationStart) {
      return;
    }

    // Update element boundary indices
    element.startIndex = applyDeltaToPosition(element.startIndex, delta);
    element.endIndex = applyDeltaToPosition(element.endIndex, delta);

    // Optimization: Only update tags and attributes if they're in the affected range
    const openTagEnd = element.source?.openTag?.endIndex ?? element.startIndex;
    const tagsAffected = openTagEnd >= delta.mutationStart;

    if (tagsAffected) {
      // Update openTag positions
      if (element.source?.openTag) {
        element.source.openTag.startIndex = applyDeltaToPosition(element.source.openTag.startIndex, delta);
        element.source.openTag.endIndex = applyDeltaToPosition(element.source.openTag.endIndex, delta);
      }

      // Update attribute positions (they're within the openTag)
      if (element.source?.attributes) {
        for (const attribute of element.source.attributes) {
          this.updateAttributePositions(attribute, delta);
        }
      }
    }

    // Update closeTag positions (if exists)
    // Note: applyDeltaToPosition handles checking if update is needed based on operation type
    if (element.source?.closeTag) {
      element.source.closeTag.startIndex = applyDeltaToPosition(element.source.closeTag.startIndex, delta);
      element.source.closeTag.endIndex = applyDeltaToPosition(element.source.closeTag.endIndex, delta);
    }

    // Recursively update children (they might be affected even if tags aren't)
    if (element.children) {
      for (const child of element.children) {
        this.updateNode(child, delta);
      }
    }
  }

  /**
   * Update positions for a text node
   */
  private updateTextNode(text: SourceText, delta: PositionDelta): void {
    // Optimization: if text ends before mutation, no update needed
    if (text.endIndex < delta.mutationStart) {
      return;
    }

    text.startIndex = applyDeltaToPosition(text.startIndex, delta);
    text.endIndex = applyDeltaToPosition(text.endIndex, delta);
  }

  /**
   * Update positions for other node types (comments, CDATA, processing instructions, etc.)
   */
  private updateBasicNode(node: SourceChildNode, delta: PositionDelta): void {
    // Check if node has position tracking
    if (!hasPositions(node)) {
      return;
    }

    // Optimization: if node ends before mutation, no update needed
    if (node.endIndex < delta.mutationStart) {
      return;
    }

    node.startIndex = applyDeltaToPosition(node.startIndex, delta);
    node.endIndex = applyDeltaToPosition(node.endIndex, delta);
  }

  /**
   * Update positions for an attribute
   */
  private updateAttributePositions(
    attribute: SourceElement['source']['attributes'][number],
    delta: PositionDelta
  ): void {
    // Update attribute name positions
    if (attribute.name) {
      attribute.name.startIndex = applyDeltaToPosition(attribute.name.startIndex, delta);
      attribute.name.endIndex = applyDeltaToPosition(attribute.name.endIndex, delta);
    }

    // Update attribute value positions (if exists)
    if (attribute.value) {
      attribute.value.startIndex = applyDeltaToPosition(attribute.value.startIndex, delta);
      attribute.value.endIndex = applyDeltaToPosition(attribute.value.endIndex, delta);
    }

    // Update attribute source positions (full attribute with quotes)
    if (attribute.source) {
      attribute.source.startIndex = applyDeltaToPosition(attribute.source.startIndex, delta);
      attribute.source.endIndex = applyDeltaToPosition(attribute.source.endIndex, delta);
    }
  }
}
