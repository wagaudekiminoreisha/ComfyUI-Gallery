const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true});
 const page=await browser.newPage({viewport:{width:1500,height:1100}}),errors=[];page.setDefaultTimeout(12000);page.on('pageerror',error=>errors.push(error.message));
 const base='http://127.0.0.1:8191';let originalRules;
 const get=async path=>(await(await page.request.get(base+path)).json());
 const post=async(path,data)=>{const response=await page.request.post(base+path,{data});assert.equal(response.status(),200,await response.text());return response.json();};
 const definition=(id,name,tag)=>({version:1,id,name,family:id,rules:[{op:'exclude',tags:[tag]}],choices:[]});
 const globalDef=definition('qa-current-global','Current global QA','global_tag'),privateDef=definition('qa-snapshot-private','Snapshot private QA','private_tag');
 const box=(id,definition,origin)=>({id,definition,origin,scope:'main',enabled:true,collapsed:false,preferences:{}});
 const global=box('qa-global-box',globalDef,'global'),privateBox=box('qa-private-box',privateDef,'snapshot');
 try{
  let rules=await get('/Gallery/rulesets');originalRules=rules.library;
  await post('/Gallery/rulesets',{revision:rules.revision,library:{version:1,definitions:[globalDef,privateDef],globals:[global],prefixes:{},availability:{[globalDef.id]:'global',[privateDef.id]:'on-demand'}}});
  let library=await get('/Gallery/prefixes');library=await post('/Gallery/prefixes',{action:'save',name:'Rule inheritance QA',terms:['private_tag','global_tag','keep'],revision:library.revision});
  const prefix=library.library.prefixes.find(row=>row.name==='Rule inheritance QA');
  let snapshot=await post('/Gallery/prefixes',{action:'snapshot',prefix_id:prefix.id,terms:['private_tag','global_tag','keep','variant'],negative_terms:[],rules:[global,privateBox],revision:library.revision});
  const firstId=snapshot.snapshot_id;assert(firstId);
  rules=await get('/Gallery/rulesets');await post('/Gallery/rulesets',{revision:rules.revision,library:{...rules.library,prefixes:{['snapshot:'+firstId]:[global,privateBox]}}});
  await page.goto(base);await page.getByRole('tab',{name:'Gallery workspace',exact:true}).click();
  await page.evaluate(({prefixId,snapshotId})=>{
   const host=document.createElement('div');host.id='qa-inheritance';host.style.cssText='position:fixed;right:0;top:0;width:760px;height:1050px;overflow:auto;z-index:5000;background:#222';document.body.append(host);
   const graph=window.comfyAPI.app.app.graph;
   const source={type:'GalleryImageSource',widgets:[{name:'sources',value:JSON.stringify({version:1,layout:'single',images:[{input_name:'qa.png',metadata:{gallery_prefix:{id:prefixId,name:'Rule inheritance QA',snapshot_id:snapshotId,positive:['private_tag','global_tag','keep','variant'],negative:[]}},prompt:{positive:'private_tag, global_tag, keep, variant',negative:''}}]})}]};graph.add(source);graph.links={77:{origin_id:source.id,origin_slot:4}};
   const node={comfyClass:'GalleryPromptEncode',widgets:[{name:'text',value:''},{name:'source_mode',value:'after'}],inputs:[{name:'source_text',link:77}],properties:{},setDirtyCanvas(){},addWidget(type,name,value,callback){this.widgets.push({type,name,value,callback});},addDOMWidget(name,type,el){host.append(el);return{name,type};}};
   graph.add(node);window.qaExtension.nodeCreated(node);window.qaRuleSource=source;window.qaRuleEncoder=node;
  },{prefixId:prefix.id,snapshotId:firstId});
  const editor=page.locator('#qa-inheritance');const card=editor.getByRole('group',{name:'Ruleset box Snapshot private QA',exact:true});await card.waitFor();
  assert.equal(await editor.getByRole('group',{name:'Ruleset box Current global QA',exact:true}).count(),0);
  const program=()=>page.evaluate(async()=>JSON.parse(await window.qaRuleEncoder.widgets.find(w=>w.name==='rules_state').serializeValue()));
  assert((await program()).some(row=>row.origin==='global'&&row.definition.id===globalDef.id));
  await card.getByRole('button',{name:'Remove inherited ruleset Snapshot private QA',exact:true}).click();await card.waitFor({state:'detached'});
  assert(!(await program()).some(row=>row.definition.id===privateDef.id));
  await page.evaluate(()=>{window.qaRuleEncoder.properties=JSON.parse(JSON.stringify(window.qaRuleEncoder.properties));window.qaRuleEncoder.onConfigure?.({});});
  let refs=await page.evaluate(async()=>JSON.parse(await window.qaRuleEncoder.widgets.find(w=>w.name==='prefix_snapshots').serializeValue()));
  library=await get('/Gallery/prefixes');const captured=library.library.snapshots[refs[0].snapshot_id];assert(captured);assert(!captured.rules.some(row=>row.definition.id===privateDef.id));
  assert(captured.rules.some(row=>row.origin==='global')); // history remains available, not inherited as cards
  snapshot=await post('/Gallery/prefixes',{action:'snapshot',prefix_id:prefix.id,terms:['private_tag','global_tag','keep','different variant'],negative_terms:[],rules:[global,privateBox],revision:library.revision});
  assert.notEqual(snapshot.snapshot_id,firstId);
  await page.evaluate(id=>{const widget=window.qaRuleSource.widgets[0],manifest=JSON.parse(widget.value);manifest.images[0].metadata.gallery_prefix.snapshot_id=id;widget.value=JSON.stringify(manifest);window.dispatchEvent(new Event('gallery-source-changed'));},snapshot.snapshot_id);
  await editor.getByRole('button',{name:'Refresh rules',exact:true}).click();assert(!(await program()).some(row=>row.definition.id===privateDef.id));
  await editor.getByText('Ignored source rules · 1',{exact:true}).click();await editor.getByRole('button',{name:'Restore inherited ruleset Snapshot private QA',exact:true}).click();await card.waitFor();
  // Clearing attachments in the snapshot editor must suppress its frozen history.
  rules=await get('/Gallery/rulesets');await post('/Gallery/rulesets',{revision:rules.revision,library:{...rules.library,prefixes:{...rules.library.prefixes,['snapshot:'+snapshot.snapshot_id]:[]}}});
  await editor.getByRole('button',{name:'Refresh rules',exact:true}).click();await card.waitFor({state:'detached'});
  assert(!(await program()).some(row=>row.definition.id===privateDef.id));
  refs=await page.evaluate(async()=>JSON.parse(await window.qaRuleEncoder.widgets.find(w=>w.name==='prefix_snapshots').serializeValue()));library=await get('/Gallery/prefixes');
  assert(!library.library.snapshots[refs[0].snapshot_id].rules.some(row=>row.definition.id===privateDef.id));
  assert.equal(await editor.getByRole('group',{name:'Ruleset box Current global QA',exact:true}).count(),0);
  assert.deepEqual(errors,[]);console.log('PASS hidden live globals, removable/restorable source rules, saved exclusions across snapshot IDs, authoritative cleared attachments and queue capture without resurrection');
 }finally{
  if(originalRules){const rules=await get('/Gallery/rulesets');await post('/Gallery/rulesets',{revision:rules.revision,library:originalRules});}
  await browser.close();
 }
})().catch(error=>{console.error(error);process.exit(1);});
