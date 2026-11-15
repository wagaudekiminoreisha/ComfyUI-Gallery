const {test}=require('node:test');const assert=require('node:assert/strict');const {load}=require('./ts_loader.cjs');
const B=load('PromptBoxes'),{sourceExclusionPayload,filteredSourceText}=load('SourceExclusions');
test('named source cards compose in card order, with isolated omissions and labels',()=>{
 let state=B.addSourceBox(B.stateFromText('style'),'source_text_2');
 const second=state.boxes.find(box=>box.input==='source_text_2');
 state=B.updateBox(state,second.id,{name:'Appearance',excluded:['blue eyes']});
 assert.equal(B.composeWithSource(B.compileBoxes(state),undefined,{source_text:'blue eyes, standing',source_text_2:'blue eyes, blonde hair'}),'style, blue eyes, standing, blonde hair');
 const restored=B.parseState(JSON.parse(JSON.stringify(state)));
 assert.equal(restored.boxes.find(box=>box.input==='source_text_2').name,'Appearance');
 assert.equal(B.compileBoxes(restored),B.compileBoxes(state));
 const without=B.removeBox(restored,second.id);assert(!without.boxes.some(box=>box.input==='source_text_2'));
});
test('text-only round trips retain several source markers and positions',()=>{
 const text='a, ⟦source:source_text_2⟧, b, ⟦source -["removed"]⟧, c';
 assert.equal(B.compileBoxes(B.stateFromText(text)),text);
 assert.equal(B.composeWithSource(text,'removed, kept',{source_text:'removed, kept',source_text_2:'other'}),'a, other, b, kept, c');
 assert.equal(B.composeWithSource('⟦source:source_text_2⟧','legacy'),'');
});
test('duplicate source cards are discarded, up to eight inputs survive, and legacy input stays stable',()=>{
 let state=B.stateFromText('');for(let i=0;i<12;i++)state=B.addSourceBox(state);
 assert.equal(state.boxes.filter(box=>box.kind==='source').length,8);
 assert.equal(B.addSourceBox(state),state);
 const parsed=B.parseState({version:1,boxes:[...state.boxes,{kind:'source',input:'source_text_2'},{kind:'source',input:'unknown'}]});
 assert.equal(parsed.boxes.filter(box=>box.kind==='source').length,8);
 assert.equal(parsed.boxes.filter(box=>box.kind==='source'&&!box.input).length,1);
});
test('identical image keys in different source cards never share tag edits',()=>{
 const segment={key:'same.png:positive',name:'same.png',text:'blue eyes, blonde hair'};
 const first={...B.sourceBox(),excludedBySource:{[segment.key]:['blue eyes']}};
 const second=B.sourceBox('source_text_2');
 assert.equal(filteredSourceText(first,[segment]),'blonde hair');
 assert.equal(filteredSourceText(second,[segment]),segment.text);
 assert.deepEqual(sourceExclusionPayload(second,[segment]),{});
});
