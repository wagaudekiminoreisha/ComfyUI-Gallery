const {test}=require('node:test');const assert=require('node:assert/strict');const {load}=require('./ts_loader.cjs');
const B=load('PromptBoxes'),N=load('TagNesting');
const syntax=chips=>chips.map(B.compileChip).join(', ');
test('nest selections distinguish repeated tags by occurrence and preserve unrelated nests',()=>{
 const chips=B.parsePrompt('blue eyes, {blue eyes|green eyes|}, (long hair:1.2), {standing|sitting}');
 const result=N.nestTags(chips,['0','1/0/0'],'group');
 assert.equal(syntax(result),'{blue eyes|}, {green eyes|}, (long hair:1.2), {standing|sitting}');
 assert.strictEqual(result.at(-1),chips.at(-1));assert.strictEqual(result.at(-2),chips.at(-2));
 assert.equal(syntax(chips),'blue eyes, {blue eyes|green eyes|}, (long hair:1.2), {standing|sitting}');
});
test('whole nests are moved without flattening and ancestor/child picks are counted once',()=>{
 const chips=B.parsePrompt('{a|b|}, c');
 assert.equal(syntax(N.nestTags(chips,['0','0/0/0','1'],'alternatives')),'{{a|b|}|c}');
 assert.strictEqual(N.nestTags(chips,[],'group'),chips);
});
test('deep selections can share one nest only inside their supplied owner',()=>{
 const chips=B.parsePrompt('{{a|b}, c|}, ({d|e}:1.2), untouched');
 const entries=N.nestEntries(chips);assert.ok(entries.some(row=>row.path==='0/0/0/0/0'&&row.text==='a'));
 assert.equal(syntax(N.nestTags(chips,['0/0/0/0/0','1/1/0'],'optional')),'{a|e|}, {b, c|}, (d:1.2), untouched');
 const other=B.parsePrompt('another source');assert.equal(syntax(other),'another source');
});
test('source replacement mapping keeps untouched original terms independently restorable',()=>{
 const chips=B.parsePrompt('{a|b}, c, untouched'),roots=new Map();
 N.nestTags(chips,['0/0/0','1'],'group',roots);
 assert.equal(syntax(roots.get(chips[0].id)),'{a, c|}, b');
 assert.equal(syntax(roots.get(chips[1].id)),'');
 assert.strictEqual(roots.get(chips[2].id)[0],chips[2]);
});
