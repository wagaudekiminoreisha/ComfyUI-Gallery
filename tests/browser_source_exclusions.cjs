const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true});const page=await browser.newPage({viewport:{width:1400,height:1100}});const errors=[];page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(15000);
try{
 await page.goto('http://127.0.0.1:8191');await page.getByRole('tab',{name:'Gallery workspace',exact:true}).click();
 await page.evaluate(()=>{
  const host=document.createElement('div');host.id='qa-source-exclusions';host.style.cssText='position:fixed;right:0;top:0;width:650px;height:1050px;overflow:auto;z-index:5000;background:#222';document.body.append(host);
  const graph=window.comfyAPI.app.app.graph;const source={type:'GalleryImageSource',widgets:[{name:'sources',value:JSON.stringify({version:1,layout:'single',active_index:0,images:[{input_name:'a.png',prompt:{positive:'blue eyes, blonde hair',negative:''}},{input_name:'b.png',prompt:{positive:'blue eyes, long hair',negative:''}}]})}]};graph.add(source);graph.links={77:{origin_id:source.id,origin_slot:4}};
  const node={comfyClass:'GalleryPromptEncode',widgets:[{name:'text',value:''},{name:'source_mode',value:'after'}],inputs:[{name:'source_text',link:77}],properties:{},setDirtyCanvas(){},addWidget(type,name,value,callback){this.widgets.push({type,name,value,callback});},addDOMWidget(name,type,el){host.append(el);return {name,type};}};
  graph.add(node);window.qaExtension.nodeCreated(node);window.qaSource=source;window.qaEncoder=node;
 });
 const editor=page.locator('#qa-source-exclusions'),select=editor.getByRole('combobox',{name:'Source image for tag exclusions',exact:true});
 await select.waitFor();await editor.getByRole('button',{name:'Edit blue eyes',exact:true}).press('Delete');await editor.getByRole('button',{name:'Restore blue eyes',exact:true}).waitFor();
 const switchSource=async index=>{await page.evaluate(index=>{const widget=window.qaSource.widgets[0],data=JSON.parse(widget.value);data.active_index=index;widget.value=JSON.stringify(data);window.dispatchEvent(new Event('gallery-source-changed'));},index);};
 await switchSource(1);await page.waitForFunction(()=>document.querySelector('[aria-label="Source image for tag exclusions"]').value==='b.png:positive');
 assert.equal(await editor.getByRole('button',{name:'Restore blue eyes',exact:true}).count(),0);await editor.getByRole('button',{name:'Edit blue eyes',exact:true}).waitFor();
 await switchSource(0);await editor.getByRole('button',{name:'Restore blue eyes',exact:true}).waitFor();assert.equal(await editor.getByRole('button',{name:'Edit blue eyes',exact:true}).count(),0);
 await page.evaluate(()=>{const widget=window.qaSource.widgets[0],data=JSON.parse(widget.value);data.layout='horizontal';widget.value=JSON.stringify(data);window.dispatchEvent(new Event('gallery-source-changed'));});
 await select.selectOption('b.png:positive');await editor.getByRole('button',{name:'Edit blue eyes',exact:true}).waitFor();assert.equal(await editor.getByRole('button',{name:'Restore blue eyes',exact:true}).count(),0);
 const payload=await page.evaluate(()=>JSON.parse(window.qaEncoder.widgets.find(w=>w.name==='source_image_exclusions').serializeValue()));assert.deepEqual(payload.segments.map(row=>row.excluded),[['blue eyes'],[]]);
 await page.evaluate(()=>{window.qaEncoder.properties=JSON.parse(JSON.stringify(window.qaEncoder.properties));window.qaEncoder.onConfigure?.({});});
 await select.selectOption('a.png:positive');await editor.getByRole('button',{name:'Restore blue eyes',exact:true}).click();await editor.getByRole('button',{name:'Edit blue eyes',exact:true}).waitFor();
 assert.deepEqual(await page.evaluate(()=>JSON.parse(window.qaEncoder.widgets.find(w=>w.name==='source_image_exclusions').serializeValue())),{});
 assert.deepEqual(errors,[]);console.log('PASS source switching, per-image Left out chips, batch isolation, restore and serialized execution payload');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
