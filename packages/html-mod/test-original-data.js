import { HtmlMod } from './src/index.experimental.js';

// Test original parsed HTML
const html = new HtmlMod('<div id="test" class="foo">content</div>');
const div = html.querySelector('div');

console.log('=== Original Parsed HTML ===');
console.log('Source:', html.__source);
console.log('\nopenTag.data:', div.__element.source.openTag.data);
console.log('openTag positions:', div.__element.source.openTag.startIndex, '-', div.__element.source.openTag.endIndex);
console.log(
  'Actual substring:',
  html.__source.slice(div.__element.source.openTag.startIndex, div.__element.source.openTag.endIndex + 1)
);

console.log('\nAttribute data:');
for (const attribute of div.__element.source.attributes) {
  console.log(`  ${attribute.name.data}:`);
  console.log(`    source.data: "${attribute.source.data}"`);
  console.log(`    positions: ${attribute.source.startIndex} - ${attribute.source.endIndex}`);
  console.log(
    `    actual substring: "${html.__source.slice(attribute.source.startIndex, attribute.source.endIndex + 1)}"`
  );
}

// Now test after modification
console.log('\n=== After setAttribute ===');
div.dataset.new = 'value';

const newAttribute = div.__element.source.attributes.find(a => a.name.data === 'data-new');
console.log('New attribute source.data:', newAttribute.source.data);
console.log('New attribute positions:', newAttribute.source.startIndex, '-', newAttribute.source.endIndex);
console.log('Actual substring:', html.__source.slice(newAttribute.source.startIndex, newAttribute.source.endIndex + 1));
