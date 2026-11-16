const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true});
 const page=await browser.newPage({viewport:{width:1400,height:1100}}),errors=[];page.setDefaultTimeout(10000);page.on('pageerror',error=>errors.push(error.message));
 try{
  const images=[];for(let i=1;i<=3;i++){const response=await page.request.post('http://127.0.0.1:8191/Gallery/source/local',{data:{url:'/static_gallery/study-'+i+'.png'}});assert.equal(response.status(),200);images.push(await response.json());}
  await page.goto('http://127.0.0.1:8191');await page.getByRole('tab',{name:'Gallery workspace',exact:true}).click();
  await page.evaluate(images=>{
   const graph=window.comfyAPI.app.app.graph;
   const source={type:'GalleryImageSource',properties:{},widgets:[{name:'sources',value:JSON.stringify({version:1,layout:'horizontal',active_index:1,images:images.map(image=>({...image,prompt:{positive:'{blue eyes|green eyes}, long hair, white shirt, skirt',negative:''}}))})}],setDirtyCanvas(){}};
   graph.add(source);window.qaPickerSource=source;window.qaPickerImages=images;
   window.qaOpenPicker=()=>window.dispatchEvent(new CustomEvent('gallery-source-picker',{detail:{node:source,anchor:()=>({left:20,top:50,right:340,bottom:80,width:320,height:30})}}));window.qaOpenPicker();
  },images);
  const picker=page.getByRole('dialog',{name:"This node's image history",exact:true});
  const state=()=>page.evaluate(()=>JSON.parse(window.qaPickerSource.widgets[0].value));
  await picker.locator('.sp-image').first().click();assert.equal(await picker.isVisible(),true);assert.equal((await state()).images.length,3);
  await picker.getByRole('button',{name:'Use images (2)',exact:true}).click();await picker.waitFor({state:'hidden'});assert.equal((await state()).images.length,2);assert.equal((await state()).active_index,0);
  await page.evaluate(()=>window.qaOpenPicker());await picker.locator('.sp-image').first().waitFor();
  await picker.locator('.sp-remove').first().click();assert.equal(await picker.locator('.sp-image').count(),1);assert.equal((await state()).images.length,1);
  await picker.getByRole('tab',{name:'History 3',exact:true}).click();await picker.locator('.sp-image').first().dblclick();await picker.waitFor({state:'hidden'});
  await page.evaluate(()=>{
   const host=document.createElement('div');host.id='qa-nesting';host.style.cssText='position:fixed;left:0;top:0;width:700px;height:1050px;overflow:auto;z-index:5000;background:#222';document.body.append(host);
   const graph=window.comfyAPI.app.app.graph,source=window.qaPickerSource;
   const manifest=JSON.parse(source.widgets[0].value);manifest.images.push({...window.qaPickerImages[0],prompt:{positive:'another image tag',negative:''}});source.widgets[0].value=JSON.stringify(manifest);
   graph.links={77:{origin_id:source.id,origin_slot:4}};
   const node={comfyClass:'GalleryPromptEncode',widgets:[{name:'text',value:'manual tag'},{name:'source_mode',value:'after'}],inputs:[{name:'source_text',link:77}],properties:{},setDirtyCanvas(){},addWidget(type,name,value,callback){this.widgets.push({type,name,value,callback});},addDOMWidget(name,type,el){host.append(el);return{name,type};}};
   graph.add(node);window.qaExtension.nodeCreated(node);window.qaNestEncoder=node;
  });
  const editor=page.locator('#qa-nesting');const originals=editor.locator('summary').filter({hasText:'Original contributions · edit sources and groups'});await originals.waitFor({state:'attached'});if(await originals.isVisible())await originals.click();
  const source=editor.locator('[data-source-input="source_text"]');await source.getByRole('button',{name:'Group tags…',exact:true}).click();
  const nesting=source.getByLabel('Select tags to nest',{exact:true});
  await nesting.getByRole('button',{name:'Pick tag blue eyes',exact:true}).click();await nesting.getByRole('button',{name:'Pick tag long hair',exact:true}).click();
  await nesting.getByRole('button',{name:'Pick tag long hair',exact:true}).click({button:'right'});await page.getByRole('menuitem',{name:'Optional group',exact:true}).click();
  const payload=await page.evaluate(()=>JSON.parse(window.qaNestEncoder.widgets.find(widget=>widget.name==='source_image_exclusions').serializeValue()));
  assert.ok(JSON.stringify(payload).includes('{blue eyes, long hair|}'));assert.equal(payload.segments[1].replacements,undefined);assert.equal(Object.hasOwn(payload.segments[0].replacements,'white shirt'),false);assert.equal(Object.hasOwn(payload.segments[0].replacements,'skirt'),false);
  await page.evaluate(()=>{window.qaNestEncoder.properties=JSON.parse(JSON.stringify(window.qaNestEncoder.properties));window.qaNestEncoder.onConfigure?.({});});
  assert.equal(await source.getByRole('button',{name:'Remove {blue eyes, long hair|}',exact:true}).count(),1);
  const original=await state();assert.equal(original.images[0].prompt.positive,'{blue eyes|green eyes}, long hair, white shirt, skirt');
  await source.getByText('Categories this source can contribute',{exact:true}).click();await source.getByText('Refine attire',{exact:true}).click();
  await source.getByRole('checkbox',{name:'Keep Tops',exact:true}).uncheck();assert.equal(await source.getByRole('checkbox',{name:'Keep Bottoms',exact:true}).isChecked(),true);
  await source.getByRole('checkbox',{name:'Keep Attire and accessories',exact:true}).uncheck();assert.equal(await source.getByRole('checkbox',{name:'Keep Bottoms',exact:true}).isDisabled(),true);
  await source.getByRole('checkbox',{name:'Keep Attire and accessories',exact:true}).check();assert.equal(await source.getByRole('checkbox',{name:'Keep Tops',exact:true}).isChecked(),false);
  if(process.env.GALLERY_QA_SCREENSHOT_ROOT)await page.screenshot({path:process.env.GALLERY_QA_SCREENSHOT_ROOT+'/picker-nesting.png'});
  assert.deepEqual(errors,[]);console.log('PASS picker multi-selection, apply, removal reflow, history quick use, nested source regrouping and hierarchical attire filters');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
