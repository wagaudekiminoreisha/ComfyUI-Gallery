const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const crypto=require('node:crypto'),fs=require('node:fs'),JSZip=require('../web/node_modules/jszip');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true});
 const page=await browser.newPage({viewport:{width:1500,height:1100}}),errors=[];page.setDefaultTimeout(12000);page.on('pageerror',error=>errors.push(error.message));
 const base='http://127.0.0.1:8191';
 const make=async color=>(await(await page.request.post(base+'/qa-cache-output',{data:{color}})).json());
 const emit=()=>page.evaluate(()=>window.qaListeners.executed({detail:{output:{images:[{filename:'cache-reuse.png',type:'output'}]}}}));
 const pixel=async image=>{await image.evaluate(el=>el.decode());return image.evaluate(el=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const ctx=canvas.getContext('2d');ctx.drawImage(el,0,0,1,1);return [...ctx.getImageData(0,0,1,1).data].slice(0,3);});};
 try{
  await make('red');await page.goto(base);await page.getByRole('tab',{name:'Gallery workspace',exact:true}).click();
  // Prime a legacy, unversioned URL in Chromium's real HTTP cache. Do not use
  // page.route here: request interception disables that cache in Playwright.
  const cached=await page.evaluate(async()=>{const response=await fetch('/static_gallery/cache-reuse.png');await response.arrayBuffer();return response.headers.get('Cache-Control');});assert(cached.includes('immutable'));
  await page.getByRole('button',{name:'Workflow',exact:true}).click();
  await page.evaluate(()=>{const host=document.createElement('div');host.style.cssText='position:fixed;left:0;top:64px;width:280px;height:900px;z-index:2000';document.body.append(host);window.qaSidebar.render(host);});
  await emit();const pane=page.getByRole('region',{name:'Gallery assets',exact:true});await pane.getByRole('button',{name:'View cache-reuse.png',exact:true}).click();
  let viewer=page.locator('[data-panel-key="workflow-viewer"]');let image=viewer.getByAltText('Viewing cache-reuse.png',{exact:true});assert.deepEqual(await pixel(image),[255,0,0]);
  await viewer.getByRole('button',{name:'Delete',exact:true}).click();await page.getByRole('dialog',{name:'Delete 1 local file(s)?',exact:true}).getByRole('button',{name:'Delete permanently',exact:true}).click();
  await pane.getByRole('button',{name:'View cache-reuse.png',exact:true}).waitFor({state:'detached'});
  const blue=await make('blue');await emit();await pane.getByRole('button',{name:'View cache-reuse.png',exact:true}).click();
  viewer=page.locator('[data-panel-key="workflow-viewer"]');image=viewer.getByAltText('Viewing cache-reuse.png',{exact:true});assert.deepEqual(await pixel(image),[0,0,255]);
  await image.click({button:'right'});const download=page.waitForEvent('download');await page.getByRole('menuitem',{name:'Download original(s)',exact:true}).click();
  const zip=await JSZip.loadAsync(fs.readFileSync(await(await download).path()));const png=Object.values(zip.files).find(file=>file.name.endsWith('.png'));assert(png);
  assert.equal(crypto.createHash('sha256').update(await png.async('nodebuffer')).digest('hex'),blue.sha256);
  // A full refresh drops the session list; the filesystem revision must still
  // distinguish the new file from the cached old file with the same name.
  await page.reload();await page.getByRole('tab',{name:'Gallery workspace',exact:true}).click();await page.getByAltText('cache-reuse.png',{exact:true}).click();
  image=page.locator('[data-panel-key="viewer"]').getByAltText('Viewing cache-reuse.png',{exact:true});assert.deepEqual(await pixel(image),[0,0,255]);
  assert.deepEqual(errors,[]);console.log('PASS reused generated filename: cached old image, deletion, new session preview, exact downloaded bytes, and full-refresh workspace preview');
 }finally{await page.request.post(base+'/Gallery/delete',{data:{image_path:'/static_gallery/cache-reuse.png'}});await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
