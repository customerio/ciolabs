---
'@ciolabs/html-email-formatter': patch
---

Call js-beautify directly instead of through the unmaintained `pretty` package, and move js-beautify from 1.13 to 1.15. The defaults and the `ocd` option behave as before, and custom elements such as `<x-conditional>` stay on their own lines. One fix comes with the upgrade: some object literals inside a `<script>` are no longer indented a level too deep.
