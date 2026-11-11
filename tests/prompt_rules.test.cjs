const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load}=require('./ts_loader.cjs');
const R=load('RuleEngine'),B=load('PromptBoxes');
const box=(rules,origin='encoder',preferences={})=>({id:Math.random()+'',definition:{version:1,id:'test',name:'Test',family:'hair',rules,choices:[]},origin,scope:'main',preferences,enabled:true,collapsed:false});
const select=value=>({op:'select',tags:['short hair','long hair'],value});
test('empty and Protect rules preserve exact prompt and saved chips',()=>{
 const text='alpha,  (long hair:1.2), beta';
 assert.equal(R.applyRulePreview(text,[]).text,text);
 const state={...B.stateFromText(text),rulesets:[box([{op:'protect',tags:['long hair']}])]};
 const saved=JSON.stringify(state);
 const result=R.applyRulePreview(text,state.rulesets);
 assert.equal(result.text,text);assert.deepEqual(result.protectedTags,['long hair']);assert.equal(JSON.stringify(state),saved);
 assert.deepEqual(B.parseState(JSON.parse(saved)).rulesets,state.rulesets);
});
test('encoder overrides prefix and global by family and scope, independent of box order',()=>{
 const rows=[box([select('long hair')],'global'),box([select('long hair')],'prefix'),box([select('short hair')])];
 for(const boxes of [rows,[...rows].reverse()])assert.deepEqual(R.applyRulePreview('long hair, blue eyes',boxes),{text:'blue eyes, short hair',errors:[],notes:[],protectedTags:[]});
 rows[2].enabled=false;assert.equal(R.applyRulePreview('blue eyes',rows).text,'blue eyes, long hair');
});
test('equal-level and different-scope contradictions are explicit, never silently ordered',()=>{
 const a=box([select('short hair')]),b=box([select('long hair')]);
 assert(R.applyRulePreview('blue eyes',[a,b]).errors.length);
 b.scope='other';assert(R.applyRulePreview('blue eyes',[a,b]).errors.length);
});
test('selection removes weighted alternatives and guarantees literal choice',()=>{
 const result=R.applyRulePreview('(long hair:1.2), {short hair|blue eyes}',[box([select('short hair')])]);
 assert.equal(result.text,'{short hair|blue eyes}, short hair');assert.deepEqual(result.errors,[]);
});
test('exclusive allows OR alternatives, rejects co-active tags, conditionals wait for sampling',()=>{
 const rules=[box([{op:'exclusive',tags:['standing','sitting']}])];
 assert.deepEqual(R.applyRulePreview('{standing|sitting}',rules).errors,[]);
 assert.equal(R.applyRulePreview('standing, sitting',rules).errors.length,1);
 const conditional=[box([{op:'exclude',tags:['long hair'],if_all:['solo']}])];
 assert.equal(R.applyRulePreview('solo, long hair',conditional).text,'solo');
 assert.equal(R.applyRulePreview('{solo|2girls}, long hair',conditional).notes.length,1);
});


test('nested conditions defer optional decisions and respect AND/OR/NOT',()=>{
 const {conditionPreview}=load('RuleEngine');
 const condition={op:'all',children:[{op:'any',children:[{op:'tag',tag:'solo'},{op:'tag',tag:'1girl'}]},{op:'not',children:[{op:'tag',tag:'hat'}]}]};
 assert.equal(conditionPreview(condition,[{tag:'solo',conditions:new Map()}]),true);
 assert.equal(conditionPreview(condition,[{tag:'solo',conditions:new Map()},{tag:'hat',conditions:new Map()}]),false);
 assert.equal(conditionPreview(condition,[{tag:'solo',conditions:new Map([[1,0]])}]),undefined);
});
const handheldDefinition=require('../data/prompt-rulesets.json').definitions.find(row=>row.id==='stock-handheld-hair-interactions');
test('handheld filter is opt-in and separates hair actions, props and holding predicates',()=>{
 const definition=handheldDefinition;
 const rules={id:'handheld',definition,origin:'encoder',scope:'main',preferences:{},enabled:true,collapsed:false};
 const text='long hair, hairclip, holding own hair, knife in hair, holding pencil, blue eyes';
 assert.equal(R.applyRulePreview(text,[rules]).text,text);
 rules.preferences={'hair-actions':'omit'};
 const hairOnly=R.applyRulePreview(text,[rules]).text;
 assert(!hairOnly.includes('holding own hair'));assert(hairOnly.includes('knife in hair'));assert(hairOnly.includes('hairclip'));
 rules.preferences={'hair-actions':'omit','hair-props':'omit',holding:'omit'};
 assert.equal(R.applyRulePreview(text,[rules]).text,'long hair, hairclip, blue eyes');
 assert(R.applyRulePreview('{holding pencil|blue eyes}, long hair',[rules]).text.includes('blue eyes'));
});

test('injury and gore preview filters selected categories and keeps unrelated alternatives',()=>{
 const definition=require('../data/prompt-rulesets.json').definitions.find(row=>row.id==='stock-injury-gore-filter');
 const rules={id:'injury',definition,origin:'encoder',scope:'main',preferences:{gore:'omit',amputation:'omit'},enabled:true,collapsed:false};
 const result=R.applyRulePreview('red scarf, double amputee, (gore:1.2), {severed head|smile}, blood, prosthetic leg',[rules]);
 assert.deepEqual(result.errors,[]);
 assert.equal(result.text,'red scarf, {|smile}, blood, prosthetic leg');
});

test('per-tag exceptions follow each operation and leave conditional rules conditional',()=>{
 const rules=[
  {op:'exclude',tags:['gore','blood'],except_tags:['GORE']},
  {op:'require',tags:['hat','coat'],except_tags:['coat']},
  {op:'protect',tags:['blue_eyes','hair bow'],except_tags:['blue eyes']},
  {op:'exclusive',tags:['standing','sitting'],except_tags:['sitting']},
  {op:'exclude',tags:['fog'],except_tags:[],if_all:['indoors']},
 ];
 const result=R.applyRulePreview('gore, (blood:1.2), blue eyes, standing, sitting, fog',[box(rules)]);
 assert.equal(result.text,'gore, blue eyes, standing, sitting, fog, hat');
 assert.deepEqual(result.errors,[]);
 assert.deepEqual(result.protectedTags,['hair bow']);
 const fixed={op:'select',tags:['short hair','long hair'],value:'short hair',except_tags:['short_hair']};
 assert.equal(R.applyRulePreview('long hair',[box([fixed])]).text,'long hair');
});
