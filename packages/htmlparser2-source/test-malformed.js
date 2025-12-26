const { parseDocument, nodeToString, isTag, isText } = require('./dist/index.js');

const html = '<main><div><a>hello</</div></main>';
console.log('Input:', html);
console.log('\nOutput:', nodeToString(parseDocument(html)));

const doc = parseDocument(html);
const main = doc.children.find(n => isTag(n) && n.name === 'main');
if (main) {
  console.log('\nmain children count:', main.children.length);
  main.children.forEach((child, i) => {
    if (isTag(child)) {
      console.log(`  Child ${i}: tag <${child.name}>, has ${child.children.length} children`);
      child.children.forEach((gc, j) => {
        if (isTag(gc)) {
          console.log(`    Grandchild ${j}: tag <${gc.name}>, has ${gc.children.length} children`);
          gc.children.forEach((ggc, k) => {
            if (isText(ggc)) {
              console.log(`      Great-grandchild ${k}: text "${ggc.data}"`);
            }
          });
        } else if (isText(gc)) {
          console.log(`    Grandchild ${j}: text "${gc.data}"`);
        }
      });
    } else if (isText(child)) {
      console.log(`  Child ${i}: text "${child.data}"`);
    }
  });
}
