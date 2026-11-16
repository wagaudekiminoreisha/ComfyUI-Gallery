const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const findings=[];
const longPrefix='Hair reference '+ 'long words '.repeat(14);
async function inspect(page,label){
 const rows=await page.evaluate(()=>{
  const visible=el=>el.getBoundingClientRect().width>0&&el.getBoundingClientRect().height>0;
  return [...document.querySelectorAll('.cg-header,.cg-filters,.cg-grid-toolbar,.cg-floating-panel,.cg-floating-panel>div,.cg-source-picker,.cg-source-picker>div,.cg-source-picker>header,.cg-source-picker>footer,.ant-modal-body,.ant-modal-footer,[data-suggestion-menu],[role="menu"],.ant-select-dropdown:not(.ant-select-dropdown-hidden),.ant-dropdown:not(.ant-dropdown-hidden)')].filter(visible).flatMap(el=>{
   const r=el.getBoundingClientRect();
   let scrollable=false;for(let p=el.parentElement;p;p=p.parentElement)if(/auto|scroll/.test(getComputedStyle(p).overflowY)&&p.scrollHeight>p.clientHeight+2)scrollable=true;
   const outside=r.left< -1||r.right>innerWidth+1||(!scrollable&&(r.top< -1||r.bottom>innerHeight+1));
   const overflow=el.scrollWidth>el.clientWidth+2;
   return outside||overflow?[{element:el.getAttribute('data-panel-key')||el.className||el.tagName,outside,overflow,width:el.clientWidth,scroll:el.scrollWidth,rect:{x:r.x,y:r.y,width:r.width,height:r.height},children:[...el.querySelectorAll('*')].filter(e=>e.getBoundingClientRect().right>r.right+2).slice(0,6).map(e=>({tag:e.tagName,class:e.className,style:e.getAttribute('style')})),text:el.textContent.slice(0,120)}]:[];
  });
 });
 for(const row of rows)findings.push({label,...row});
}
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true});
 const errors=[];
 try{
  const setup=await browser.newPage();
  const state=await(await setup.request.get('http://127.0.0.1:8191/Gallery/prefixes')).json();
  const saved=await setup.request.post('http://127.0.0.1:8191/Gallery/prefixes',{data:{action:'save',name:longPrefix,terms:['long_hair'],image_keys:['local:./:/static_gallery/study-1.png'],revision:state.revision}});assert.equal(saved.status(),200);await setup.close();
  for(const viewport of [{width:1280,height:720},{width:850,height:650},{width:480,height:640},{width:360,height:480}]){
   const page=await browser.newPage({viewport});page.setDefaultTimeout(7000);
   page.on('pageerror',error=>errors.push(error.message));
   await page.goto('http://127.0.0.1:8191');await page.getByRole('tab',{name:'Gallery workspace',exact:true}).click();
   await page.locator('[data-gallery-entry]').first().waitFor();
   const size=viewport.width+'x'+viewport.height;
   await inspect(page,size+' workspace');
   await page.evaluate(()=>window.dispatchEvent(new CustomEvent('gallery-prefix-manager',{detail:{positive:['long_tag_'.repeat(18),'{red hair|blue hair|}'],name:'Long prefix name '.repeat(12)}})));
   const editor=page.locator('[data-panel-key="prefix-editor"]');await editor.waitFor();
   await inspect(page,size+' prefix editor');
   if(viewport.width===1280){
    const bounds=await editor.boundingBox(),handle=await editor.getByRole('separator',{name:'Resize panel',exact:true}).boundingBox();
    await page.mouse.move(handle.x+8,handle.y+8);await page.mouse.down();await page.mouse.move(handle.x+8-(bounds.width-320),handle.y-120,{steps:5});await page.mouse.up();
    await inspect(page,size+' editor resized to 320px');
   }
   if(process.env.GALLERY_OVERFLOW_SCREENSHOTS&&viewport.width===480)await editor.screenshot({path:process.env.GALLERY_OVERFLOW_SCREENSHOTS+'/prefix-editor.png'});
   const input=editor.locator('[data-add-input] input').first();await input.fill('hair');
   await page.locator('[data-suggestion-menu]').waitFor();await inspect(page,size+' suggestions');
   await input.press('Escape');
   await editor.locator('[data-chip-id]').first().evaluate(el=>el.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,clientX:innerWidth-1,clientY:innerHeight-1})));
   await page.getByRole('menuitem',{name:'Copy syntax',exact:true}).waitFor();await inspect(page,size+' chip context menu');await page.keyboard.press('Escape');
   await editor.locator('[aria-label^="Drag tag "]').first().evaluate(el=>el.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,clientX:innerWidth-1,clientY:innerHeight-1})));
   await page.getByRole('menuitem',{name:'Copy tag syntax',exact:true}).waitFor();await inspect(page,size+' grouped tag context menu');await page.keyboard.press('Escape');
   await page.evaluate(()=>{
    const node=window.LiteGraph.createNode('GalleryImageSource');window.comfyAPI.app.app.graph.add(node);
    window.dispatchEvent(new CustomEvent('gallery-source-picker',{detail:{node,batch:true,anchor:()=>({left:innerWidth-100,right:innerWidth-8,top:innerHeight/2,bottom:innerHeight/2+30,width:92,height:30})}}));
   });
   await page.locator('.cg-source-picker').waitFor();await inspect(page,size+' batch image picker');
   await page.close();
   const detail=await browser.newPage({viewport});detail.setDefaultTimeout(7000);
   detail.on('pageerror',error=>errors.push(error.message));
   await detail.goto('http://127.0.0.1:8191');await detail.getByRole('tab',{name:'Gallery workspace',exact:true}).click();
   await detail.evaluate(()=>window.dispatchEvent(new CustomEvent('gallery-source-prefix',{detail:['/static_gallery/study-1.png']})));
   await detail.locator('[data-panel-key="source-prefix"]').waitFor();await inspect(detail,size+' associations');
   await detail.locator('[data-panel-key="source-prefix"]').getByRole('button',{name:'Close',exact:true}).first().click();
   await detail.evaluate(()=>window.dispatchEvent(new Event('gallery-rules-open')));
   const rules=detail.locator('[data-panel-key="prompt-rules"]');await rules.waitFor();
   await inspect(detail,size+' rules');
   await rules.getByRole('combobox',{name:'Edit ruleset',exact:true}).click();await detail.locator('.ant-select-dropdown:visible').waitFor();await inspect(detail,size+' rules dropdown');await detail.keyboard.press('Escape');
   await rules.getByRole('button',{name:'Close',exact:true}).first().click();
   await detail.getByRole('button',{name:'Settings',exact:true}).click();
   await detail.getByRole('menuitem',{name:'Gallery settings',exact:true}).click();
   await detail.getByRole('dialog',{name:'Settings',exact:true}).waitFor();
   await inspect(detail,size+' settings');
   await detail.getByRole('dialog',{name:'Settings',exact:true}).getByRole('button',{name:'Return',exact:true}).click();
   await detail.getByText('Both',{exact:true}).click();
   const tags=detail.getByRole('combobox',{name:'Hydrus search tags',exact:true});await tags.fill('hair');
   await detail.locator('.ant-select-dropdown:visible').waitFor();await inspect(detail,size+' Hydrus autocomplete');await detail.keyboard.press('Escape');
   await detail.reload();await detail.getByRole('tab',{name:'Gallery workspace',exact:true}).click();
   await detail.locator('[data-gallery-entry]').first().waitFor();
   await detail.getByAltText('study-4.png',{exact:true}).click();
   const viewer=detail.locator('[data-panel-key="viewer"]');await viewer.waitFor();await inspect(detail,size+' viewer');
   await viewer.getByRole('button',{name:'Append for img2img',exact:true}).click();
   const append=detail.locator('[data-panel-key="append-images"]');await append.waitFor();await inspect(detail,size+' append images');
   await append.getByRole('combobox',{name:'Image Source target',exact:true}).click();await detail.locator('.ant-select-dropdown:visible').waitFor();await inspect(detail,size+' source target dropdown');await detail.keyboard.press('Escape');
   await append.getByRole('button',{name:'Cancel',exact:true}).click();
   await viewer.getByRole('button',{name:'Metadata',exact:true}).click();
   const metadata=detail.locator('[data-panel-key="image-metadata"]');await metadata.waitFor();await inspect(detail,size+' metadata');await metadata.getByRole('button',{name:'Close',exact:true}).first().click();
   await viewer.getByAltText('Viewing study-4.png',{exact:true}).click({button:'right'});await detail.getByRole('menuitem',{name:'Export this image to Hydrus',exact:true}).waitFor();await inspect(detail,size+' image context menu');
   await detail.getByRole('menuitem',{name:'Export this image to Hydrus',exact:true}).click();
   const exporting=detail.locator('[data-panel-key="hydrus-export"]');await exporting.waitFor();await inspect(detail,size+' export');
   await detail.close();
  }
  assert.deepEqual(errors,[]);
  if(process.env.GALLERY_OVERFLOW_REPORT_ONLY!=='1')assert.deepEqual(findings,[]);
  console.log('PASS overflow audit: four viewport sizes, long labels, floating windows, autocomplete, context menus, batch picker, append, settings, rules, metadata and export');
 }finally{console.log(JSON.stringify(findings,null,2));await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
