const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true});
 const page=await browser.newPage({viewport:{width:1400,height:1100}}),errors=[];
 page.setDefaultTimeout(10000);page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.goto('http://127.0.0.1:8191');await page.getByRole('tab',{name:'Gallery workspace',exact:true}).click();
  await page.evaluate(()=>{
   const host=document.createElement('div');host.id='qa-source-restore';host.style.cssText='position:fixed;right:0;top:0;width:700px;height:1050px;overflow:auto;z-index:5000;background:#222';document.body.append(host);
   const graph=window.comfyAPI.app.app.graph;
   const source={type:'GalleryImageSource',widgets:[{name:'sources',value:JSON.stringify({version:1,layout:'horizontal',images:['a.png','b.png'].map(input_name=>({input_name,prompt:{positive:'({{blue eyes|green eyes}|brown eyes}:1.2), long hair',negative:''}}))})}]};
   graph.add(source);graph.links={77:{origin_id:source.id,origin_slot:4}};
   const node={comfyClass:'GalleryPromptEncode',widgets:[{name:'text',value:''},{name:'source_mode',value:'after'}],inputs:[{name:'source_text',link:77}],properties:{},setDirtyCanvas(){},addWidget(type,name,value,callback){this.widgets.push({type,name,value,callback});},addDOMWidget(name,type,el){host.append(el);return{name,type};}};
   graph.add(node);window.qaExtension.nodeCreated(node);window.qaSource=source;window.qaEncoder=node;
  });
  const editor=page.locator('#qa-source-restore');
  const select=editor.getByRole('combobox',{name:'Source image for tag exclusions',exact:true});await select.waitFor();
  const original=await page.evaluate(()=>window.qaSource.widgets[0].value);
  const payload=()=>page.evaluate(()=>JSON.parse(window.qaEncoder.widgets.find(widget=>widget.name==='source_image_exclusions').serializeValue()));
  // A sibling edit must survive removing and restoring a nested group.
  await editor.getByRole('button',{name:'Edit long hair',exact:true}).click();
  const text=editor.getByRole('textbox',{name:'Tag text',exact:true});await text.fill('very long hair');await text.press('Enter');await editor.getByRole('button',{name:'Done',exact:true}).click();
  await editor.getByRole('button',{name:'Remove {blue eyes|green eyes}',exact:true}).click();
  const restore=editor.getByRole('button',{name:'Restore {blue eyes|green eyes}',exact:true});await restore.waitFor();
  let value=await payload();assert.equal(value.segments[0].replacements['({{blue eyes|green eyes}|brown eyes}:1.2)'],'(brown eyes:1.2)');
  await select.selectOption('b.png:positive');assert.equal(await restore.count(),0);
  await select.selectOption('a.png:positive');await restore.waitFor();
  await page.evaluate(()=>{window.qaEncoder.properties=JSON.parse(JSON.stringify(window.qaEncoder.properties));window.qaEncoder.onConfigure?.({});});
  await restore.click();await editor.getByRole('button',{name:'Remove {blue eyes|green eyes}',exact:true}).waitFor();
  value=await payload();assert.deepEqual(value.segments[0].replacements,{'long hair':'very long hair'});assert.equal(value.segments[1].replacements,undefined);
  // Restore all includes both an excluded top-level tag and an omitted group.
  await editor.getByRole('button',{name:'Remove {blue eyes|green eyes}',exact:true}).click();
  await editor.getByRole('button',{name:'Edit very long hair',exact:true}).press('Delete');
  await editor.getByRole('button',{name:'Restore all source tags',exact:true}).click();
  await editor.getByRole('button',{name:'Remove {blue eyes|green eyes}',exact:true}).waitFor();
  await editor.getByRole('button',{name:'Edit very long hair',exact:true}).waitFor();
  assert.deepEqual((await payload()).segments[0].replacements,{'long hair':'very long hair'});
  assert.equal(await page.evaluate(()=>window.qaSource.widgets[0].value),original);
  assert.deepEqual(errors,[]);
  console.log('PASS nested source group Left out restore, per-image isolation, workflow reload, restore all and preserved sibling edits');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
