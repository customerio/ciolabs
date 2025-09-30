export type MorphdomOptions = {
  getNodeKey?: (node: Node) => unknown;
  /**
   * Filtering nodes for diffing
   */
  filterNode?: (node: Node) => boolean;
  /**
   * Adding nodes
   */
  onBeforeNodeAdded?: (node: Node) => boolean;
  addChild?: (parent: Node, child: Node) => void;
  onNodeAdded?: (node: Node) => Node;
  /**
   * Updating nodes
   */
  onBeforeElementUpdated?: (fromElement: HTMLElement, toElement: HTMLElement) => boolean;
  updateElement?: (fromElement: HTMLElement, toElement: HTMLElement) => void;
  onElementUpdated?: (element: HTMLElement) => void;
  /**
   * Removing nodes
   */
  onBeforeNodeDiscarded?: (node: Node) => boolean;
  discardChild?: (parent: Node, child: Node) => void;
  onNodeDiscarded?: (node: Node) => void;
  /**
   * Updating node children
   */
  onBeforeElementChildrenUpdated?: (fromElement: HTMLElement, toElement: HTMLElement) => boolean;
  childrenOnly?: boolean;
};

export type MorphOptions = {
  ignoredAttributes?: string[];
  ignoredClasses?: string[];
};
