const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load}=require('./ts_loader.cjs');
const {fitPopup,suggestionPlacement}=load('PopupGeometry');
test('measured context menus stay inside every viewport edge, including oversized menus',()=>{
 for(const viewport of [{width:360,height:480},{width:1280,height:720}])for(const point of [{x:-100,y:-50},{x:0,y:0},{x:viewport.width,y:viewport.height}])for(const size of [{width:210,height:90},{width:2000,height:1500}]){
  const box=fitPopup(point,size,viewport);
  assert(box.left>=8&&box.top>=8);
  assert(box.left+box.width<=viewport.width-8&&box.top+box.height<=viewport.height-8);
 }
});
test('autocomplete flips upward, clamps width and fits within available vertical room',()=>{
 for(const viewport of [{width:360,height:480},{width:850,height:650}])for(const anchor of [{left:viewport.width-50,top:30,bottom:60,width:400},{left:15,top:viewport.height-40,bottom:viewport.height-10,width:120},{left:15,top:110,bottom:140,width:120}]){
  const box=suggestionPlacement(anchor,viewport);
  assert(box.left>=8&&box.left+box.width<=viewport.width-8);
  const top=box.top??viewport.height-box.bottom-box.maxHeight;
  assert(top>=8&&top+box.maxHeight<=viewport.height-8);
 }
 assert.equal(suggestionPlacement({left:0,top:450,bottom:475,width:120},{width:360,height:480}).top,undefined);
});
