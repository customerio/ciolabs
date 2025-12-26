const { parseDocument, isTag, isText, isComment } = require('./dist/index.js');

const html = '<main><div><a>hello</</div></main>';
console.log('Input:', html);

const doc = parseDocument(html);
const main = doc.children.find(n => isTag(n) && n.name === 'main');
const div = main.children.find(n => isTag(n) && n.name === 'div');
const a = div.children.find(n => isTag(n) && n.name === 'a');

console.log('\n<a> tag children:');
a.children.forEach((child, i) => {
  const regex = /^<\/\s*\w+/;
  if (isText(child)) {
    console.log(`  ${i}: TEXT: ${child.data}`);
  } else if (isComment(child)) {
    const matches = regex.test(child.data);
    console.log(`  ${i}: COMMENT: ${child.data} (regex: ${matches})`);
  }
});
