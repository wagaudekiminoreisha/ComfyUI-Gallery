const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=process.env.COMFY_QA_URL||'http://127.0.0.1:8188';
const originalPath=process.env.GALLERY_WORKFLOW_ORIGINAL,noGalleryPath=process.env.GALLERY_WORKFLOW_NO_GALLERY;
if(!originalPath||!noGalleryPath){console.log('SKIP: set GALLERY_WORKFLOW_ORIGINAL and GALLERY_WORKFLOW_NO_GALLERY for the real-ComfyUI draft integration check.');process.exit(0);}
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true});const context=await browser.newContext({viewport:{width:1500,height:1050}}),page=await context.newPage();page.setDefaultTimeout(20000);const mutations=[],reports=[];
await page.addInitScript(()=>{window.draftAudit={errors:[],writes:[]};const set=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){try{const result=set.call(this,key,value);if(key.startsWith('Comfy.Workflow.Draft.v2:'))window.draftAudit.writes.push({key,chars:String(value).length});return result;}catch(error){window.draftAudit.errors.push({name:error.name,message:error.message,key,chars:String(value).length});throw error;}};});
await page.route('**/extensions/ComfyUI-Gallery/comfy-ui-gallery.js*',route=>route.fulfill({path:path.resolve('web/dist/assets/comfy-ui-gallery.js'),contentType:'application/javascript'}));
for(const endpoint of ['prefixes','rulesets'])await page.route('**/Gallery/'+endpoint,route=>{if(route.request().method()==='POST'){mutations.push(endpoint);return route.fulfill({status:409,json:{error:'Read-only workflow serialization audit'}});}return route.continue();});
const ready=async()=>page.waitForFunction(()=>!!window.LiteGraph?.registered_node_types?.GalleryImageSource&&!!window.comfyAPI?.app?.app?.canvas?.graph);
const settle=async()=>{await page.waitForFunction(()=>window.comfyAPI.app.app.graph._nodes.filter(n=>n.comfyClass==='GalleryPromptEncode').every(n=>!!n.__galleryPromptBoxes));await page.evaluate(async()=>{const app=window.comfyAPI.app.app;for(const node of app.graph._nodes)if(node.comfyClass==='GalleryPromptEncode')await node.widgets.find(w=>w.name==='rules_state')?.serializeValue?.();});await page.waitForTimeout(100);};
const business=async()=>JSON.parse(JSON.stringify(await page.evaluate(()=>{const app=window.comfyAPI.app.app;return app.graph._nodes.filter(n=>['GalleryImageSource','GalleryPromptEncode'].includes(n.comfyClass)).map(n=>({id:n.id,type:n.comfyClass,widgets:Object.fromEntries(n.widgets.filter(w=>['sources','text','source_mode','hair_policy','rules_state','prefix_snapshots','source_image_exclusions'].includes(w.name)).map(w=>[w.name,w.name==='sources'?JSON.parse(w.value):w.value])),properties:Object.fromEntries(Object.entries(n.properties||{}).filter(([k])=>(k.startsWith('gallery_')||k==='prompt_boxes')&&k!=='gallery_encoder_widgets')),outputs:n.outputs.map(o=>({name:o.name,type:o.type,links:o.links}))}));})));
try{
 const libraryBefore=(await(await page.request.get(base+'/Gallery/prefixes')).json()).revision;
 await page.goto(base);await ready();
 const minimal={version:.4,last_node_id:1,last_link_id:0,nodes:[{id:1,type:'CLIPTextEncode',pos:[0,0],size:[400,200],flags:{},order:0,mode:0,properties:{},widgets_values:['minimal draft']}],links:[],groups:[],config:{},extra:{}};
 for(const [label,data]of [['original',JSON.parse(fs.readFileSync(originalPath,'utf8'))],['no-gallery',JSON.parse(fs.readFileSync(noGalleryPath,'utf8'))],['minimal',minimal]]){
  await page.evaluate(async data=>{await window.comfyAPI.app.app.loadGraphData(data,false,false);},data);await settle();
  const before=await business();const count=await page.evaluate(()=>window.draftAudit.writes.length);
  await page.evaluate(()=>{const app=window.comfyAPI.app.app;app.graph.beforeChange();app.graph._nodes[0].pos[0]+=1;app.graph.afterChange();app.graph.change();window.comfyAPI.api.api.dispatchEvent(new CustomEvent('graphChanged'));});
  try{await page.waitForFunction(count=>window.draftAudit.writes.length>count,count);}catch(error){console.log('draft failure',label,await page.evaluate(()=>({audit:window.draftAudit,nodes:window.comfyAPI.app.app.graph._nodes.length,serialized:JSON.stringify(window.comfyAPI.app.app.graph.serialize()).length})));throw error;}
  const audit=await page.evaluate(()=>window.draftAudit);assert.deepEqual(audit.errors,[]);
  const saved=await page.evaluate(()=>{const write=window.draftAudit.writes.at(-1);return {payloadChars:write.chars,data:JSON.parse(JSON.parse(localStorage.getItem(write.key)).data)};});
  const exported=await page.evaluate(()=>window.comfyAPI.app.app.graph.serialize());const chars=JSON.stringify(exported).length;
  for(const node of exported.nodes.filter(n=>['GalleryImageSource','GalleryPromptEncode'].includes(n.type)))assert(node.properties.gallery_workflow_archive,'Gallery node must use compact workflow storage');
  await page.evaluate(async data=>{await window.comfyAPI.app.app.loadGraphData(data,false,false);},saved.data);await settle();assert.deepEqual(await business(),before,'all Gallery state and API widget values survive the actual saved draft');
  const report={label,inputChars:JSON.stringify(data).length,exportChars:chars,draftPayloadChars:saved.payloadChars,nodes:exported.nodes.length,roundtrip:true};reports.push(report);console.log(JSON.stringify(report));
  if(process.env.GALLERY_DRAFT_AUDIT_DIR){fs.mkdirSync(process.env.GALLERY_DRAFT_AUDIT_DIR,{recursive:true});fs.writeFileSync(path.join(process.env.GALLERY_DRAFT_AUDIT_DIR,'verified-'+label+'.json'),JSON.stringify(exported));}
  if(label==='original'){
   await page.reload();await ready();await page.waitForFunction(count=>window.comfyAPI.app.app.graph._nodes.length===count,data.nodes.length);await settle();assert.deepEqual(await business(),before,'browser reload restores archived source history, widget configuration and prompt selections');
  }
 }
 assert.deepEqual(mutations,[],'draft autosaves must not mutate the prompt/rules library');const libraryAfter=(await(await page.request.get(base+'/Gallery/prefixes')).json()).revision;assert.equal(libraryAfter,libraryBefore);
 if(process.env.GALLERY_DRAFT_AUDIT_DIR)fs.writeFileSync(path.join(process.env.GALLERY_DRAFT_AUDIT_DIR,'report.json'),JSON.stringify({reports,libraryUnchanged:true,errors:await page.evaluate(()=>window.draftAudit.errors)},null,2));
 console.log('PASS real ComfyUI autosave, compact draft reload, full Gallery state/API widget roundtrips and unchanged prompt library');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exit(1)});
