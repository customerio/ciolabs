/**
 * AST Position Update Engine
 *
 * This module updates AST node positions after MagicString operations,
 * keeping the AST synchronized with the string state without reparsing.
 */
import { SourceDocument, SourceElement, SourceChildNode, SourceText, isTag, isText } from '@ciolabs/htmlparser2-source';

import { PositionDelta, applyDeltaToPosition } from './position-delta.js';

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
   * Update all affected node positions in the AST based on a position delta
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
