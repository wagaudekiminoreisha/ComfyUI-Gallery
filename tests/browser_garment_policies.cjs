const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true}),page=await browser.newPage({viewport:{width:1400,height:1100}}),base='http://127.0.0.1:8191';
 page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',error=>errors.push(error.message));let original;
 const get=async()=>await(await page.request.get(base+'/Gallery/rulesets')).json();
 const save=async library=>{const current=await get(),response=await page.request.post(base+'/Gallery/rulesets',{data:{library,revision:current.revision}});assert.equal(response.status(),200,await response.text());};
 try{
  const current=await get();original=current.library;const definition=original.definitions.find(row=>row.id==='stock-attire-styling');
  await save({...original,availability:{...original.availability,'stock-attire-styling':'global'},globals:[{id:'global-attire',definition,scope:'main',origin:'global',enabled:true,collapsed:false,preferences:{base:'blouse',outer:'cardigan',headwear:'beret'}}]});
  await page.goto(base);await page.getByRole('tab',{name:'Gallery workspace',exact:true}).click();
  await page.evaluate(()=>{
   const host=document.createElement('div');host.id='qa-garments';host.style.cssText='position:fixed;left:0;top:0;width:700px;height:1050px;overflow:auto;z-index:5000;background:#222';document.body.append(host);
   const node={comfyClass:'GalleryPromptEncode',widgets:[{name:'text',value:'jeans, skirt'},{name:'source_mode',value:'after'}],inputs:[],properties:{},setDirtyCanvas(){},addWidget(type,name,value,callback){this.widgets.push({type,name,value,callback});},addDOMWidget(name,type,el){host.append(el);return{name,type};}};
   window.comfyAPI.app.app.graph.add(node);window.qaExtension.nodeCreated(node);window.qaGarmentEncoder=node;
  });
  const panel=page.locator('#qa-garments');await panel.getByLabel('Add ruleset',{exact:true}).selectOption('stock-attire-lower');
  const lower=panel.getByRole('group',{name:'Ruleset box Lower-body attire',exact:true});await lower.getByLabel('Bottoms and layering',{exact:true}).selectOption('layered');
  const payload=()=>page.evaluate(async()=>JSON.parse(await window.qaGarmentEncoder.widgets.find(widget=>widget.name==='rules_state').serializeValue()));
  let boxes=await payload();assert.equal(boxes.filter(box=>box.origin==='encoder').length,1);
  assert.equal(boxes.find(box=>box.definition.id==='stock-attire-lower').preferences.bottoms,'layered');
  const text=await panel.innerText();assert.ok(!text.includes('competing exclusive tags can occur together'));
  await panel.getByLabel('Add ruleset',{exact:true}).selectOption('stock-attire-upper');
  const upper=panel.getByRole('group',{name:'Ruleset box Upper-body attire',exact:true});await upper.getByLabel('Upper base',{exact:true}).selectOption('shirt');await upper.getByLabel('Outer layer',{exact:true}).selectOption('jacket');
  boxes=await payload();assert.equal(boxes.filter(box=>box.origin==='encoder').length,2);
  assert.equal(boxes.find(box=>box.definition.id==='stock-attire-upper').preferences.base,'shirt');
  assert.equal(await panel.getByRole('group',{name:'Ruleset box Attire and styling',exact:true}).count(),0);
  await page.evaluate(()=>{window.qaGarmentEncoder.properties=JSON.parse(JSON.stringify(window.qaGarmentEncoder.properties));window.qaGarmentEncoder.onConfigure?.({});});
  assert.equal(await upper.getByLabel('Upper base',{exact:true}).inputValue(),'shirt');assert.equal(await lower.getByLabel('Bottoms and layering',{exact:true}).inputValue(),'layered');
  assert.deepEqual(errors,[]);console.log('PASS opt-in garment rules, granular global overrides, hidden globals, independent upper/lower settings and reload');
 }finally{if(original)await save(original);await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
