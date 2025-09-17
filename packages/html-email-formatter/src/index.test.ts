import { test, expect } from 'vitest';

import emailFormatter from './index';

test('email formatter should align the open and close tags', () => {
  const result = emailFormatter(`
    <div>
    <!--[if MAC]>
    <div>
    <span>
    <![endif]-->
    <!--[if MAC]>
    </span>
    </div>
    <![endif]-->
    </div>
  `);

  expect(result).toBe(
    `<div>
  <!--[if MAC]>
  <div>
    <span>
  <![endif]-->
  <!--[if MAC]>
    </span>
  </div>
  <![endif]-->
</div>`
  );
});

test('email formatter should respect the whitespace', () => {
  const result = emailFormatter(`
    <div> <!--[if MAC]> hello    <![endif]-->      </div>
  `);

  expect(result).toBe(`<div> <!--[if MAC]> hello <![endif]--> </div>`);
});

test('should keep no whitespace if there was none', () => {
  const result = emailFormatter(`<div><!--[if MAC]>hello<![endif]--></div>`);

  expect(result).toBe(`<div><!--[if MAC]>hello<![endif]--></div>`);
});

test('email formatter should properly format from a single line', () => {
  const result = emailFormatter(`<!DOCTYPE html>
  <html style="">
  
    <body class="">
  
      <!--[if mso]><table cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="background-color: rgb(255, 255, 255);"><![endif]-->
  
      <!--[if mso]></td></tr></table><![endif]-->
     
       </body>
  </html>`);

  expect(result).toBe(
    `<!DOCTYPE html>
<html style="">

  <body class="">

    <!--[if mso]><table cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
    <td style="background-color: rgb(255, 255, 255);"><![endif]-->

    <!--[if mso]></td>
      </tr>
    </table><![endif]-->

  </body>

</html>`
  );
});
