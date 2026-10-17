const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true});
 const page=await browser.newPage({viewport:{width:1500,height:1100}});const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.goto('http://127.0.0.1:8191');await page.getByRole('tab',{name:'Gallery workspace',exact:true}).click();
  const create=async text=>{
   await page.evaluate(text=>{
    document.getElementById('qa-clothing')?.remove();const host=document.createElement('div');host.id='qa-clothing';host.style.cssText='width:440px;position:fixed;right:10px;top:10px;z-index:5000;background:#222';document.body.append(host);
    const node={comfyClass:'GalleryPromptEncode',title:'Clothing QA',widgets:[{name:'text',value:text},{name:'source_mode',value:'after'}],inputs:[{name:'source_text',link:null}],properties:{},setDirtyCanvas(){},addWidget(type,name,value,callback){this.widgets.push({type,name,value,callback});},addDOMWidget(name,type,el){host.append(el);return{name,type};}};
    window.comfyAPI.app.app.graph.add(node);window.qaExtension.nodeCreated(node);window.qaClothing=node;
   },text);
   await page.locator('#qa-clothing').getByRole('textbox',{name:'New box: type tags and press Enter',exact:true}).waitFor();
  };
  await create('skirt, tracksuit');
  let review=page.locator('#qa-clothing').getByLabel('Clothing review',{exact:true});
  await review.locator('summary').click();await review.getByText(/skirt \+ tracksuit can occur together/).waitFor();
  assert.match(await page.evaluate(()=>window.qaClothing.widgets[0].value),/^skirt, tracksuit/,'review does not alter tags');
  await create('{skirt|tracksuit}');assert.equal(await page.locator('#qa-clothing').getByLabel('Clothing review',{exact:true}).count(),0);
  await create('skirt over track pants');review=page.locator('#qa-clothing').getByLabel('Clothing review',{exact:true});
  await review.locator('summary').click();await review.getByText(/explicit layering is present/).waitFor();
  await page.evaluate(()=>{document.getElementById('qa-clothing').remove();window.dispatchEvent(new CustomEvent('gallery-prefix-manager',{detail:{name:'Layered clothing QA',positive:['skirt over track pants'],negative:['skirt','pants']}}));});
  const editor=page.locator('.cg-prefix-editor');await editor.getByRole('textbox',{name:'Prefix name',exact:true}).waitFor();
  await editor.getByLabel('Clothing review',{exact:true}).locator('summary').click();await editor.getByText(/explicit layering is present/).waitFor();
  await editor.getByRole('tab',{name:/Negative terms/}).click();
  assert.equal(await editor.getByLabel('Clothing review',{exact:true}).filter({visible:true}).count(),0,'negative terms are not interpreted as an outfit');
  const saved=page.waitForResponse(response=>response.url().endsWith('/Gallery/prefixes')&&response.request().method()==='POST'&&response.ok());
  await editor.getByRole('button',{name:'Save prefix',exact:true}).click();await saved;
  const result=await (await page.request.get('http://127.0.0.1:8191/Gallery/prefixes')).json();
  const prefix=result.library.prefixes.find(item=>item.name==='Layered clothing QA');assert(prefix);
  assert(prefix.tags.some(id=>result.library.tags.find(tag=>tag.id===id)?.text.replace(/_/g,' ')==='skirt over track pants'));
  assert.deepEqual(errors,[]);console.log('PASS clothing review: encoder warnings, branch separation, explicit layering, positive-only prefix review and saved recipe');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
