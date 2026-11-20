const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true}),page=await browser.newPage({viewport:{width:1300,height:1100}}),errors=[];page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(12000);const base='http://127.0.0.1:8191';
 const get=async()=>await(await page.request.get(base+'/Gallery/prefixes')).json(),post=async data=>{const response=await page.request.post(base+'/Gallery/prefixes',{data});assert.equal(response.status(),200,await response.text());return response.json();};
 try{
  let data=await get();data=await post({action:'save',name:'Recipe defaults QA',terms:['blue eyes','standing'],revision:data.revision});const prefix=data.library.prefixes.find(row=>row.name==='Recipe defaults QA');
  data=await post({action:'snapshot',prefix_id:prefix.id,terms:['green eyes','standing'],negative_terms:[],rules:[],revision:data.revision});const snapshot=data.snapshot_id;
  await page.goto(base);await page.getByRole('tab',{name:'Gallery workspace',exact:true}).click();
  await page.evaluate(({prefix,snapshot})=>{
   const host=document.createElement('div');host.id='qa-recipes';host.style.cssText='position:fixed;left:0;top:0;width:850px;height:1050px;overflow:auto;z-index:5000;background:#222';document.body.append(host);const graph=window.comfyAPI.app.app.graph;
   const source={type:'GalleryImageSource',widgets:[{name:'sources',value:JSON.stringify({version:1,layout:'single',images:[{input_name:'recipe.png',prompt:{positive:'green eyes, standing',negative:''},metadata:{gallery_prefix:{id:prefix.id,name:prefix.name,snapshot_id:snapshot,session_id:'old-server-session',positive:['green eyes','standing'],negative:[]}}}]})}],setDirtyCanvas(){}};graph.add(source);graph.links={71:{origin_id:source.id,origin_slot:4}};
   const node={comfyClass:'GalleryPromptEncode',widgets:[{name:'text',value:''},{name:'source_mode',value:'after'}],inputs:[{name:'source_text',link:71}],properties:{},setDirtyCanvas(){},addWidget(type,name,value,callback){this.widgets.push({type,name,value,callback});},addDOMWidget(name,type,el){host.append(el);return{name,type};}};graph.add(node);window.qaExtension.nodeCreated(node);window.qaRecipeSource=source;window.qaRecipeEncoder=node;
  },{prefix,snapshot});
  const editor=page.locator('#qa-recipes'),originals=editor.locator('summary').filter({hasText:'Original contributions · edit sources and groups'});await originals.waitFor({state:'attached'});if(await originals.isVisible())await originals.click();
  const chooser=editor.getByLabel('Source recipe Recipe defaults QA',{exact:true});await chooser.waitFor();assert.equal(await chooser.inputValue(),'');
  await page.waitForFunction(()=>JSON.parse(window.qaRecipeSource.widgets[0].value).images[0].prompt.positive.includes('blue eyes')&&!JSON.parse(window.qaRecipeSource.widgets[0].value).images[0].prompt.positive.includes('green eyes'));
  await chooser.selectOption(snapshot);await editor.getByText('Snapshot tag changes',{exact:true}).click();await editor.getByText(/Added: green eyes/).waitFor();
  assert.equal(await page.evaluate(()=>JSON.parse(window.qaRecipeSource.widgets[0].value).images[0].prompt.positive),'green eyes, standing');
  await chooser.selectOption('');assert.equal(await page.evaluate(()=>JSON.parse(window.qaRecipeSource.widgets[0].value).images[0].prompt.positive),'blue eyes, standing');
  assert.deepEqual(errors,[]);console.log('PASS prior-session snapshot returns to prefix; encoder snapshot chooser shows tag differences and restores parent');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
