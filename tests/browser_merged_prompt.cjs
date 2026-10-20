const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true});
 const page=await browser.newPage({viewport:{width:1550,height:1200}});const errors=[];page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.goto('http://127.0.0.1:8191');await page.getByRole('tab',{name:'Gallery workspace',exact:true}).click();
  await page.evaluate(()=>{
   const graph=window.comfyAPI.app.app.graph;window.qaMerged=[];
   for(const [index,title] of ['Gallery Prompt Encode (Library)','Gallery Prompt Encode (Negative)'].entries()){
    const host=document.createElement('div');host.id='qa-merged-'+index;host.style.cssText=`position:fixed;left:${10+index*760}px;top:10px;width:730px;height:1160px;overflow:auto;z-index:5000;background:#222;color:white`;document.body.append(host);
    const node={comfyClass:'GalleryPromptEncode',title,widgets:[{name:'text',value:'solo, {long hair|short hair|}, blue eyes'},{name:'source_mode',value:'after'}],inputs:[{name:'source_text',link:null}],properties:{},setDirtyCanvas(){},addWidget(type,name,value,callback){this.widgets.push({type,name,value,callback});},addDOMWidget(name,type,el){host.append(el);return{name,type};}};
    graph.add(node);window.qaExtension.nodeCreated(node);window.qaMerged.push(node);
   }
  });
  for(let index=0;index<2;index++){
   const editor=page.locator('#qa-merged-'+index),box=editor.getByLabel('Tag box #1',{exact:true});
   await box.getByRole('button',{name:'Edit solo',exact:true}).waitFor();
   assert.equal(await editor.getByLabel('Collapsed tag effects').count(),0,'no duplicate read-only prompt dropdown');
   assert(await box.locator('[data-prompt-operator="AND"]').count()>0);assert(await box.locator('[data-prompt-operator="OR"]').count()>0);
   assert(await box.getByText('OPTIONAL',{exact:true}).count()>0);
   await box.getByRole('button',{name:'Collapse box',exact:true}).click();
   await box.getByRole('button',{name:'Edit solo',exact:true}).waitFor({state:'detached'});
   await box.getByRole('button',{name:'Expand tag groups',exact:true}).click();
   await box.getByRole('button',{name:'Edit solo',exact:true}).click();
   const tag=box.getByRole('textbox',{name:'Tag text',exact:true});await tag.fill('portrait');await tag.press('Enter');
   await box.getByRole('button',{name:'Done',exact:true}).click();
   await box.getByRole('button',{name:'Edit portrait',exact:true}).waitFor();
   await box.getByRole('button',{name:'Collapse tag groups',exact:true}).click();
   await box.getByRole('button',{name:'Edit portrait',exact:true}).waitFor({state:'hidden'});
   await box.getByRole('button',{name:'Expand tag groups',exact:true}).click();
   await box.getByRole('button',{name:'Remove short hair',exact:true}).click();
   await page.waitForFunction(index=>!window.qaMerged[index].widgets.find(w=>w.name==='text').value.includes('short hair'),index);
   await page.evaluate(index=>window.qaMerged[index].__galleryPromptBoxes.insert('destination','after','Target'),index);
   await box.getByRole('button',{name:'Edit portrait',exact:true}).dragTo(editor.getByLabel('Tag box Target',{exact:true}));
   await page.waitForFunction(index=>window.qaMerged[index].properties.prompt_boxes.boxes.find(box=>box.name==='Target').chips.some(chip=>chip.text==='portrait'),index);
   await editor.getByLabel('Add ruleset',{exact:true}).selectOption('__hair_prompting__');
   await editor.getByLabel('Hair mode',{exact:true}).selectOption('minimal');
   await editor.getByRole('checkbox',{name:'Keep hair length',exact:true}).uncheck();
   const omitted=box.getByRole('button',{name:'Drag tag long hair',exact:true});
   await page.waitForFunction(index=>document.querySelector('#qa-merged-'+index+' [data-part-drag][data-rule-omitted="true"]'),index);
   assert((await omitted.getAttribute('style')).includes('line-through'));
   await omitted.dragTo(editor.getByLabel('Tag box Target',{exact:true}));
   await page.waitForFunction(index=>window.qaMerged[index].properties.prompt_boxes.boxes.find(box=>box.name==='Target').chips.some(chip=>chip.kind==='or'&&chip.options.includes('long hair')),index);
  }
  assert.deepEqual(errors,[]);console.log('PASS merged tags/prompt: positive and negative edit, collapse, logical badges, member removal, dragging and editable rule omissions');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});

