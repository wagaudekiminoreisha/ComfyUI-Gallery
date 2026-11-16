const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load}=require('./ts_loader.cjs');
const {deduplicatePromptPreview:dedup}=load('PromptDeduplication');

test('preview keeps first matching tag in nested attention contexts',()=>{
 assert.equal(dedup('(blue eyes, (smile:1.1):1.2), (blue eyes, long hair, (smile:1.1):1.2)'),'(blue eyes, (smile:1.1):1.2), (long hair:1.2)');
 assert.equal(dedup('a, b, a, ((c)), ((c)), b, d'),'a, b, ((c)), d');
 assert.equal(dedup('((a, a):1.2), ((a):1.2)'),'((a):1.2)');
});
test('preview preserves different syntax and explicit chunk boundaries',()=>{
 for(const text of ['a, (a), [a], (a:1.2), (a:1.3), ((a))','blue eyes, blue_eyes, Blue eyes','a, BREAK, a','[a:b:0.5], a','(broken, a, a','a,  b'])assert.equal(dedup(text),text);
 assert.equal(dedup('a, BREAK, a, a'),'a, BREAK, a');
 assert.equal(dedup(String.raw`tag\(x\), tag\(x\), other`),String.raw`tag\(x\), other`);
});
test('matching optional groups share one expression but different activation rules remain distinct',()=>{
 assert.equal(dedup('{a|b}, {a|b}'),'{a|b}');
 assert.equal(dedup('{a|}, {a|}'),'{a|}');
 for(const text of ['a, {a|}','{a,b|}, {a,c|}','{a, {a|b}|}, a'])assert.equal(dedup(text),text);
 assert.equal(dedup(String.raw`\\{literal\\}, a, a`),String.raw`\\{literal\\}, a`);
});
const {mergePromptContributions}=load('PromptDeduplication');
const {composeSharedPreview,sharedEditorPrompt}=load('SharedPrompt');
test('source wins regardless of position, while matching conditionals keep their own rule context',()=>{
 const merged=mergePromptContributions([{text:'{a|}, b'},{text:'{a|}, c',source:true}]);
 assert.deepEqual(merged.rows.map(row=>row.text),['b','{a|}, c']);assert.equal(merged.references[0].to,1);
 assert.equal(composeSharedPreview('{a|}, style, ⟦source⟧',{source_text:'{a|}, pose'}),'style, {a|}, pose');
 assert.equal(composeSharedPreview('a, ⟦source⟧',{source_text:'{a|}'}),'a, {a|}');
 assert.equal(composeSharedPreview('a, BREAK, ⟦source⟧',{source_text:'a'}),'a, BREAK, a');
});
test('editor projection is reversible, source first, and ignores disabled contributions',()=>{
 const original={version:1,boxes:[{id:'manual',kind:'group',name:'Look',enabled:true,collapsed:false,chips:[{id:'tag',kind:'or',options:['a'],optional:true,enabled:true}]},{id:'src',kind:'source',enabled:true,collapsed:false},{id:'off',kind:'group',enabled:false,chips:[{id:'off-tag',kind:'tag',text:'a',enabled:true}]}]};
 const state=JSON.stringify(original),sources={source_text:{connected:true,text:'{a|}'}};
 let result=sharedEditorPrompt(original,sources);assert.deepEqual(result.rows.map(row=>row.text),['','{a|}']);assert.equal(result.references.length,1);assert.equal(JSON.stringify(original),state);
 result=sharedEditorPrompt(original,{source_text:{connected:false}});assert.equal(result.rows[0].text,'{a|}');assert.equal(result.references.length,0);
});
