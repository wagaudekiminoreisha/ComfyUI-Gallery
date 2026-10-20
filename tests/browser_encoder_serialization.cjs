const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true});const page=await browser.newPage({viewport:{width:1400,height:1100}});const errors=[];page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(15000);
try{
 await page.goto('http://127.0.0.1:8191');await page.getByRole('tab',{name:'Gallery workspace',exact:true}).click();
 const result=await page.evaluate(()=>{
  const host=document.createElement('div');host.id='qa-serialization';host.style.cssText='position:fixed;top:0;right:0;width:650px;height:1000px;overflow:auto;z-index:5000;background:#222';document.body.append(host);
  const hair=mode=>JSON.stringify({mode,attributes:['length'],singleColour:false});
  const nodes=['natural','specific'].map((mode,index)=>({id:200+index,type:'GalleryPromptEncode',inputs:[{name:'source_text',link:null}],properties:{prompt_boxes:{version:1,boxes:[{id:'s',kind:'source',enabled:true,collapsed:false}],hairPolicy:JSON.parse(hair(mode))}},widgets_values:['⟦source⟧',hair(mode),'[]','[]','{}','boxes']}));
  window.qaExtension.beforeConfigureGraph({nodes});
  class Encoder{constructor(){this.comfyClass='GalleryPromptEncode';this.widgets=[{name:'text',value:''},{name:'hair_policy',value:'{}'},{name:'rules_state',value:'[]'},{name:'source_mode',value:'after'},{name:'prefix_snapshots',value:'[]'},{name:'source_image_exclusions',value:'{}'}];this.inputs=[{name:'source_text',link:null}];this.properties={};}configure(info){this.properties=info.properties;this.widgets.forEach((w,i)=>w.value=info.widgets_values[i]);if(!['before','after','replace','boxes'].includes(this.widgets.find(w=>w.name==='source_mode').value))throw Error('Invalid source mode during configuration');}setDirtyCanvas(){}addWidget(type,name,value,callback){this.widgets.push({type,name,value,callback});}addDOMWidget(name,type,el){host.append(el);return {name,type};}}
  window.qaExtension.beforeRegisterNodeDef(Encoder,{name:'GalleryPromptEncode'});
  window.qaSerializationNodes=nodes.map(info=>{const node=new Encoder();window.comfyAPI.app.app.graph.add(node);node.configure(info);window.qaExtension.nodeCreated(node);return node;});
  return nodes.map(info=>info.widgets_values[1]);
 });
 assert.deepEqual(result,['boxes','boxes']);
 await page.waitForFunction(()=>window.qaSerializationNodes.every(node=>node.__galleryPromptBoxes));
 const values=await page.evaluate(()=>window.qaSerializationNodes.map(node=>{
  const saved={};node.onSerialize(saved);
  return {mode:node.widgets.find(w=>w.name==='source_mode').value,hair:JSON.parse(node.widgets.find(w=>w.name==='hair_policy').value).mode,namedMode:saved.properties.gallery_encoder_widgets.values.source_mode,legacy:node.properties.gallery_encoder_legacy_widgets?.length};
 }));
 assert.deepEqual(values.map(row=>row.mode),['boxes','boxes']);assert.deepEqual(values.map(row=>row.hair),['natural','specific']);assert(values.every(row=>row.namedMode==='boxes'&&row.legacy===6));
 assert.deepEqual(errors,[]);console.log('PASS legacy natural/specific workflow migration before combo validation, widget reordering and named save data');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
