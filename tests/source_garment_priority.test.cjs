const {test}=require('node:test'),assert=require('node:assert/strict'),{load}=require('./ts_loader.cjs');
const {prioritizeSourceGarments}=load('SourceGarmentPriority');
const definition=require('../data/prompt-rulesets.json').definitions.find(row=>row.id==='stock-attire-lower');
const run=(manual,source='t-shirt, blue_shirt',rules=[])=>prioritizeSourceGarments([{text:manual},{text:source,source:true}],rules);
test('guaranteed source clothes prune competing types and colours while retaining compatible details',()=>{
 const result=run('{blouse|red_shirt|bra|necklace|torn_clothes|jacket|}');
 assert.equal(result.rows[0].text,'{bra|necklace|torn_clothes|jacket|}');assert.equal(result.rows[1].text,'t-shirt, blue_shirt');assert.deepEqual(result.errors,[]);
 assert.equal(run('{sleeveless_shirt|midriff|shirt_lift|floral_print|}').rows[0].text,'{sleeveless_shirt|midriff|shirt_lift|floral_print|}');
 assert.equal(run('({blouse|jacket|}:1.2)').rows[0].text,'({jacket|}:1.2)');
});
test('required alternatives choose source-owned outfits and keep their coupled modifiers',()=>{
 assert.equal(run('{blouse|t-shirt|skirt}').rows[0].text,'');
 assert.equal(run('{t-shirt, torn_clothes|blouse, necklace|skirt}').rows[0].text,'torn_clothes');
 assert.equal(run('{blouse|sweater}').errors.length,1);
 assert.equal(run('{{blouse|sweater}|necklace|}').rows[0].text,'{necklace|}');
 assert.deepEqual(run('{{blouse|sweater}|necklace|}').errors,[]);
});
test('source alternatives and explicit manual AND terms are not silently rewritten',()=>{
 assert.equal(run('{sweater|jacket|}','{t-shirt|blouse}').rows[0].text,'{sweater|jacket|}');
 assert.equal(run('blouse, necklace').rows[0].text,'blouse, necklace');
});
test('lower-body layering follows the configured lower policy',()=>{
 const manual='{skirt|track_pants|necklace|}',source='jeans';
 assert.equal(run(manual,source).rows[0].text,'{necklace|}');
 const box={id:'lower',definition,origin:'encoder',scope:'main',enabled:true,collapsed:false,preferences:{bottoms:'layered'}};
 assert.equal(run(manual,source,[box]).rows[0].text,'{skirt|necklace|}');
});
