/**
 * Parse the WHATWG HTML spec user-agent stylesheet (html-ua-styles)
 * and generate a TypeScript source file with the default CSS display
 * value for every HTML element.
 *
 * Run: node scripts/generate.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const cssPath = require.resolve('html-ua-styles/index.css');
const css = readFileSync(cssPath, 'utf8');

// Parse CSS rules: extract simple element selectors and their display values.
// We only care about rules like `div { display: block; }` — skip attribute
// selectors, pseudo-classes, @media, etc.
const elementDisplay = new Map();

// Match rule blocks: selectors { ... }
const ruleRegex = /([^{}@]+)\{([^}]*)\}/g;
let match;

while ((match = ruleRegex.exec(css)) !== null) {
  const selectorBlock = match[1];
  const declarations = match[2];

  // Skip rules inside @media or other at-rules (they're conditional)
  // Also skip selectors that contain :is(), :not(), etc.
  if (selectorBlock.includes(':is(') || selectorBlock.includes(':not(')) continue;

  // Extract display value
  const displayMatch = /display:\s*([^;!]+)/i.exec(declarations);
  if (!displayMatch) continue;

  const displayValue = displayMatch[1].trim();

  // Parse comma-separated selectors
  for (const selector of selectorBlock.split(',')) {
    const trimmed = selector.trim();

    // Only take bare element selectors — no attributes ([...]),
    // pseudo-classes (:...), combinators (>+~), or parentheses.
    if (/^[a-z][a-z0-9]*$/i.test(trimmed)) {
      elementDisplay.set(trimmed.toLowerCase(), displayValue);
    }
  }
}

// The spec uses `:heading` pseudo-class for h1-h6 which our parser
// can't extract. Add them manually.
for (const heading of ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']) {
  if (!elementDisplay.has(heading)) {
    elementDisplay.set(heading, 'block');
  }
}

// Group all elements by display value for readable output.
// Elements not listed default to 'inline' at runtime.
const byDisplay = new Map();
for (const [element, display] of [...elementDisplay].sort(([a], [b]) => a.localeCompare(b))) {
  // Skip elements with plain 'inline' display — they match the default
  if (display === 'inline') continue;
  if (!byDisplay.has(display)) byDisplay.set(display, []);
  byDisplay.get(display).push(element);
}

// Generate TypeScript
const lines = [
  '// Auto-generated from the WHATWG HTML spec user-agent stylesheet.',
  '// Source: https://html.spec.whatwg.org/multipage/rendering.html',
  '// Package: html-ua-styles (https://www.npmjs.com/package/html-ua-styles)',
  `// Generated: ${new Date().toISOString().slice(0, 10)}`,
  '// Run `pnpm generate` to regenerate.',
  '',
  'export type CssDisplay =',
  "  | 'block'",
  "  | 'contents'",
  "  | 'flex'",
  "  | 'inline'",
  "  | 'inline-block'",
  "  | 'inline-flex'",
  "  | 'list-item'",
  "  | 'none'",
  "  | 'ruby'",
  "  | 'ruby-text'",
  "  | 'table'",
  "  | 'table-caption'",
  "  | 'table-cell'",
  "  | 'table-column'",
  "  | 'table-column-group'",
  "  | 'table-footer-group'",
  "  | 'table-header-group'",
  "  | 'table-row'",
  "  | 'table-row-group';",
  '',
  '/**',
  ' * Default CSS `display` value for HTML elements per the WHATWG spec.',
  " * Elements not in this map default to `'inline'`.",
  ' */',
  "const ELEMENT_DISPLAY = new Map<string, CssDisplay>([",
];

// Sort display values for consistent output
const sortedDisplayValues = [...byDisplay.keys()].sort();
for (const display of sortedDisplayValues) {
  const elements = byDisplay.get(display).sort();
  lines.push(`  // ${display}`);
  for (const el of elements) {
    lines.push(`  ['${el}', '${display}'],`);
  }
}

lines.push(']);');
lines.push('');
lines.push('/**');
lines.push(' * Get the default CSS `display` value for an HTML element.');
lines.push(" * Returns `'inline'` for unknown or custom elements.");
lines.push(' */');
lines.push("export function getElementDisplay(tagName: string): CssDisplay {");
lines.push("  return ELEMENT_DISPLAY.get(tagName.toLowerCase()) ?? 'inline';");
lines.push('}');
lines.push('');
lines.push('/**');
lines.push(' * Whether an element has an inline default display value');
lines.push(' * (`inline`, `inline-block`, or `inline-flex`).');
lines.push(' * Unknown and custom elements return `true` (conservative default).');
lines.push(' */');
lines.push('export function isInlineElement(tagName: string): boolean {');
lines.push('  const display = getElementDisplay(tagName);');
lines.push("  return display === 'inline' || display === 'inline-block' || display === 'inline-flex';");
lines.push('}');
lines.push('');

const output = lines.join('\n');
const outPath = resolve(__dirname, '../src/index.ts');
writeFileSync(outPath, output);

const mappedCount = [...byDisplay.values()].reduce((sum, elements) => sum + elements.length, 0);
console.log(`Generated ${outPath}`);
console.log(`  ${elementDisplay.size} elements parsed from CSS`);
console.log(`  ${mappedCount} in display map (non-default)`);
