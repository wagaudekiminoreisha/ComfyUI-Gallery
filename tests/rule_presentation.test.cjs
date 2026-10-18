const {test}=require('node:test');const assert=require('node:assert/strict');const {load}=require('./ts_loader.cjs');
const {describeRule}=load('RulePresentation');const {applyRulePreview}=load('RuleEngine');
test('logical display matches selection effects on weighted and optional template tags',()=>{
 const rule={op:'select',tags:['long hair','short hair'],value:'short hair'},text='(long_hair:1.2), {long hair|blue eyes}';
 const saved=JSON.stringify(rule),description=describeRule(rule,text);
 assert.deepEqual(description.matched,['long_hair']);assert.deepEqual(description.removed,['long_hair']);assert.deepEqual(description.added,['short_hair']);
 const box={id:'test',origin:'encoder',scope:'main',enabled:true,preferences:{},definition:{version:1,id:'test',name:'test',family:'hair',rules:[rule],choices:[]}};
 assert(!applyRulePreview(text,[box]).text.includes('long'));assert.equal(JSON.stringify(rule),saved);
});
test('Protect describes batch protection without generation removals',()=>{
 const description=describeRule({op:'protect',tags:['hair bow']},'hair_bow, long hair');
 assert.equal(description.expression,'B′ = B ∖ S');assert.deepEqual(description.matched,['hair_bow']);assert.deepEqual(description.removed,[]);assert.deepEqual(description.added,[]);
});
test('conditional notation keeps the condition separate from the affected tag set',()=>{
 const description=describeRule({op:'exclude',tags:['standing'],if_all:['solo']},'{standing|sitting}, solo');
 assert.deepEqual(description.condition,['solo']);assert.deepEqual(description.pool,['standing']);assert(description.expression.startsWith('C ⊆ T ⇒'));
});
