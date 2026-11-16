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
test('unresolved optional and alternative groups are never suppressed in the preview',()=>{
 for(const text of ['{a|b}, {a|b}','a, {a|}','{a, {a|b}|}, a','{a|}, a, a'])assert.equal(dedup(text),text);
 assert.equal(dedup(String.raw`\{literal\}, a, a`),String.raw`\{literal\}, a`);
});
