const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true});
 const page=await browser.newPage({viewport:{width:1500,height:1100}}),errors=[];
 page.setDefaultTimeout(15000);page.on('pageerror',error=>errors.push(error.message));
 const base='http://127.0.0.1:8191';let originalRules;
 try{
  const prefixes=[];
  for(const [name,terms] of [['Pose QA',['blue eyes','standing']],['Look QA',['blue eyes','blonde hair']]]){
   const prior=await(await page.request.get(base+'/Gallery/prefixes')).json();
   const response=await page.request.post(base+'/Gallery/prefixes',{data:{action:'save',revision:prior.revision,name,terms}});
   assert.equal(response.status(),200);const data=await response.json();prefixes.push(data.library.prefixes.find(prefix=>prefix.name===name));
  }
  originalRules=(await(await page.request.get(base+'/Gallery/rulesets')).json()).library;
  const defs=['Pose rule','Look rule'].map((name,index)=>({version:1,id:'multi-'+index,name,family:'multi-'+index,rules:[{op:'require',tags:[index?'appearance detail':'pose detail']}],choices:[]}));
  const library={version:1,definitions:defs,globals:[],prefixes:Object.fromEntries(prefixes.map((prefix,index)=>[prefix.id,[{id:'b'+index,definition:defs[index],scope:'main',origin:'prefix',preferences:{},enabled:true,collapsed:false}]]))};
  const revision=(await(await page.request.get(base+'/Gallery/rulesets')).json()).revision;
  assert.equal((await page.request.post(base+'/Gallery/rulesets',{data:{library,revision}})).status(),200);
  await page.goto(base);await page.getByRole('tab',{name:'Gallery workspace',exact:true}).click();
  await page.evaluate(prefixes=>{
   const graph=window.comfyAPI.app.app.graph,host=document.createElement('div');host.id='qa-multi-source';host.style.cssText='position:fixed;left:0;top:64px;width:850px;height:1000px;overflow:auto;z-index:5000;background:#222';document.body.append(host);
   const sources=prefixes.map((prefix,index)=>{const terms=index?['blue eyes','blonde hair']:['blue eyes','standing'];const node={type:'GalleryImageSource',widgets:[{name:'sources',value:JSON.stringify({version:1,layout:'single',active_index:0,images:[{input_name:'same.png',prompt:{positive:terms.join(', '),negative:'blurry'},metadata:{gallery_prefix:{id:prefix.id,name:prefix.name,positive:terms,negative:['blurry']}}}]})}]};graph.add(node);return node;});
   graph.links={71:{origin_id:sources[0].id,origin_slot:4},72:{origin_id:sources[1].id,origin_slot:4}};
   const node={comfyClass:'GalleryPromptEncode',widgets:[{name:'text',value:''},{name:'source_mode',value:'after'}],inputs:[{name:'source_text',link:71},{name:'source_text_2',link:72}],properties:{},setDirtyCanvas(){},addInput(name,type){this.inputs.push({name,type,link:null});},disconnectInput(index){this.inputs[index].link=null;},addWidget(type,name,value,callback){this.widgets.push({type,name,value,callback});},addDOMWidget(name,type,el){host.append(el);return{name,type};}};
   graph.add(node);window.qaExtension.nodeCreated(node);window.qaMulti=node;window.qaMultiSources=sources;
  },prefixes);
  const editor=page.locator('#qa-multi-source'),first=editor.locator('[data-source-input="source_text"]'),second=editor.locator('[data-source-input="source_text_2"]');
  await second.waitFor();await first.getByRole('textbox',{name:'Source label',exact:true}).fill('Pose');await second.getByRole('textbox',{name:'Source label',exact:true}).fill('Appearance');
  const rules=()=>page.evaluate(async()=>JSON.parse(await window.qaMulti.widgets.find(w=>w.name==='rules_state').serializeValue()));
  assert.deepEqual((await rules()).map(box=>box.definition.name).sort(),['Look rule','Pose rule']);
  await first.getByRole('button',{name:'Edit blue eyes',exact:true}).press('Delete');
  await second.getByRole('button',{name:'Edit blue eyes',exact:true}).waitFor();
  await second.getByRole('button',{name:'Edit blonde hair',exact:true}).click();
  const tag=second.getByRole('textbox',{name:'Tag text',exact:true});await tag.fill('red hair');await tag.press('Enter');
  let payload=await page.evaluate(()=>JSON.parse(window.qaMulti.widgets.find(w=>w.name==='source_image_exclusions').serializeValue()));
  assert.deepEqual(payload.sources.source_text.segments[0].excluded,['blue eyes']);
  assert.deepEqual(payload.sources.source_text_2.segments[0].replacements,{'blonde hair':'red hair'});
  assert.deepEqual(payload.sources.source_text_2.segments[0].excluded,[]);
  await second.getByRole('checkbox',{name:'Inherit prefix rules',exact:true}).uncheck();
  assert.deepEqual((await rules()).map(box=>box.definition.name),['Pose rule']);
  await second.getByRole('checkbox',{name:'Inherit prefix rules',exact:true}).check();
  assert.equal((await rules()).length,2);
  await second.getByRole('checkbox',{name:'Use source box',exact:true}).uncheck();
  assert.deepEqual((await rules()).map(box=>box.definition.name),['Pose rule']);
  assert.equal((await page.evaluate(()=>window.qaMulti.widgets.find(w=>w.name==='text').value)).includes('source_text_2'),false);
  await second.getByRole('checkbox',{name:'Use source box',exact:true}).check();
  await second.getByRole('button',{name:'Move source box up',exact:true}).click();
  const compiled=await page.evaluate(()=>window.qaMulti.widgets.find(w=>w.name==='text').value);
  assert(compiled.indexOf('source_text_2')<compiled.indexOf('source⟧'));
  await page.evaluate(()=>{window.qaMulti.properties=JSON.parse(JSON.stringify(window.qaMulti.properties));window.qaMulti.onConfigure?.({});});
  assert.equal(await second.getByRole('textbox',{name:'Source label',exact:true}).inputValue(),'Appearance');
  assert.equal(await first.getByRole('textbox',{name:'Source label',exact:true}).inputValue(),'Pose');
  assert.deepEqual(await page.evaluate(()=>JSON.parse(window.qaMulti.widgets.find(w=>w.name==='source_image_exclusions').serializeValue())),payload);
  const refs=await page.evaluate(async()=>JSON.parse(await window.qaMulti.widgets.find(w=>w.name==='prefix_snapshots').serializeValue()));
  assert(refs.some(row=>row.prefix_id===prefixes[0].id));assert(refs.some(row=>row.prefix_id===prefixes[1].id));
  assert.deepEqual(refs.find(row=>row.prefix_id===prefixes[0].id).terms,['standing']);
  assert.deepEqual(refs.find(row=>row.prefix_id===prefixes[1].id).terms,['blue eyes','red hair']);
  await editor.getByRole('button',{name:'Add source input',exact:true}).click();
  const third=editor.locator('[data-source-input="source_text_3"]');await third.waitFor();await third.getByRole('button',{name:'Remove source input',exact:true}).click();await third.waitFor({state:'detached'});
  await page.evaluate(()=>{window.qaMultiSources[1].widgets[0].value=window.qaMultiSources[1].widgets[0].value.replace('blonde hair','black hair');window.dispatchEvent(new Event('gallery-source-changed'));});
  await second.getByRole('button',{name:'Edit black hair',exact:true}).waitFor();await first.getByRole('button',{name:'Restore blue eyes',exact:true}).waitFor();
  await page.evaluate(()=>{window.qaMulti.inputs[1].link=null;window.qaMulti.onConnectionsChange?.(1,1,false);});
  await second.getByText(/Connect a text output/).waitFor();assert.deepEqual((await rules()).map(box=>box.definition.name),['Pose rule']);
  await editor.getByRole('button',{name:'Add source input',exact:true}).click();
  await page.evaluate(()=>{
   const graph=window.qaMulti.graph,external={type:'ExternalText'};graph.add(external);graph.links[73]={origin_id:external.id,origin_slot:0};
   const index=window.qaMulti.inputs.findIndex(pin=>pin.name==='source_text_3');window.qaMulti.inputs[index].link=73;window.qaMulti.onConnectionsChange?.(1,index,true);
   window.qaMulti.onExecuted({source_texts:[{source_text:'blue eyes, standing',source_text_3:'external text'}]});
  });
  await third.getByRole('button',{name:'Edit external text',exact:true}).waitFor();
  await page.evaluate(()=>{
   const graph=window.qaMulti.graph,next={type:'AnotherExternalText'};graph.add(next);graph.links[74]={origin_id:next.id,origin_slot:0};
   const index=window.qaMulti.inputs.findIndex(pin=>pin.name==='source_text_3');window.qaMulti.inputs[index].link=74;window.qaMulti.onConnectionsChange?.(1,index,true);
  });
  await third.getByRole('button',{name:'Edit external text',exact:true}).waitFor({state:'hidden'});
  await third.getByText('Connected prompt will be shown after execution.',{exact:true}).waitFor();
  assert.deepEqual(errors,[]);console.log('PASS two named source cards: same-image edit isolation, inheritance switches, card ordering, snapshots, reload, live updates, add/remove and disconnect');
 }finally{
  if(originalRules){const revision=(await(await page.request.get(base+'/Gallery/rulesets')).json()).revision;await page.request.post(base+'/Gallery/rulesets',{data:{library:originalRules,revision}});}
  await browser.close();
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
