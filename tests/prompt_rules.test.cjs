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
