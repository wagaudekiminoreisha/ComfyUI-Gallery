const {test}=require('node:test'),assert=require('node:assert/strict'),{load}=require('./ts_loader.cjs');
const R=load('RuleEngine'),definitions=require('../data/prompt-rulesets.json').definitions;
const box=(id,origin,preferences={},scope='main')=>({id:origin+id,definition:definitions.find(row=>row.id===id),origin,preferences,scope,enabled:true,collapsed:false});
test('a lower-body override preserves upper and accessory settings of a legacy global attire box',()=>{
 const broad=box('stock-attire-styling','global',{base:'blouse',outer:'cardigan',headwear:'beret'});
 const lower=box('stock-attire-lower','encoder',{bottoms:'layered'});
 const result=R.applyRulePreview('jeans, skirt',[broad,lower]);assert.deepEqual(result.errors,[]);
 for(const tag of ['blouse','cardigan','beret'])assert.ok(result.text.includes(tag));
 assert.ok(R.activeRuleBoxes([broad,lower]).includes(broad));
 assert.ok(!R.activeRuleChannels(broad,[broad,lower]).includes('attire-lower'));
 assert.ok(R.applyRulePreview('jeans, track pants, skirt',[broad,lower]).errors.length);
 assert.ok(R.applyRulePreview('jeans, skirt',[broad,{...lower,enabled:false}]).errors.length);
 assert.ok(R.applyRulePreview('jeans, skirt',[broad,{...lower,scope:'independent'}]).errors.length);
});
test('upper-body policies override only base and outer; lower recipes retain their original semantics',()=>{
 const broad=box('stock-attire-styling','global',{base:'blouse',outer:'coat',bottoms:'skirt-track'});
 const upper=box('stock-attire-upper','encoder',{base:'shirt',outer:'cardigan'});
 const result=R.applyRulePreview('jeans, hat',[broad,upper]);assert.deepEqual(result.errors,[]);
 for(const tag of ['shirt','cardigan','skirt','track_pants'])assert.ok(result.text.includes(tag));
 assert.ok(!result.text.includes('blouse'));assert.ok(!result.text.includes('coat'));assert.ok(!result.text.includes('jeans'));
});
test('snapshot projection cannot resurrect overridden preference channels when origin changes',()=>{
 const broad=box('stock-attire-styling','prefix',{base:'blouse',bottoms:'jeans'}),lower=box('stock-attire-lower','encoder',{bottoms:'layered'});
 const copied=R.effectiveRuleBoxes([broad,lower]).map(box=>({...box,origin:'snapshot'}));
 assert.deepEqual(R.applyRulePreview('jeans, skirt',copied).errors,[]);
 assert.ok(!copied[0].definition.choices.some(choice=>choice.id==='bottoms'));
 assert.ok(!Object.hasOwn(copied[0].preferences,'bottoms'));
 assert.ok(broad.definition.choices.some(choice=>choice.id==='bottoms'));
});
test('custom preference channels and same-rank conflicts remain explicit',()=>{
 const custom=box('stock-eyes','global',{colour:'blue_eyes'}),override=box('stock-eyes','encoder',{colour:'green_eyes'});
 assert.equal(R.applyRulePreview('',[custom,override]).text,'green_eyes');
 const d={version:1,id:'custom',family:'custom',name:'Custom',rules:[],choices:[{id:'x',label:'X',channel:'eyes',default:'x',options:[{id:'x',label:'X',rules:[{op:'require',tags:['smile']}]}]}]};
 const result=R.applyRulePreview('',[custom,{...override,definition:d}]);assert.equal(result.text,'smile');
 const a=box('stock-attire-styling','encoder'),b=box('stock-attire-lower','encoder',{bottoms:'layered'});
 assert.ok(R.applyRulePreview('jeans, skirt',[a,b]).errors.length);
});
