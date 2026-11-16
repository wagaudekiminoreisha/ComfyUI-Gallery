const {test}=require('node:test'),assert=require('node:assert/strict');const {load}=require('./ts_loader.cjs');
const {snapshotRuleBoxes,privateRuleBoxes,inheritedRuleKey,selectedInheritedRules}=load('InheritedRules');
const {parseState,reconcileText}=load('PromptBoxes');const {applyRulePreview}=load('RuleEngine');
const box=(id,origin='snapshot',scope='main')=>({id,origin,scope,definition:{version:1,id,name:id,family:id,rules:[{op:'exclude',tags:[id]}],choices:[]},preferences:{},enabled:true,collapsed:false});
const global=box('global','global'),old=box('old'),custom=box('custom');
const library={version:1,definitions:[],globals:[global],prefixes:{}};
test('cleared snapshot attachments override historical captured rules, including an empty list',()=>{
 const snapshot={id:'s',rules:[old,global]};
 assert.deepEqual(snapshotRuleBoxes(snapshot,library),[old]);
 assert.deepEqual(snapshotRuleBoxes(snapshot,{...library,prefixes:{'snapshot:s':[]}}),[]);
 assert.deepEqual(snapshotRuleBoxes(snapshot,{...library,prefixes:{'snapshot:s':[custom]}}),[custom]);
});
test('snapshot/prefix attachments cannot promote captured globals into visible inherited cards',()=>{
 assert.deepEqual(snapshotRuleBoxes({id:'s',rules:[]},{...library,prefixes:{'snapshot:s':[global,custom]}}),[custom]);
 assert.deepEqual(privateRuleBoxes([{...global,origin:'snapshot'},custom],library),[custom]);
 // Adding a globally available definition manually creates a separate card.
 const manual={...global,id:'manual',origin:'encoder'};assert.deepEqual(privateRuleBoxes([manual],library),[manual]);
});
test('ignored inherited rules persist across workflow reload and new snapshot identities',()=>{
 const key=inheritedRuleKey('prefix',old);
 const saved=parseState(JSON.parse(JSON.stringify({version:1,boxes:[],excludedInheritedRules:[key,key,null]})));
 assert.deepEqual(saved.excludedInheritedRules,[key]);
 assert.deepEqual(reconcileText(saved,'new prompt','after',true).excludedInheritedRules,[key]);
 const candidates=[{...old,id:'snapshot:new:old',inheritanceKey:key},{...custom,inheritanceKey:inheritedRuleKey('prefix',custom)},
  {...old,id:'other-prefix',inheritanceKey:inheritedRuleKey('other',old)},
  {...old,id:'other-channel',scope:'portrait',inheritanceKey:inheritedRuleKey('prefix',{...old,scope:'portrait'})}];
 assert.deepEqual(selectedInheritedRules(candidates,saved.excludedInheritedRules).map(row=>row.id),['custom','other-prefix','other-channel']);
 assert.equal(selectedInheritedRules(candidates,[]).length,4);
 assert.deepEqual(selectedInheritedRules([{...old,origin:'prefix',inheritanceKey:key}],saved.excludedInheritedRules),[]);
});
test('ignoring source rules retains current globals and explicit encoder overrides',()=>{
 const inherited={...old,inheritanceKey:inheritedRuleKey('prefix',old)};
 const active=[global,...selectedInheritedRules([inherited],[inherited.inheritanceKey])];
 assert.equal(applyRulePreview('global, old, keep',active).text,'old, keep');
 assert.deepEqual(selectedInheritedRules([global]),[]);
});
