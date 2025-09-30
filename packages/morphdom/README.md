# @ciolabs/morphdom

> A flexible wrapper around morphdom, a way to diff and patch DOM elements.

## Why?

[`morphdom`](https://github.com/patrick-steele-idem/morphdom) is a great library for diffing and patching DOM elements. However, it lacks a few key pieces of flexibility to serve our needs.

1. It doesn't allow you to control which elements to consider when diffing. This is a problem since a single whitespace change in a large document can cause an outsided amount of work to be done.

2. There is no batteries-included way to ignore attributes when diffing. This is a problem since some attributes are not important to the application and can be ignored, especially when they are applied by our code (i.e. when connecting tinymce).

3. There is no way at all to control how attributes get updated. This means that even if you can ignore attributes when diffing, they will still be destroyed when the element is patched.

## Install

```bash
npm install @ciolabs/morphdom
```

## Usage

### `morph`

`morph` is a simplified version of `morphdom` that allows you to morph two elements together. Instead of providing all the options that `morphdom` does, `morph` provides a few key options that cover the majority of the use cases.

Some things it does:

1. Ignores whitespace changes
2. Ignores the given attributes
3. Ignores the given classes

```js
import { morph } from '@ciolabs/morphdom';

var el1 = document.createElement('div');
el1.dataset.foo = 'I wont change';

var el2 = document.createElement('div');
el2.dataset.foo = 'even if I change';

morph(el1, el2, {
  ignoredAttributes: ['data-foo'],
});

expect(el1.dataset.foo).to.equal('I wont change');
```

The `morph` function takes three arguments:

`fromNode` - The node to morph
`toNode` - The node that the fromNode should be morphed to or an HTML string
`options` - See below for supported options

**Options:**

- `ignoredAttributes` - An array of attributes to ignore when diffing. If an attribute is ignored, it will not be updated when the element is patched.
- `ignoredClasses` - An array of classes to ignore when diffing. If a class is ignored, it will not be updated when the element is patched.

### `morphdom`

You can use `morphdom` just like you would normally, but with a few extra options.

```js
import { morphdom } from '@ciolabs/morphdom';

var el1 = document.createElement('div');
el1.className = 'foo';

var el2 = document.createElement('div');
el2.className = 'bar';

morphdom(el1, el2);

expect(el1.className).to.equal('bar');
```

The `morphdom` function takes three arguments:

`fromNode` (Node)- The node to morph
`toNode` (Node|String) - The node that the fromNode should be morphed to (or an HTML string)
`options` - See below for supported options

**Options:**

- `getNodeKey(node)` - Called to get the `Node`'s unique identifier. This is used by `morphdom` to rearrange elements rather than creating and destroying an element that already exists. This defaults to using the `Node`'s `id` property. (Note that form fields must not have a `name` corresponding to forms' DOM properties, e.g. `id`.)
- `filterNode(node)` - Determines if the node should be used when diffing. If this function returns `false` then the node will not be used. Defaults to returning `true`.
- `onBeforeNodeAdded(node)` - Called before a `Node` in the `to` tree is added to the `from` tree. If this function returns `false` then the node will not be added. Should return the node to be added.
- `addChild(parentNode, node)` - Called when adding a new child to a parent. By default, `parentNode.appendChild(childNode)` is invoked. Use this callback to customize how a new child is added.
- `onNodeAdded(node)` - Called after a `Node` in the `to` tree has been added to the `from` tree.
- `onBeforeElementUpdated(fromElement, toElement)` - Called before a `HTMLElement` in the `from` tree is updated. If this function returns `false` then the element will not be updated.
- `updateElement(fromElement, toElement)` - Called when updating an element. By default, `morphdom` will update the element's attributes and children. Use this callback to customize how an element is updated.
- `onElementUpdated(element)` - Called after a `HTMLElement` in the `from` tree has been updated.
- `onBeforeNodeDiscarded(node)` - Called before a `Node` in the `from` tree is discarded. If this function returns `false` then the node will not be discarded.
- `removeChild(parentNode, node)` - Called when removing a child from a parent. By default, `parentNode.removeChild(childNode)` is invoked. Use this callback to customize how a child is removed.
- `onNodeDiscarded(node)` - Called after a `Node` in the `from` tree has been discarded.
- `onBeforeElementChildrenUpdated(fromElement, toElement)` - Called before the children of a `HTMLElement` in the `from` tree are updated. If this function returns `false` then the child nodes will not be updated.
- `childrenOnly` - If `true` then only the children of the `fromNode` and `toNode` nodes will be morphed (the containing element will be skipped). Defaults to `false`.
- `skipFromChildren(fromElement, toElement)` - called when indexing a the `fromElement` tree. False by default. Return `true` to skip indexing the from tree, which will keep current items in place after patch rather than removing them when not found in the `toElement`.
