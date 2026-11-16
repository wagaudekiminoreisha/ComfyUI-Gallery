const {test}=require('node:test'),assert=require('node:assert/strict');const {load}=require('./ts_loader.cjs');
const {quickSelectionClick,SELECTION_DOUBLE_CLICK_MS}=load('GalleryClick');
test('viewer selection requires a fast genuine double-click on the same image',()=>{
 const first={id:'a',at:1000};
 assert.equal(quickSelectionClick(undefined,first,1),false);
 assert.equal(quickSelectionClick(first,{id:'a',at:1100},2),true);
 assert.equal(quickSelectionClick(first,{id:'a',at:1000+SELECTION_DOUBLE_CLICK_MS},2),true);
 assert.equal(quickSelectionClick(first,{id:'a',at:1001+SELECTION_DOUBLE_CLICK_MS},2),false);
 assert.equal(quickSelectionClick(first,{id:'b',at:1010},2),false);
 assert.equal(quickSelectionClick(first,{id:'a',at:1010},1),false);
 assert.equal(quickSelectionClick(first,{id:'a',at:1010},3),false);
 assert.equal(quickSelectionClick(first,{id:'a',at:999},2),false);
});
