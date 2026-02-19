# @ciolabs/html-process-conditional-comments

## 0.0.3

### Patch Changes

- [#37](https://github.com/customerio/ciolabs/pull/37) [`246e876`](https://github.com/customerio/ciolabs/commit/246e876f38fc3387336943794068be18ebdee8da) Thanks [@avigoldman](https://github.com/avigoldman)! - Fix formatting parity with parcel-standalone's email-pretty

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

## 0.0.2

### Patch Changes

- [#25](https://github.com/customerio/ciolabs/pull/25) [`9be5018`](https://github.com/customerio/ciolabs/commit/9be50180861538ed04d6bf1965264e5c685ed723) Thanks [@avigoldman](https://github.com/avigoldman)! - Handle spaces in mso conditional comments

- Updated dependencies [[`9be5018`](https://github.com/customerio/ciolabs/commit/9be50180861538ed04d6bf1965264e5c685ed723)]:
  - @ciolabs/html-find-conditional-comments@0.0.2

## 0.0.1

### Patch Changes

- [#11](https://github.com/customerio/ciolabs/pull/11) [`712c657`](https://github.com/customerio/ciolabs/commit/712c657909b6f9dddf6e79cc0bd2d6c1978cb110) Thanks [@avigoldman](https://github.com/avigoldman)! - Update license

- Updated dependencies [[`712c657`](https://github.com/customerio/ciolabs/commit/712c657909b6f9dddf6e79cc0bd2d6c1978cb110)]:
  - @ciolabs/html-find-conditional-comments@0.0.1
