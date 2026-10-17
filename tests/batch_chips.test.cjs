const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load}=require('./ts_loader.cjs');
const {emptyGroup,parsePrompt,compileBoxes,parseState,formatSelectedChips,addChips}=load('PromptBoxes');
const stateOf=text=>({version:1,boxes:[emptyGroup('Tags',parsePrompt(text))]});
const {convertBoxContents}=load('BatchTagBlacklist');

test('adding optional syntax in each mode does not add another wrapper',()=>{
 const {groupChips,compileChip}=load('PromptBoxes');
 assert.deepEqual(groupChips('each',['{sidelocks|}', '(blue hair:1.2)', 'long hair, short hair']).map(compileChip),['{sidelocks|}','{(blue hair:1.2)|}','{long hair|}','{short hair|}']);
});

test('contents conversion needs no selection and matches selecting every chip',()=>{
 const state=stateOf('long hair, sidelocks, (blue hair:1.2), hidden');
 const box=state.boxes[0];box.chips.at(-1).enabled=false;
 const direct=convertBoxContents(state,box.id,[],[],'each');
 const selected=convertBoxContents(state,box.id,box.chips.map(chip=>chip.id),[],'each');
 assert.equal(compileBoxes(direct),'{long hair|}, {sidelocks|}, {(blue hair:1.2)|}');
 assert.equal(compileBoxes(selected),compileBoxes(direct));
 assert.equal(direct.boxes[0].chips.at(-1).enabled,false);
 assert.equal(compileBoxes(convertBoxContents(direct,box.id,[],[],'each')),compileBoxes(direct),'reapplying must not nest optional wrappers');
});

test('legacy each boxes do not double-wrap already optional tags',()=>{
 const state=stateOf('{sidelocks|}, {(blue hair:1.2)|}, plain');const box=state.boxes[0];box.format='each';
 assert.equal(compileBoxes(state),'{sidelocks|}, {(blue hair:1.2)|}, {plain|}');
 assert.equal(compileBoxes(addChips(state,box.id,'{long hair|}')),'{sidelocks|}, {(blue hair:1.2)|}, {plain|}, {long hair|}');
 assert.equal(compileBoxes(parseState(JSON.parse(JSON.stringify(state)))).replace(/, ⟦source⟧$/,''),compileBoxes(state));
 assert.equal(load('PromptBoxes').reconcileText(state,'{{sidelocks|}|}, {{(blue hair:1.2)|}|}, {plain|}','boxes',false),state);
});

test('an explicit each conversion replaces legacy grouping with independent optional leaves',()=>{
 const state=stateOf('{long hair|short hair}, sidelocks, (blue hair:1.2)');
 const box=state.boxes[0];box.format='each';
 const before=compileBoxes(state);
 assert.equal(before,'{{long hair|short hair}|}, {sidelocks|}, {(blue hair:1.2)|}');
 const after=convertBoxContents(state,box.id,[],[],'each');
 assert.equal(after.boxes[0].format,undefined);
 assert.equal(compileBoxes(after),'{long hair|}, {short hair|}, {sidelocks|}, {(blue hair:1.2)|}');
 assert.equal(compileBoxes(state),before,'loading/inspecting the old workflow must not rewrite it');
});

test('contents conversion respects the same protected tags as select all',()=>{
 const state=stateOf('sidelocks, (blue hair:1.2), protected');const box=state.boxes[0];
 const direct=convertBoxContents(state,box.id,[],['protected'],'each');
 const selected=convertBoxContents(state,box.id,box.chips.map(chip=>chip.id),['protected'],'each');
 assert.equal(compileBoxes(direct),'{sidelocks|}, {(blue hair:1.2)|}, protected');
 assert.equal(compileBoxes(selected),compileBoxes(direct));
});
test('box format wraps chips, persists and applies to later additions without rewriting weights',()=>{
 const state=stateOf('a, (b:1.2), [c]'), box=state.boxes[0];box.format='alternatives';
 assert.equal(compileBoxes(state),'{a|(b:1.2)|[c]}');
 assert.equal(compileBoxes(addChips(state,box.id,'d')),'{a|(b:1.2)|[c]|d}');
 const restored=parseState(JSON.parse(JSON.stringify(state)));assert.equal(restored.boxes[0].format,'alternatives');
 box.format='tag';assert.equal(compileBoxes(state),'a, (b:1.2), [c]');
 box.format='group';assert.equal(compileBoxes(state),'{a, (b:1.2), [c]|}');
 box.format='each';assert.equal(compileBoxes(state),'{a|}, {(b:1.2)|}, {[c]|}');
 box.chips.forEach(c=>c.enabled=false);assert.equal(compileBoxes(state),'');
});
test('selection conversion preserves unselected chips, weights and disabled selections',()=>{
 const state=stateOf('a, untouched, (b:1.4), c');state.boxes[0].chips[3].enabled=false;
 const box=state.boxes[0], ids=[box.chips[0].id,box.chips[2].id,box.chips[3].id];
 const converted=formatSelectedChips(state,box.id,ids,'alternatives');
 assert.equal(compileBoxes(converted),'{a|(b:1.4)}, untouched');
 assert.equal(converted.boxes[0].chips.at(-1).enabled,false);
 const unpacked=formatSelectedChips(converted,box.id,[converted.boxes[0].chips[0].id],'tag');
 assert.equal(compileBoxes(unpacked),'a, (b:1.4), untouched');
});
test('batch splitting distributes a grouped weight and does not enable disabled tags',()=>{
 const state=stateOf('({a|b}:1.3)');const box=state.boxes[0];
 const next=formatSelectedChips(state,box.id,[box.chips[0].id],'tag');
 assert.equal(compileBoxes(next),'(a:1.3), (b:1.3)');
});
