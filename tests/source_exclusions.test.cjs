const {test}=require('node:test');const assert=require('node:assert/strict');const {load}=require('./ts_loader.cjs');
const {exclusionsFor,bindLegacySourceExclusions,sourceExclusionPayload,filteredSourceText}=load('SourceExclusions');const {parseState}=load('PromptBoxes');
const a={key:'a.png:positive',name:'a.png',text:'blue eyes, blonde hair'},b={key:'b.png:positive',name:'b.png',text:'blue eyes, long hair'};
const box={id:'s',kind:'source',enabled:true,collapsed:false,excludedBySource:{[a.key]:['blue eyes']}};
test('switching sources does not transfer omitted tags and switching back restores them',()=>{
 assert.deepEqual(exclusionsFor(box,a),['blue eyes']);assert.deepEqual(exclusionsFor(box,b),[]);assert.deepEqual(exclusionsFor(box,a),['blue eyes']);
 assert.deepEqual(exclusionsFor(box,{...a,key:'a.png:negative'}),[]);
});
test('batch preview and execution payload keep identical tags from other images',()=>{
 assert.equal(filteredSourceText(box,[a,b]),'blonde hair, blue eyes, long hair');
 const payload=sourceExclusionPayload(box,[a,b]);assert.deepEqual(payload.segments.map(row=>row.excluded),[['blue eyes'],[]]);
 assert.deepEqual(sourceExclusionPayload({...box,enabled:false},[a,b]),{});
});
test('workflow save and reload preserve per-image exclusions',()=>{
 const state=parseState(JSON.parse(JSON.stringify({version:1,boxes:[box]})));
 assert.deepEqual(state.boxes[0].excludedBySource,box.excludedBySource);
});
test('old shared exclusions bind once to the currently visible image',()=>{
 const state=bindLegacySourceExclusions({version:1,boxes:[{...box,excludedBySource:undefined,excluded:['blue eyes']}]},[a]);
 assert.equal(state.boxes[0].excluded,undefined);assert.deepEqual(exclusionsFor(state.boxes[0],a),['blue eyes']);assert.deepEqual(exclusionsFor(state.boxes[0],b),[]);
 assert.equal(bindLegacySourceExclusions(state,[b]),state);
});
test('group edits are isolated per image, survive reload, and reach preview and execution',()=>{
 const group='{blue eyes|green eyes}',edited='({blue eyes|hazel eyes|}:1.3)';
 const first={...a,text:group+', blonde hair'},second={...b,text:group+', long hair'};
 const editedBox={...box,excludedBySource:{},replacementsBySource:{[a.key]:{[group]:edited}}};
 const saved=parseState(JSON.parse(JSON.stringify({version:1,boxes:[editedBox]}))).boxes[0];
 assert.equal(filteredSourceText(saved,[first,second]),edited+', blonde hair, '+group+', long hair');
 const payload=sourceExclusionPayload(saved,[first,second]);
 assert.deepEqual(payload.segments[0].replacements,{[group]:edited});
 assert.equal(payload.segments[1].replacements,undefined);
 assert.equal(filteredSourceText(saved,[second]),second.text);
 assert.equal(filteredSourceText({...saved,replacementsBySource:{}},[first]),first.text);
});
test('unsegmented sources carry edits without replacing unrelated live source tags',()=>{
 const editedBox={...box,replacements:{'{a|b}':'{a|c}'}};
 assert.deepEqual(sourceExclusionPayload(editedBox),{replacements:{'{a|b}':'{a|c}'}});
 assert.equal(filteredSourceText(editedBox,undefined,'{a|b}, live tag'),'{a|c}, live tag');
 assert.equal(filteredSourceText(editedBox,undefined,'different group, live tag'),'different group, live tag');
});
