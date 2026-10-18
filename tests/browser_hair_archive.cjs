const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true});
 const page=await browser.newPage({viewport:{width:1500,height:1100}});const errors=[];page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.goto('http://127.0.0.1:8191');await page.getByRole('tab',{name:'Gallery workspace',exact:true}).click();
  const workspace=page.locator('#comfy-gallery-workspace');
  const card=()=>workspace.locator('[data-gallery-entry="local:/static_gallery/study-1.png"]');
  await card().waitFor();
  const before=await page.evaluate(async()=>{const r=await fetch('/static_gallery/study-1.png');return [...new Uint8Array(await r.arrayBuffer())]});
  await card().press('Space');await workspace.getByRole('button',{name:'Archive selected',exact:true}).click();
  await card().waitFor({state:'detached'});
  await page.reload();await page.getByRole('tab',{name:'Gallery workspace',exact:true}).click();
  await workspace.locator('[data-gallery-entry]').first().waitFor();assert.equal(await card().count(),0,'archive persists across reload and normal media excludes it');
  await workspace.getByText('Archive',{exact:true}).click();await card().waitFor();
  assert.equal(await workspace.locator('[data-gallery-entry]').count(),1,'archive only contains archived originals');
  await card().press('Space');await workspace.getByRole('button',{name:'Restore selected',exact:true}).click();await card().waitFor({state:'detached'});
  await workspace.getByText('Media',{exact:true}).click();await card().waitFor();
  const after=await page.evaluate(async()=>{const r=await fetch('/static_gallery/study-1.png');return [...new Uint8Array(await r.arrayBuffer())]});assert.deepEqual(after,before,'archive never changes the original');
  await workspace.getByRole('button',{name:'Settings',exact:true}).click();
  await page.getByRole('menuitem',{name:'Connection settings',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Hydrus connection',exact:true});
  const toggle=dialog.getByRole('switch',{name:'Allow Hydrus Web to connect',exact:true});await toggle.waitFor();
  await toggle.uncheck();await dialog.getByRole('button',{name:'Save connection',exact:true}).click();
  await dialog.waitFor({state:'hidden'});
  const disabled=await page.request.get('http://127.0.0.1:8191/Gallery/hydrus-web/health',{headers:{Origin:'http://localhost:8080'}});assert.equal((await disabled.json()).enabled,false);
  await page.request.post('http://127.0.0.1:8191/Gallery/hydrus/settings',{data:{hydrus_web_enabled:true}});
  await page.evaluate(()=>{
   const frame=document.createElement('div');frame.id='qa-hair-node';frame.style.cssText='position:fixed;left:10px;top:10px;width:650px;height:1000px;z-index:5000;background:#222;color:#ddd';document.body.append(frame);
   const node={comfyClass:'GalleryPromptEncode',size:[650,1000],widgets:[{name:'text',value:'1girl, long hair, blonde hair, sidelocks, hair bow, blue eyes'},{name:'source_mode',value:'after'}],inputs:[{name:'source_text',link:null}],properties:{},setDirtyCanvas(){},setSize(size){this.size=size},computeSize(){return [650,700]},addWidget(type,name,value,callback){this.widgets.push({type,name,value,callback})},addDOMWidget(name,type,el){frame.append(el);return{name,type}}};
   window.comfyAPI.app.app.graph.add(node);window.qaExtension.nodeCreated(node);window.qaHairNode=node;
  });
  const node=page.locator('#qa-hair-node');await node.getByLabel('Hair prompting',{exact:true}).locator('summary').click();
  const mode=node.getByLabel('Hair mode',{exact:true});await mode.selectOption('natural');
  await page.waitForFunction(()=>JSON.parse(window.qaHairNode.widgets.find(w=>w.name==='hair_policy').value).mode==='natural');
  assert.match(await node.getByLabel('Hair filtering summary',{exact:true}).innerText(),/3 recognised hair term\(s\) omitted/);
  const prompt=node.getByLabel('Prompt sent to the encoder',{exact:true});
  assert.match(await prompt.inputValue(),/hair bow/);assert.doesNotMatch(await prompt.inputValue(),/long hair|blonde hair|sidelocks/);
  assert.equal(await node.getByRole('button',{name:'Edit blonde hair',exact:true}).count(),1,'original chips remain saved');
  await mode.selectOption('minimal');await node.getByLabel('Keep hair length',{exact:true}).check();
  assert.match(await prompt.inputValue(),/long hair/);assert.doesNotMatch(await prompt.inputValue(),/blonde hair|sidelocks/);
  await mode.selectOption('specific');assert.match(await prompt.inputValue(),/long hair, blonde hair, sidelocks/);
  assert.deepEqual(errors,[]);console.log('PASS hair mode previews, non-destructive chips, archive/restore persistence, isolation and unchanged original');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
