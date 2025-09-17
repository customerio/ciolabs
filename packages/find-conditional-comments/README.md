# @ciolabs/find-conditional-comments

> Finds all conditional comments in a string

## Install

```bash
npm install @ciolabs/find-conditional-comments
```

## Usage

```js
import findConditionalComments from '@ciolabs/find-conditional-comments';

const html = `
<!--[if mso]>
Hello, Microsoft Outlook!
<![endif]-->
`;

findConditionalComments(html);
//=> [ { open: "<!--[if mso]>", close: "<![endif]-->", range: [1, 63], downlevel: "hidden", isComment: true, bubble: false } ]
```

## API

### findConditionalComments(html)

Returns an Array of Objects for each comment with the following properties:

#### isComment

> `boolean`

Whether the comment is an HTML comment. This might be `false` for certain items when `downlevel` is `revealed`.

#### open

> `string`

Opening portion of the conditional comment.

#### close

> `string`

Closing portion of the conditional comment.

#### bubble

> `boolean`

Whether the comment "bubbles" around the value.

When `true`, the comment is visible to all platforms except those that support conditional comments.

```html
<!--[if !mso]>-->
Hello, Not Microsoft Outlook!
<!--<![endif]-->
```

When `false`, the comment is hidden from all platforms except those that support conditional comments.

```html
<!--[if mso]> Hello, Microsoft Outlook! <![endif]-->
```

#### downlevel

> `'hidden' | 'revealed'`

Either `hidden` or `revealed`.

`hidden` means the comment is hidden from all platforms except those that support conditional comments.

`revealed` means the comment is visible to all platforms except those that support conditional comments.

This is very similar to the `bubble` property, but it's not the same.

`downlevel` always be `revealed` if `bubble` is `true`.

But `bubble` can be `true` even if `downlevel` is `hidden` when using this syntax:

```html
<![if lt IE 8]>
<p>Please upgrade to Internet Explorer version 8.</p>
<![endif]>
```

Learn more about [downlevel conditional comments](<https://docs.microsoft.com/en-us/previous-versions/windows/internet-explorer/ie-developer/compatibility/ms537512(v%3dvs.85)#downlevel-hidden-conditional-comments>).

#### range

> `[number, number]`

A range array containing the start and end indices of the comment.

## TypeScript Support

This package is built with TypeScript and provides full type definitions.
