const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load}=require('./ts_loader.cjs');
const {reviewClothing}=load('ClothingRules');
const checks=text=>reviewClothing(text).findings.filter(item=>item.level==='check');

test('clothing alternatives preserve branch identity, including nested outfit choices',()=>{
 assert.equal(checks('{skirt|tracksuit}').length,0);
 assert.equal(checks('{blonde hair, skirt|blonde hair, tracksuit}').length,0);
 assert.equal(checks('{skirt, {shirt|sweater}|tracksuit}').length,0);
 assert.equal(checks('( {skirt|pants}:1.2)').length,0);
 assert.equal(checks('skirt, {shirt|pants}').length,1);
 assert.equal(checks('{skirt|}, {pants|}').length,1);
 assert.equal(checks('{(skirt, pants)|}').length,1);
});
test('ambiguous ensembles remain advisory, and normal layering and specificity stay quiet',()=>{
 assert.match(checks('skirt, tracksuit')[0].suggestion,/track pants/);
 assert.equal(checks('shirt, jacket, skirt, tights').length,0);
 assert.equal(checks('skirt, miniskirt').length,0);
 assert.equal(checks('pants, jeans').length,0);
 assert.equal(checks('pants, track_pants').length,0);
 assert.equal(checks('skirt, (track_pants:1.2)')[0].level,'check');
 assert.equal(reviewClothing('unknown garment').recognized,0);
});
test('explicit layer phrases survive as context without changing the input',()=>{
 for(const text of ['skirt over track pants','track pants under skirt','wearing a skirt over track pants','skirt, pants, skirt over pants']){
  const result=reviewClothing(text);assert.equal(result.findings.length,1,text);assert.equal(result.findings[0].level,'layered',text);
 }
 assert.equal(reviewClothing('{skirt over pants|tracksuit}').findings[0].level,'layered');
});
test('local or optional layer declarations cannot waive other branches',()=>{
 assert.equal(checks('skirt, pants, {skirt over pants|}').length,1);
 assert.equal(checks('{skirt over pants|skirt, pants}').length,1);
 const findings=checks('skirt, {pants|shorts}, skirt over pants');
 assert.ok(findings.some(item=>item.id==='shorts/skirt'));
 assert.ok(!findings.some(item=>item.id==='pants/skirt'),'the declaration only resolves its own pair');
 assert.equal(checks('{skirt over pants|pants over skirt}').length,0,'opposite orders in separate looks are allowed');
 assert.match(checks('skirt over pants, pants over skirt')[0].message,/opposite layer orders/);
});
test('large prompts report incomplete coverage and avoid exponential branch enumeration',()=>{
 assert.equal(reviewClothing('skirt,'.repeat(6000)).incomplete,true);
 const text=Array.from({length:120},()=>'{shirt|jacket}').join(', ')+', {skirt|pants}';
 const result=reviewClothing(text);assert.equal(result.incomplete,true,'pair work is bounded');
 assert.equal(result.findings.length,0);
});
