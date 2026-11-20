const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true}),page=await browser.newPage({viewport:{width:1400,height:1000}}),base='http://127.0.0.1:8191',errors=[];page.setDefaultTimeout(12000);page.on('pageerror',error=>errors.push(error.message));
 const browse=async refinements=>(await(await page.request.post(base+'/Gallery/hydrus/dictionary',{data:{browse:true,refinements,selection:true,limit:10000}})).json());
 try{
  const tops=await browse(['tag_group:attire::clothing-tops']),both=await browse(['tag_group:attire::clothing-tops','tag_group:attire::clothing-bottoms']);
  await page.goto(base);await page.getByRole('tab',{name:'Gallery workspace',exact:true}).click();
  await page.evaluate(()=>{
   const host=document.createElement('div');document.body.append(host);
   const node={comfyClass:'GalleryPromptEncode',widgets:[{name:'text',value:'base'},{name:'source_mode',value:'after'}],inputs:[],properties:{},setDirtyCanvas(){},addWidget(type,name,value,callback){this.widgets.push({type,name,value,callback});},addDOMWidget(name,type,el){host.append(el);return{name,type};}};
   window.comfyAPI.app.app.graph.add(node);window.qaExtension.nodeCreated(node);window.qaVocabularyNode=node;
  });
  await page.waitForFunction(()=>window.qaVocabularyNode.widgets.some(widget=>widget.name==='Open prompt library'));
  await page.evaluate(()=>window.qaVocabularyNode.widgets.find(widget=>widget.name==='Open prompt library').callback());
  const manager=page.getByRole('dialog',{name:'Prompts & prefixes',exact:true}),palette=manager.locator('.cg-prompt-palette'),tree=palette.getByRole('combobox',{name:'Tag categories and subcategories',exact:true});
  const pick=async(id,search)=>{
   const item=tops.refinements.find(item=>item.value===id);await tree.click();await tree.fill(search);await tree.press('ArrowDown');
   const label=page.getByText(item.label+' ('+item.count+')',{exact:true}).last();
   await label.click();await tree.press('Escape');
  };
  await pick('tag_group:attire::clothing-tops','Tops');await palette.getByRole('button',{name:'Select all matching ('+tops.total+')',exact:true}).waitFor();
  await palette.getByRole('button',{name:'Select all matching ('+tops.total+')',exact:true}).click();await palette.getByRole('button',{name:'Append selected ('+tops.total+')',exact:true}).waitFor();
  await pick('tag_group:attire::clothing-bottoms','Bottoms');await palette.getByRole('button',{name:'Select all matching ('+both.total+')',exact:true}).waitFor();
  await palette.getByRole('button',{name:'Select all matching ('+both.total+')',exact:true}).click();await palette.getByRole('button',{name:'Append selected ('+both.total+')',exact:true}).waitFor();
  await palette.getByRole('button',{name:'Append selected ('+both.total+')',exact:true}).click();
  const compiled=await page.evaluate(()=>window.qaVocabularyNode.widgets.find(widget=>widget.name==='text').value);assert.ok(compiled.includes('shirt'));assert.ok(compiled.includes('skirt'));assert.ok(!compiled.includes('blue eyes'));
  await palette.getByRole('textbox',{name:'Browse vocabulary',exact:true}).fill('shirt');await palette.getByRole('button',{name:/^(Add|Search for) shirt$/}).waitFor();
  await palette.getByRole('button',{name:/^(Add|Search for) skirt$/}).waitFor({state:'detached'});
  await tree.click();await tree.fill('Attire');
  if(process.env.GALLERY_QA_SCREENSHOT_ROOT)await page.screenshot({path:process.env.GALLERY_QA_SCREENSHOT_ROOT+'/library-subcategories.png',animations:'disabled'});
  assert.deepEqual(errors,[]);console.log('PASS library subcategory search, independent children, union counts, select-all, filtered append and text search');
 }catch(error){console.error((await page.locator('body').innerText()).slice(-2200));await page.screenshot({path:require('node:os').tmpdir()+'/library-tree-debug.png'});throw error;}finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
