---
'@ciolabs/html-email-formatter': patch
'@ciolabs/html-preserve-comment-whitespace': patch
'@ciolabs/html-process-conditional-comments': patch
---

Fix formatting parity with parcel-standalone's email-pretty

Replaced `MagicString` with `ranges-apply` in both `html-preserve-comment-whitespace` and `html-email-formatter` to match the string manipulation approach used by parcel-standalone. `ranges-apply` collects all edits as range tuples and applies them atomically, correctly handling overlapping and adjacent whitespace regions between nearby HTML comments. `MagicString` could produce unexpected results in these cases.

Pinned `js-beautify` to `~1.13.4` to match the version used by parcel-standalone. The newer `js-beautify@1.15.x` changed how inline content with HTML comments is formatted, which caused whitespace around conditional comments to be collapsed instead of preserved.

### Formatting differences

**Whitespace around conditional comments is now preserved:**

Before (with `js-beautify@1.15.x` + `MagicString`):

```html
<!-- Input -->
<div><!--[if MAC]> hello <![endif]--></div>

<!-- Output — whitespace collapsed -->
<div><!--[if MAC]> hello <![endif]--></div>
```

After (with `js-beautify@1.13.x` + `ranges-apply`):

```html
<!-- Input -->
<div><!--[if MAC]> hello <![endif]--></div>

<!-- Output — whitespace preserved -->
<div><!--[if MAC]> hello <![endif]--></div>
```

**Multi-line conditional comments and complex documents are unaffected** — the alignment and indentation behavior remains the same:

```html
<!-- Input -->
<html style="">
  <body class="">
    <!--[if mso]><table cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="background-color: rgb(255, 255, 255);"><![endif]-->
    <!--[if mso]></td></tr></table><![endif]-->
  </body>
</html>

<!-- Output (same before and after) -->
<html style="">
  <body class="">
    <!--[if mso]><table cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
    <td style="background-color: rgb(255, 255, 255);"><![endif]-->

    <!--[if mso]></td>
      </tr>
    </table><![endif]-->
  </body>
</html>
```
