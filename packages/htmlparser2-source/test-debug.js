const { parseDocument, nodeToString } = require('./dist/index.js');

const testCases = [
  '<div>hello</div>',
  '<div>hello<</div>',
  '<main><div><a>hello</</div></main>',
];

testCases.forEach(html => {
  console.log('\nInput: ', html);
  const doc = parseDocument(html);
  console.log('Output:', nodeToString(doc));
});
