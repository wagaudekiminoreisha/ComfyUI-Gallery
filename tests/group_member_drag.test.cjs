const {test}=require('node:test'),assert=require('node:assert/strict'),{load}=require('./ts_loader.cjs');const B=load('PromptBoxes'),{dropPromptChip}=load('PromptDrag');
test('a group member moves within an editor while its behavior and remaining members survive',()=>{
 const group=B.parsePrompt('{red hair, blue eyes|}')[0],a=B.emptyGroup('A',[group]),b=B.emptyGroup('B',[]),state={version:1,boxes:[a,b]};
 const member={...group,id:'member',options:['red hair'],memberOf:{chipId:group.id,text:'red hair'}};
 const moved=dropPromptChip(state,member,b.id);assert.equal(B.compileChip(moved.boxes[0].chips[0]),'{blue eyes|}');assert.equal(B.compileChip(moved.boxes[1].chips[0]),'{red hair|}');assert.equal(moved.boxes[1].chips[0].memberOf,undefined);
 const copied=dropPromptChip({version:1,boxes:[b]},member,b.id);assert.equal(copied.boxes[0].chips.length,1);assert.equal(state.boxes[0].chips[0].options[0],'red hair, blue eyes');
});
