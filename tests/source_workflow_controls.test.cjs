const {test}=require('node:test'),assert=require('node:assert/strict'),{load}=require('./ts_loader.cjs');
const B=load('PromptBoxes'),C=load('SourceConnections'),S=load('SourceSessionEdits'),D=load('SourceRecipeDefaults'),G=load('SourceSelectionGroups');
test('wires create source cards, disconnects hide them and reconnects restore their edits',()=>{
 const source={...B.sourceBox(),replacements:{a:'b'}},manual=B.emptyGroup('Manual',B.parsePrompt('smile')),state={version:1,boxes:[source,manual]};
 const off=C.reconcileSourceConnections(state,[]);assert.deepEqual(off.state.boxes,[manual]);assert.deepEqual(off.cache.source_text.box,source);
 const on=C.reconcileSourceConnections(off.state,['source_text','source_text_2'],off.cache);assert.deepEqual(on.state.boxes[0],source);assert.equal(on.state.boxes.filter(box=>box.kind==='source').length,2);assert.equal(Object.keys(on.cache).length,0);
 assert.strictEqual(C.reconcileSourceConnections(on.state,['source_text','source_text_2'],on.cache).state,on.state);
});
test('manual box merging preserves nested chips, order and disabled ingredients without touching sources',()=>{
 const a=B.emptyGroup('A',B.parsePrompt('{red|blue|}')),b={...B.emptyGroup('B',B.parsePrompt('(smile:1.2)')),enabled:false},source=B.sourceBox(),state={version:1,boxes:[a,source,b]};
 const result=B.mergeManualBoxes(state,a.id,b.id);assert.equal(result.boxes.length,2);assert.strictEqual(result.boxes[1],source);assert.equal(result.boxes[0].chips[1].enabled,false);assert.equal(result.boxes[0].chips[0].options.length,2);
 assert.strictEqual(B.mergeManualBoxes(state,a.id,source.id),state);
 assert.equal(B.canMergeManualBox({...a,prefixId:'identity'}),false);
});
test('a new server session clears source-local edits with a restorable backup and keeps source filters',()=>{
 const source={...B.sourceBox(),categoryExclusions:['pose'],excluded:['blue eyes'],replacements:{a:'b'}},manual=B.emptyGroup('Manual'),state={version:1,boxes:[source,manual]};
 assert.strictEqual(S.resetSourceSessionEdits(state,'same','same',['source_text']).state,state);
 assert.strictEqual(S.resetSourceSessionEdits(state,undefined,'new',['source_text']).state,state);
 const reset=S.resetSourceSessionEdits(state,'old','new',['source_text']);assert.equal(reset.state.boxes[0].excluded,undefined);assert.deepEqual(reset.state.boxes[0].categoryExclusions,['pose']);assert.deepEqual(reset.backup,[source]);assert.strictEqual(reset.state.boxes[1],manual);
});
test('prefix is the default, session choices expire on restart/image change, and persistent opt-in is per image',()=>{
 const id='policy-qa',snapshot='s',keys=['sha256:a'],library={session_id:'one',version:2,prefixes:[],tags:[],snapshots:{s:{id:'s',prefix_id:id}},associations:{'sha256:a':{prefix_id:id,prefer_snapshots:[id]}}};
 const plain={...library,associations:{}};assert.equal(D.defaultSourceRecipe(plain,id,keys,[snapshot]),undefined);
 D.rememberSourceRecipe(plain,id,keys,snapshot);assert.equal(D.defaultSourceRecipe(plain,id,keys,[snapshot]),snapshot);
 assert.equal(D.defaultSourceRecipe({...plain,session_id:'two'},id,keys,[snapshot]),undefined);
 assert.equal(D.defaultSourceRecipe(plain,id,['sha256:b'],[snapshot]),undefined);
 assert.equal(D.defaultSourceRecipe({...library,session_id:'two'},id,keys,[snapshot]),snapshot);
 D.rememberSourceRecipe(plain,id,['sha256:b'],null);assert.equal(D.defaultSourceRecipe(plain,id,keys,[snapshot]),undefined);
});
test('arrival and manual groups retain memberships across serialization and restore complete batches',()=>{
 const images=['a','b','c'].map(input_name=>({input_name}));
 let groups=G.recordSourceGroup([],images.slice(0,2));groups=G.recordSourceGroup(groups,images.slice(0,2));assert.equal(groups.length,1);
 groups=G.recordSourceGroup(groups,[images[1],images[2]],'Pose A','manual');
 const restored=JSON.parse(JSON.stringify(groups));assert.deepEqual(G.sourceSelectionGroups(images,restored,'manual')[0].images.map(image=>image.input_name),['b','c']);
 assert.equal(G.sourceSelectionGroups(images,restored,'arrivals')[0].images.length,2);
 const refs=images.map((image,index)=>({...image,metadata:{gallery_prefix:{id:index<2?'same':'other',name:index<2?'Same':'Other'}}}));
 assert.equal(G.sourceSelectionGroups(refs,[],'prefix').length,2);
});
