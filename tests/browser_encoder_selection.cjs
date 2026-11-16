const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true}),page=await browser.newPage({viewport:{width:1400,height:1100}}),errors=[];page.setDefaultTimeout(10000);page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.goto('http://127.0.0.1:8191');await page.getByRole('tab',{name:'Gallery workspace',exact:true}).click();
  await page.evaluate(()=>{
   const graph=window.comfyAPI.app.app.graph,host=document.createElement('div');host.id='qa-selections';host.style.cssText='position:fixed;left:0;top:0;width:800px;height:1050px;overflow:auto;z-index:5000;background:#222';document.body.append(host);
   const source={type:'GalleryImageSource',widgets:[{name:'sources',value:JSON.stringify({version:1,layout:'single',images:[{input_name:'qa.png',prompt:{positive:'t-shirt, blue_shirt',negative:'blurry'}}]})}]};graph.add(source);graph.links={71:{origin_id:source.id,origin_slot:4}};
   const node={comfyClass:'GalleryPromptEncode',widgets:[{name:'text',value:'alpha, beta, gamma'},{name:'source_mode',value:'after'}],inputs:[{name:'source_text',link:71},{name:'source_text_2',link:null}],properties:{},setDirtyCanvas(){},addInput(name,type){this.inputs.push({name,type,link:null});},disconnectInput(index){this.inputs[index].link=null;},addWidget(type,name,value,callback){this.widgets.push({type,name,value,callback});},addDOMWidget(name,type,el){host.append(el);return{name,type};}};
   graph.add(node);window.qaExtension.nodeCreated(node);window.qaSelectionEncoder=node;
  });
  const editor=page.locator('#qa-selections'),first=editor.getByLabel('Tag box #1',{exact:true});
  await first.getByRole('button',{name:'Select chips',exact:true}).click();await first.getByRole('button',{name:'Edit alpha',exact:true}).click();await first.getByRole('button',{name:'Edit beta',exact:true}).click();
  await first.getByRole('button',{name:'Edit alpha',exact:true}).click({button:'right'});await page.mouse.move(1100,900);await page.getByRole('menuitem',{name:'Optional group',exact:true}).waitFor();await page.getByRole('menuitem',{name:'Optional group',exact:true}).click();
  const chips=await page.evaluate(()=>window.qaSelectionEncoder.properties.prompt_boxes.boxes.find(box=>box.kind==='group').chips);assert.equal(chips.length,2);assert.deepEqual(chips[0].options,['alpha, beta']);assert.equal(chips[1].text,'gamma');
  assert.equal(await editor.getByRole('button',{name:'Add source input',exact:true}).count(),0);
  await editor.getByRole('button',{name:'Add tag box',exact:true}).click();await editor.getByLabel('Tag box #2',{exact:true}).waitFor();
  const state=await page.evaluate(()=>window.qaSelectionEncoder.properties.prompt_boxes);const other=state.boxes.find(box=>box.kind==='group'&&box.name==='#2');
  await first.getByLabel('Merge tag box #1',{exact:true}).selectOption(other.id);await editor.getByLabel('Tag box #2',{exact:true}).waitFor({state:'detached'});
  await page.evaluate(()=>{const node=window.qaSelectionEncoder;node.inputs[0].link=null;node.onConnectionsChange?.(1,0,false);});await editor.locator('[data-source-input]').waitFor({state:'detached'});
  await page.evaluate(()=>{const node=window.qaSelectionEncoder;node.inputs[1].link=71;node.onConnectionsChange?.(1,1,true);});await editor.locator('[data-source-input="source_text_2"]').waitFor();
  assert.deepEqual(errors,[]);console.log('PASS actual multi-chip context grouping, stable context menus, manual box creation/merge and wire-owned source cards');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
