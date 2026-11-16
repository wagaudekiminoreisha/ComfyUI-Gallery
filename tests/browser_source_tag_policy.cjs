const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true});
 const page=await browser.newPage({viewport:{width:1500,height:1150}}),errors=[];page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
 const base='http://127.0.0.1:8191';
 try{
  const imported=[];
  for(const url of ['/static_gallery/study-1.png','/static_gallery/study-2.png']){
   const response=await page.request.post(base+'/Gallery/source/local',{data:{url}});assert.equal(response.status(),200);imported.push(await response.json());
  }
  await page.goto(base);await page.getByRole('tab',{name:'Gallery workspace',exact:true}).click();
  await page.evaluate(images=>{
   const graph=window.comfyAPI.app.app.graph,host=document.createElement('div');host.id='qa-policy';host.style.cssText='position:fixed;left:0;top:64px;width:900px;height:1050px;overflow:auto;z-index:5000;background:#222';document.body.append(host);
   const make=rows=>{const node={type:'GalleryImageSource',widgets:[{name:'sources',value:JSON.stringify({version:1,layout:'single',active_index:0,batch_indices:rows.map((_,index)=>index),images:rows})}],properties:{},setDirtyCanvas(){}};graph.add(node);return node;};
   const a=make(images.map((image,index)=>({...image,prompt:{positive:index?'long hair, blue eyes, white dress, standing, mystery':'long hair, blue eyes, black dress, sitting, mystery',negative:''}})));
   const b=make([{...images[0],prompt:{positive:'short hair, green eyes, standing, arms up, from behind, mysterypose',negative:''}}]);
   graph.links={81:{origin_id:a.id,origin_slot:4},82:{origin_id:b.id,origin_slot:4}};
   const node={comfyClass:'GalleryPromptEncode',widgets:[{name:'text',value:'manual tag'},{name:'source_mode',value:'after'}],inputs:[{name:'source_text',link:81},{name:'source_text_2',link:82}],properties:{},setDirtyCanvas(){},addWidget(type,name,value,callback){this.widgets.push({type,name,value,callback});},addDOMWidget(name,type,el){host.append(el);return{name,type};}};
   graph.add(node);window.qaExtension.nodeCreated(node);window.qaPolicyEncoder=node;window.qaPolicySources=[a,b];
  },imported);
  const panel=page.locator('#qa-policy'),appearance=panel.locator('[data-source-input="source_text"]'),pose=panel.locator('[data-source-input="source_text_2"]');
  await pose.waitFor();await appearance.getByRole('combobox',{name:'Source filter preset',exact:true}).selectOption('appearance');await pose.getByRole('combobox',{name:'Source filter preset',exact:true}).selectOption('pose');
  await pose.getByText(/^Filtered here.*2 tags$/).waitFor();
  await pose.getByText('Categories this source can contribute',{exact:true}).click();
  await pose.getByRole('checkbox',{name:'Keep Eyes',exact:true}).check();
  assert.equal(await pose.getByRole('combobox',{name:'Source filter preset',exact:true}).inputValue(),'custom');
  await pose.getByRole('checkbox',{name:'Keep Eyes',exact:true}).uncheck();
  assert.equal(await pose.getByRole('combobox',{name:'Source filter preset',exact:true}).inputValue(),'pose');
  await page.evaluate(()=>{document.querySelector('#qa-policy').style.display='none';window.dispatchEvent(new CustomEvent('gallery-source-editor',{detail:window.qaPolicySources[0]}));});
  const editor=page.getByRole('dialog',{name:'Gallery Image Source',exact:true});await editor.waitFor();
  await editor.getByRole('combobox',{name:'Images supplying prompt tags',exact:true}).press('ArrowDown');await page.getByTitle('Selected batch images',{exact:true}).click();
  await editor.getByRole('combobox',{name:'Merge source prompt tags',exact:true}).press('ArrowDown');await page.getByTitle('Common to every image',{exact:true}).click();
  await editor.getByRole('button',{name:'Save to node',exact:true}).click();await editor.waitFor({state:'hidden'});
  await page.evaluate(()=>document.querySelector('#qa-policy').style.display='block');
  const payload=()=>page.evaluate(()=>JSON.parse(window.qaPolicyEncoder.widgets.find(w=>w.name==='source_image_exclusions').serializeValue()));
  await page.waitForFunction(()=>JSON.parse(window.qaPolicyEncoder.widgets.find(w=>w.name==='source_image_exclusions').serializeValue()).sources.source_text?.merge?.mode==='common');
  let data=await payload();assert.equal(data.sources.source_text.segments.length,2);assert.deepEqual(data.sources.source_text.category_exclusions,['pose','framing']);
  const manifest=await page.evaluate(()=>JSON.parse(window.qaPolicySources[0].widgets[0].value));assert.equal(manifest.layout,'single');assert.equal(manifest.prompt_selection,'batch');assert.equal(manifest.prompt_merge,'common');
  await appearance.getByRole('button',{name:'Edit blue eyes',exact:true}).press('Delete');data=await payload();assert.deepEqual(data.sources.source_text.segments[0].excluded,['blue eyes']);assert.deepEqual(data.sources.source_text.segments[1].excluded,[]);
  await appearance.getByText('Contribution after source filtering',{exact:true}).click();
  assert.equal(await appearance.getByLabel('Source contribution',{exact:true}).textContent(),'long hair, mystery');
  await page.evaluate(()=>{window.qaPolicyEncoder.properties=JSON.parse(JSON.stringify(window.qaPolicyEncoder.properties));window.qaPolicyEncoder.onConfigure?.({});});
  assert.deepEqual(await payload(),data);assert.deepEqual(errors,[]);
  console.log('PASS source filter presets, category override, removed-tag explanation, batch prompt selection independent of pixels, consensus, scoped edits and reload');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
