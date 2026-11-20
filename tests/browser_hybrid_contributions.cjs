const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true}),page=await browser.newPage({viewport:{width:1280,height:1000}}),errors=[];page.setDefaultTimeout(20000);page.on('pageerror',error=>errors.push(error.message));const base='http://127.0.0.1:8191';
 const post=async data=>{const response=await page.request.post(base+'/Gallery/prefixes',{data});assert.equal(response.status(),200,await response.text());return response.json();};
 try{
  let library=await(await page.request.get(base+'/Gallery/prefixes')).json();
  library=await post({action:'hybrid_save',revision:library.revision,component:{id:'qa-roles-preset',type:'group',name:'Reference details',subject:'subject A',children:[{id:'qa-identity',type:'prose',name:'Identity description',role:'identity',text:'A woman with red hair.'},{id:'qa-pose',type:'prose',name:'Pose description',role:'pose',text:'Her hand rests over her forehead.'}]}});
  await post({action:'hybrid_associate',revision:library.revision,image_keys:['sha256:'+'a'.repeat(64)],components:['qa-roles-preset']});
  await page.goto(base);await page.getByRole('tab',{name:'Gallery workspace',exact:true}).click();
  await page.evaluate(()=>{
   const graph=window.comfyAPI.app.app.graph,source={type:'GalleryImageSource',widgets:[{name:'sources',value:JSON.stringify({version:1,layout:'single',images:[{input_name:'a'.repeat(64)+'.png',prompt:{positive:'blue eyes',negative:'watermark'}}]})}]};graph.add(source);graph.getNodeById=id=>graph._nodes.find(node=>node.id===id);graph.links||={};graph.links[91]={origin_id:source.id,origin_slot:4};
   const node={comfyClass:'GalleryHybridPrompt',widgets:[{name:'document',value:JSON.stringify({version:1,components:[]})},{name:'library',value:JSON.stringify({version:2,tags:[],prefixes:[]})}],inputs:[{name:'source_text',link:91}],properties:{},setDirtyCanvas(){},addWidget(type,name,value,callback){const widget={type,name,value,callback};this.widgets.push(widget);return widget;}};graph.add(node);window.qaExtension.nodeCreated(node);window.qaRoleNode=node;node.widgets.find(widget=>widget.name==='Open hybrid composer').callback();
  });
  const editor=page.getByRole('dialog',{name:'Hybrid prompt composer',exact:true}),output=editor.getByRole('textbox',{name:'Hybrid positive preview',exact:true});
  await editor.waitFor();await page.waitForFunction(()=>document.querySelector('textarea[aria-label="Hybrid positive preview"]')?.value.includes('A woman with red hair.'));
  const source=editor.locator('[data-hybrid-component]').first();await source.getByRole('button',{name:'No roles',exact:true}).click();await source.getByRole('checkbox',{name:'Source role pose',exact:true}).check();
  await page.waitForFunction(()=>document.querySelector('textarea[aria-label="Hybrid positive preview"]')?.value==='Her hand rests over her forehead.');
  assert.equal(await source.getByRole('checkbox',{name:'Inherit source prefix rules',exact:true}).isChecked(),false);
  const queued=await page.evaluate(()=>JSON.parse(window.qaRoleNode.widgets.find(widget=>widget.name==='document').serializeValue()));assert.deepEqual(queued.components[0].source_roles,['pose']);
  await editor.getByText('Assembly inspector',{exact:true}).click();const inspector=editor.locator('.hh-inspector');
  assert.equal(await inspector.locator('[data-inspection-status="included"]').count(),1);await inspector.getByText('subject A',{exact:false}).first().waitFor();
  assert.equal(await inspector.locator('[data-inspection-status="suppressed"]').count(),2);
  await inspector.getByRole('button',{name:'Locate component',exact:true}).first().click();assert.equal(await source.getByRole('textbox',{name:'Component name',exact:true}).evaluate(element=>element===document.activeElement),true);
  await source.getByRole('checkbox',{name:'Include associated source components',exact:true}).uncheck();await page.waitForFunction(()=>document.querySelector('textarea[aria-label="Hybrid positive preview"]')?.value==='');
  await source.getByRole('button',{name:'All roles',exact:true}).click();await page.waitForFunction(()=>document.querySelector('textarea[aria-label="Hybrid positive preview"]')?.value==='blue eyes');
  await source.getByRole('checkbox',{name:'Include raw source text',exact:true}).uncheck();await source.getByRole('checkbox',{name:'Include associated source components',exact:true}).check();
  await page.waitForFunction(()=>document.querySelector('textarea[aria-label="Hybrid positive preview"]')?.value==='A woman with red hair.\n\nHer hand rests over her forehead.');
  // Role labels and subject metadata remain literal and survive a saved reusable entry.
  await editor.getByRole('button',{name:'Add prose',exact:true}).first().click();const prose=editor.locator('[data-hybrid-component]').last();await prose.getByRole('textbox',{name:'Component name',exact:true}).fill('Room lighting');await prose.getByRole('textbox',{name:'Prose text',exact:true}).fill('A warm, literal {light|shadow}.');await prose.getByLabel('Component role',{exact:true}).selectOption('lighting');await prose.getByLabel('Component subject',{exact:true}).fill('whole scene');await prose.getByRole('button',{name:'Save to library',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('textarea[aria-label="Hybrid positive preview"]')?.value.endsWith('A warm, literal {light|shadow}.'));
  await page.waitForFunction(()=>!document.querySelector('[role="dialog"]')?.textContent.includes('updating…'));
  const saved=await(await page.request.get(base+'/Gallery/prefixes')).json();assert(Object.values(saved.library.hybrid.components).some(row=>row.name==='Room lighting'&&row.role==='lighting'&&row.subject==='whole scene'));
  await post({action:'hybrid_save',revision:saved.revision,component:{id:'qa-global-note',name:'Global note',type:'prose',role:'style',text:'A restrained illustration.',mode:'global'}});await page.evaluate(()=>window.dispatchEvent(new Event('gallery-prefix-library-changed')));
  await page.waitForFunction(()=>document.querySelector('textarea[aria-label="Hybrid positive preview"]')?.value.includes('A restrained illustration.'));
  await inspector.locator('article').filter({has:page.getByText('Global note',{exact:true})}).getByRole('button',{name:'Locate component',exact:true}).click();
  assert.equal(await editor.locator('[data-hybrid-component="qa-global-note"] input[aria-label="Component name"]').evaluate(element=>element===document.activeElement),true);
  // Narrow layout: contingent inspector content and all controls stay inside the panel.
  await page.setViewportSize({width:720,height:900});await page.waitForTimeout(200);
  const overflow=await editor.evaluate(element=>[...element.querySelectorAll('input,select,button,textarea,.hh-tree')].filter(item=>{const r=item.getBoundingClientRect(),p=element.getBoundingClientRect();return r.width&&r.height&&(r.right>p.right+2||r.left<p.left-2);}).map(item=>item.getAttribute('aria-label')||item.tagName));assert.deepEqual(overflow,[]);
  await inspector.scrollIntoViewIfNeeded();if(process.env.GALLERY_QA_SCREENSHOT_ROOT)await page.screenshot({path:process.env.GALLERY_QA_SCREENSHOT_ROOT+'/hybrid-contributions.png',animations:'disabled'});
  assert.deepEqual(errors,[]);console.log('PASS source role selection, independent text/component toggles, live inspector, locate controls, saved labels and narrow layout');
 }catch(error){console.error(await page.evaluate(()=>({document:window.qaRoleNode?.widgets[0].value,preview:document.querySelector('textarea[aria-label="Hybrid positive preview"]')?.value,alerts:[...document.querySelectorAll('[role="alert"]')].map(row=>row.textContent)})));throw error;}finally{
  // Remove the test's automatic global so other browser checks can share this fixture.
  const current=await(await page.request.get(base+'/Gallery/prefixes')).json();await post({action:'hybrid_delete',id:'qa-global-note',revision:current.revision});await browser.close();
 }
})().catch(error=>{console.error(error);process.exit(1);});
