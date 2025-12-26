const { parseDocument, isTag, isText, isComment } = require('./dist/index.js');

const html = '<main><div><a>hello</</div></main>';
console.log('Input:', html);

const doc = parseDocument(html);
const main = doc.children.find(n => isTag(n) && n.name === 'main');
if (main) {
  const div = main.children.find(n => isTag(n) && n.name === 'div');
  if (div) {
    const a = div.children.find(n => isTag(n) && n.name === 'a');
    if (a) {
      console.log('\n<a> tag has', a.children.length, 'children:');
      a.children.forEach((child, i) => {
        if (isText(child)) {
          console.log(`  ${i}: TEXT: "${child.data}"`);
        } else if (isComment(child)) {
          console.log(`  ${i}: COMMENT: "${child.data}"`);
        } else if (isTag(child)) {
          console.log(`  ${i}: TAG: <${child.name}>`);
        } else {
          console.log(`  ${i}: OTHER: ${child.type}`);
        }
      });
    }
  }
}
