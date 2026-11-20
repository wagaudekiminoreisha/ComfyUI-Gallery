const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true}),page=await browser.newPage({viewport:{width:1200,height:950}}),errors=[];page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(12000);
 try{
  const images=[];for(let i=1;i<=3;i++)images.push(await(await page.request.post('http://127.0.0.1:8191/Gallery/source/local',{data:{url:'/static_gallery/study-'+i+'.png'}})).json());
  await page.goto('http://127.0.0.1:8191');await page.getByRole('tab',{name:'Gallery workspace',exact:true}).click();
  await page.evaluate(images=>{
   const source={type:'GalleryImageSource',properties:{gallery_source_groups:[{id:'arrival',name:'Original batch',kind:'arrival',images:images.map(image=>image.input_name)}]},widgets:[{name:'sources',value:JSON.stringify({version:1,layout:'horizontal',images})}],setDirtyCanvas(){}};window.comfyAPI.app.app.graph.add(source);window.qaGroupSource=source;
   window.qaOpenGroups=()=>window.dispatchEvent(new CustomEvent('gallery-source-picker',{detail:{node:source,anchor:()=>({left:20,top:50,right:340,bottom:80,width:320,height:30})}}));window.qaOpenGroups();
  },images);
  const picker=page.getByRole('dialog',{name:"This node's image history",exact:true});
  await picker.getByRole('checkbox',{name:'Select group Original batch',exact:true}).waitFor();
  await picker.locator('.sp-image').last().click();await picker.getByRole('textbox',{name:'Image group name',exact:true}).fill('Identity pair');await picker.getByRole('button',{name:'Save group',exact:true}).click();
  await picker.getByRole('button',{name:'Use image group Identity pair',exact:true}).click();await picker.waitFor({state:'hidden'});
  let state=await page.evaluate(()=>JSON.parse(window.qaGroupSource.widgets[0].value));assert.equal(state.images.length,2);assert.deepEqual(state.batch_indices,[0,1]);
  await page.evaluate(()=>window.qaOpenGroups());await picker.getByLabel('Image grouping',{exact:true}).selectOption('arrivals');await picker.getByLabel('Switch image group',{exact:true}).selectOption('arrival');await picker.waitFor({state:'hidden'});
  state=await page.evaluate(()=>JSON.parse(window.qaGroupSource.widgets[0].value));assert.equal(state.images.length,3);assert.deepEqual(state.batch_indices,[0,1,2]);
  await page.evaluate(()=>window.qaOpenGroups());await picker.getByLabel('Image grouping',{exact:true}).selectOption('manual');
  const option=await picker.getByLabel('Switch image group',{exact:true}).locator('option').filter({hasText:'Identity pair'}).getAttribute('value');await picker.getByLabel('Switch image group',{exact:true}).selectOption(option);
  assert.equal((await page.evaluate(()=>JSON.parse(window.qaGroupSource.widgets[0].value))).images.length,2);assert.deepEqual(errors,[]);
  console.log('PASS grouped picker selection, named batch creation, switching and restoration from history');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
