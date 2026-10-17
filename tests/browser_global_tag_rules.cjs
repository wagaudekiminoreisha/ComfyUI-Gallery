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
    document.getElementById('qa-global')?.remove();const host=document.createElement('div');host.id='qa-global';host.style.cssText='width:460px;position:fixed;right:10px;top:10px;z-index:5000;background:#222';document.body.append(host);
    const node={comfyClass:'GalleryPromptEncode',title:'Global rules QA',widgets:[{name:'text',value:text},{name:'source_mode',value:'after'}],inputs:[{name:'source_text',link:null}],properties:{},setDirtyCanvas(){},addWidget(type,name,value,callback){this.widgets.push({type,name,value,callback});},addDOMWidget(name,type,el){host.append(el);return{name,type};}};
    window.comfyAPI.app.app.graph.add(node);window.qaExtension.nodeCreated(node);window.qaGlobal=node;
   },text);
   const review=page.locator('#qa-global').getByLabel('Global tag review',{exact:true});
   await review.locator('summary').first().click();return review;
  };
  let review=await create('short hair, long hair');await review.getByText(/Hair length: check these tags/).waitFor();
  assert.match(await page.evaluate(()=>window.qaGlobal.widgets[0].value),/^short hair, long hair/);
  review=await create('{blonde hair, short hair|blonde hair, long hair}');
  assert.equal(await review.getByText(/Hair length: check these tags/).count(),0);
  review=await create('blonde hair, brown hair');await review.locator('summary').nth(1).click();await review.getByText(/Hair colour: multiple values can coexist/).waitFor();
  review=await create('solo, 1girl, 1boy');await review.getByText(/Solo and mixed-category counts: check these tags/).waitFor();
  review=await create('unknown magic tag');await review.getByText(/outside this rule pack/).waitFor();
  await page.evaluate(()=>{document.getElementById('qa-global').remove();window.dispatchEvent(new CustomEvent('gallery-prefix-manager',{detail:{name:'Global rule QA',positive:['short hair','long hair'],negative:['standing','sitting']}}));});
  const editor=page.locator('.cg-prefix-editor');await editor.getByRole('textbox',{name:'Prefix name',exact:true}).waitFor();
  const prefixReview=editor.getByLabel('Global tag review',{exact:true});await prefixReview.locator('summary').first().click();await prefixReview.getByText(/Hair length: check these tags/).waitFor();
  await editor.getByRole('tab',{name:/Negative terms/}).click();assert.equal(await editor.getByLabel('Global tag review',{exact:true}).filter({visible:true}).count(),0);
  assert.deepEqual(errors,[]);console.log('PASS global rules UI: scoped warnings, OR branches, compatible colours, three-tag counts, unknown coverage and positive-only prefixes');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
