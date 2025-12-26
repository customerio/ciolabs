import { HtmlMod } from './dist/index.experimental.js';

// Test original parsed HTML
const html = new HtmlMod('<div id="test" class="foo">content</div>');
const div = html.querySelector('div');

console.log('=== Original Parsed HTML ===');
console.log('Source:', html.__source);
console.log('\nopenTag.data:', div.__element.source.openTag.data);
console.log('openTag positions:', div.__element.source.openTag.startIndex, '-', div.__element.source.openTag.endIndex);
console.log('Actual substring:', html.__source.slice(
  div.__element.source.openTag.startIndex,
  div.__element.source.openTag.endIndex + 1
));

console.log('\nAttribute data:');
for (const attr of div.__element.source.attributes) {
  console.log(`  ${attr.name.data}:`);
  console.log(`    source.data: "${attr.source.data}"`);
  console.log(`    positions: ${attr.source.startIndex} - ${attr.source.endIndex}`);
  console.log(`    actual substring: "${html.__source.slice(attr.source.startIndex, attr.source.endIndex + 1)}"`);
}

// Now test after modification
console.log('\n=== After setAttribute ===');
div.setAttribute('data-new', 'value');

const newAttr = div.__element.source.attributes.find(a => a.name.data === 'data-new');
console.log('New attribute source.data:', newAttr.source.data);
console.log('New attribute positions:', newAttr.source.startIndex, '-', newAttr.source.endIndex);
console.log('Actual substring:', html.__source.slice(newAttr.source.startIndex, newAttr.source.endIndex + 1));
