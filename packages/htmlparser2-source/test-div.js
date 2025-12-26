const { parseDocument, isTag, isText, isComment } = require('./dist/index.js');

const html = '<main><div><a>hello</</div></main>';
console.log('Input:', html);

const doc = parseDocument(html);
const main = doc.children.find(n => isTag(n) && n.name === 'main');
const div = main.children.find(n => isTag(n) && n.name === 'div');

console.log('\ndiv element:');
console.log('  has closeTag:', !!div.source.closeTag);
if (div.source.closeTag) {
  console.log('  closeTag data:', div.source.closeTag.data);
}
console.log('  endIndex:', div.endIndex);
console.log('  children count:', div.children.length);

const a = div.children.find(n => isTag(n) && n.name === 'a');
if (a) {
  console.log('\na element:');
  console.log('  has closeTag:', !!a.source.closeTag);
  console.log('  endIndex:', a.endIndex);
  console.log('  children:');
  a.children.forEach((child, i) => {
    if (isText(child)) {
      console.log(`    ${i}: TEXT "${child.data}" (${child.startIndex}-${child.endIndex})`);
    }
  });
}
