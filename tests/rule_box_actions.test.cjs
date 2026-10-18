const {test}=require('node:test');const assert=require('node:assert/strict');const {load}=require('./ts_loader.cjs');
const {hasActiveRuleset,insertRuleBox,patchRuleBox}=load('RuleBoxActions');
const box=(id='a',changes={})=>({id,definition:{id:'pose',name:'Pose',family:'pose'},scope:'main',origin:'encoder',enabled:true,collapsed:false,preferences:{posture:'sitting'},...changes});
test('adding an active definition is blocked even with a different card ID',()=>{
 const rows=[box()];assert(hasActiveRuleset(rows,'pose'));assert.equal(insertRuleBox(rows,box('new')),rows);
 assert(hasActiveRuleset([box('inherited',{origin:'prefix'})],'pose'));
});
test('adding a disabled definition reuses its card and preferences',()=>{
 const result=insertRuleBox([box('old',{enabled:false})],box('new'));
 assert.equal(result.length,1);assert.equal(result[0].id,'old');assert.equal(result[0].enabled,true);assert.equal(result[0].preferences.posture,'sitting');
});
test('explicit override upgrades the existing local default once',()=>{
 const result=insertRuleBox([box('global',{origin:'global'})],box('new'),true);
 assert.equal(result.length,1);assert.equal(result[0].id,'global');assert.equal(result[0].origin,'encoder');assert.equal(insertRuleBox(result,box('again'),true),result);
});
test('enabling or moving a card prevents active duplicates in that channel',()=>{
 const rows=[box('old'),box('new',{enabled:false})];
 assert.deepEqual(patchRuleBox(rows,'new',{enabled:true}).map(row=>row.enabled),[false,true]);
 assert.deepEqual(patchRuleBox([box('old'),box('extra',{scope:'experiment'})],'extra',{scope:'main'}).map(row=>row.enabled),[false,true]);
});
test('separate channels and distinct rulesets remain available',()=>{
 assert(!hasActiveRuleset([box('extra',{scope:'experiment'})],'pose'));
 assert.equal(insertRuleBox([box('extra',{scope:'experiment'})],box()).length,2);
 assert(!hasActiveRuleset([box()],'hair'));
});

test('an older disabled copy cannot bypass an already active copy',()=>{
 const rows=[box('disabled',{enabled:false}),box('active')];assert.equal(insertRuleBox(rows,box('new')),rows);
});
