const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true});
 const page=await browser.newPage({viewport:{width:1400,height:1100}}),errors=[];
 page.setDefaultTimeout(15000);page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.goto('http://127.0.0.1:8191');
  await page.getByRole('tab',{name:'Gallery workspace',exact:true}).click();
  await page.evaluate(()=>{
   const host=document.createElement('div');host.id='qa-source-groups';host.style.cssText='position:fixed;right:0;top:0;width:700px;height:1050px;overflow:auto;z-index:5000;background:#222';document.body.append(host);
   const graph=window.comfyAPI.app.app.graph;
   const source={type:'GalleryImageSource',widgets:[{name:'sources',value:JSON.stringify({version:1,layout:'horizontal',images:['a.png','b.png'].map(input_name=>({input_name,prompt:{positive:'({blue eyes|green eyes}:1.2), long hair',negative:''}}))})}]};
   graph.add(source);graph.links={77:{origin_id:source.id,origin_slot:4}};
   const node={comfyClass:'GalleryPromptEncode',widgets:[{name:'text',value:''},{name:'source_mode',value:'after'}],inputs:[{name:'source_text',link:77}],properties:{},setDirtyCanvas(){},addWidget(type,name,value,callback){this.widgets.push({type,name,value,callback});},addDOMWidget(name,type,el){host.append(el);return{name,type};}};
   graph.add(node);window.qaExtension.nodeCreated(node);window.qaSource=source;window.qaEncoder=node;
  });
  const editor=page.locator('#qa-source-groups');
  const source=editor.getByRole('combobox',{name:'Source image for tag exclusions',exact:true});
  await source.waitFor();
  await editor.getByRole('button',{name:'Add an option',exact:true}).click();
  const option=editor.getByRole('textbox',{name:'Add an option',exact:true});
  await option.fill('hazel eyes');await option.press('Enter');await option.press('Escape');
  await editor.getByRole('button',{name:'Remove green eyes',exact:true}).click();
  await editor.getByRole('combobox',{name:'Chip kind',exact:true}).selectOption('optional');
  await editor.getByRole('button',{name:'Select tag group for additions',exact:true}).click();
  await editor.getByRole('spinbutton',{name:'Weight',exact:true}).fill('1.4');
  const payload=()=>page.evaluate(()=>JSON.parse(window.qaEncoder.widgets.find(widget=>widget.name==='source_image_exclusions').serializeValue()));
  let value=await payload();
  assert.deepEqual(value.segments[0].replacements,{'({blue eyes|green eyes}:1.2)':'({blue eyes|hazel eyes|}:1.4)'});
  assert.equal(value.segments[1].replacements,undefined);
  assert((await page.evaluate(()=>window.qaSource.widgets[0].value)).includes('green eyes'));
  await source.selectOption('b.png:positive');
  await editor.getByRole('button',{name:'Remove green eyes',exact:true}).waitFor();
  assert.equal(await editor.getByRole('button',{name:'Remove hazel eyes',exact:true}).count(),0);
  await page.evaluate(()=>{window.qaEncoder.properties=JSON.parse(JSON.stringify(window.qaEncoder.properties));window.qaEncoder.onConfigure?.({});});
  await source.selectOption('a.png:positive');
  await editor.getByRole('button',{name:'Remove hazel eyes',exact:true}).waitFor();
  assert.deepEqual((await payload()).segments[0].replacements,value.segments[0].replacements);
  await editor.getByRole('button',{name:'Reset source tag ({blue eyes|green eyes}:1.2)',exact:true}).click();
  await editor.getByRole('button',{name:'Remove green eyes',exact:true}).waitFor();
  assert.deepEqual(await payload(),{});
  assert.deepEqual(errors,[]);
  console.log('PASS editable source groups: options, kind, weight, per-image isolation, save/reload, reset and execution payload');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
