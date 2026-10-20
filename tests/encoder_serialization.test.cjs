const {test}=require('node:test');const assert=require('node:assert/strict');const {load}=require('./ts_loader.cjs');
const {ENCODER_WIDGETS,encoderWidgetValues,migrateEncoderWorkflow,orderEncoderWidgets,registerEncoderConstructor,installEncoderSerialization}=load('EncoderSerialization');
const hair=mode=>JSON.stringify({mode,attributes:['length'],singleColour:false});
const rule={id:'r',definition:{id:'pose',name:'Pose'},enabled:true};
test('both reported hair values migrate out of the source mode position',()=>{
 for(const mode of ['natural','specific']){
  const info={type:'GalleryPromptEncode',widgets_values:['smile',hair(mode),'[]','[]','{}','boxes'],properties:{prompt_boxes:{version:1,boxes:[]}}};
  const graph={nodes:[info]};migrateEncoderWorkflow(graph);
  assert.equal(info.widgets_values[1],'boxes');assert.equal(JSON.parse(info.widgets_values[2]).mode,mode);
  assert.equal(info.widgets_values[0],'smile');assert.equal(info.properties.gallery_encoder_legacy_widgets[1],hair(mode));
  const saved=JSON.stringify(graph);migrateEncoderWorkflow(graph);assert.equal(JSON.stringify(graph),saved);
 }
});
test('current rules, snapshots and source omissions do not shift or overwrite each other',()=>{
 const refs=[{prefix_id:'p',snapshot_id:null}],omissions={segments:[{key:'a:positive',text:'smile',excluded:['smile']}]};
 const values=encoderWidgetValues({widgets_values:['smile','boxes',hair('minimal'),JSON.stringify([rule]),JSON.stringify(refs),JSON.stringify(omissions)]});
 assert.deepEqual(JSON.parse(values.rules_state),[rule]);assert.deepEqual(JSON.parse(values.prefix_snapshots),refs);assert.deepEqual(JSON.parse(values.source_image_exclusions),omissions);
 assert.deepEqual(JSON.parse(encoderWidgetValues({widgets_values:['smile','boxes',hair('specific'),JSON.stringify([rule]),'[]']}).rules_state),[rule]);
});
test('named values win over future position changes and invalid named combo data is rejected',()=>{
 const info={widgets_values:['old',hair('natural')],properties:{gallery_encoder_widgets:{version:1,values:{text:'correct',source_mode:'before',hair_policy:hair('minimal')}}}};
 const values=encoderWidgetValues(info);assert.equal(values.text,'correct');assert.equal(values.source_mode,'before');assert.equal(JSON.parse(values.hair_policy).mode,'minimal');
 info.properties.gallery_encoder_widgets.values.source_mode=hair('natural');assert(['after','before','replace','boxes'].includes(encoderWidgetValues(info).source_mode));
});
test('a literal prompt resembling a combo choice is not mistaken for source mode',()=>{
 assert.equal(encoderWidgetValues({widgets_values:['before',hair('natural')]}).text,'before');assert.equal(encoderWidgetValues({widgets_values:['before',hair('natural')]}).source_mode,'after');
});
test('constructor normalizes widget order before positional values or combo validation run',()=>{
 class Node{constructor(){this.widgets=[{name:'text',value:''},{name:'hair_policy',value:'{}'},{name:'rules_state',value:'[]'},{name:'source_mode',value:'after'}];}configure(info){this.properties=info.properties;this.widgets.forEach((w,i)=>w.value=info.widgets_values[i]);assert(['after','before','replace','boxes'].includes(this.widgets.find(w=>w.name==='source_mode').value));}}
 registerEncoderConstructor(Node);registerEncoderConstructor(Node);const node=new Node();node.configure({widgets_values:['smile',hair('natural'),'[]','boxes']});
 assert.deepEqual(node.widgets.map(w=>w.name),['text','source_mode','hair_policy','rules_state']);assert.equal(node.widgets[1].value,'boxes');assert.equal(JSON.parse(node.widgets[2].value).mode,'natural');
 installEncoderSerialization(node);const saved={};node.onSerialize(saved);assert.equal(saved.properties.gallery_encoder_widgets.values.source_mode,'boxes');
});
test('non encoder nodes, links and unrelated widget objects stay intact',()=>{
 const info={type:'Other',widgets_values:['a','b'],inputs:[{link:7}]},graph={nodes:[info]};const original=JSON.stringify(info);migrateEncoderWorkflow(graph);assert.equal(JSON.stringify(info),original);
 const node={widgets:[{name:'text',value:'smile'},{name:'button',value:null},{name:'hair_policy',value:hair('specific')},{name:'source_mode',value:'after'}]};const button=node.widgets[1];orderEncoderWidgets(node);assert.equal(node.widgets.at(-1),button);
});

test('source markers recover boxes mode when old exports omitted node properties',()=>{
 const values=encoderWidgetValues({widgets_values:['⟦source⟧',hair('natural'),'[]']});assert.equal(values.source_mode,'boxes');assert.equal(JSON.parse(values.hair_policy).mode,'natural');
});
