const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true});const page=await browser.newPage({viewport:{width:1500,height:1100}});const errors=[];page.on('pageerror',e=>errors.push(e.message));let release;const gate=new Promise(resolve=>release=resolve);let archiveMode='pending',metadataReads=0;
try{
 await page.route('**/Gallery/archive?**',async route=>{
  if(archiveMode==='pending')await gate;
  await route.fulfill({status:archiveMode==='error'?500:200,contentType:'application/json',body:JSON.stringify(archiveMode==='error'?{error:'Archive read failed'}:{urls:['/static_gallery/study-1.png']})});
 });
 await page.route('**/Gallery/images?**',async route=>{const response=await route.fetch(),data=await response.json();for(const folder of Object.values(data.folders))for(const file of Object.values(folder))file.metadata={...file.metadata,gallery_metadata_deferred:true};await route.fulfill({json:data});});
 await page.route('**/Gallery/local-metadata?**',route=>{metadataReads++;return route.fulfill({json:{metadata:{fileinfo:{resolution:'640x440'},prompt:{'77':{class_type:'FullWorkflowOnlyMarker',inputs:{text:'full metadata retained'}}}}}});});
 await page.goto('http://127.0.0.1:8191');await page.getByRole('tab',{name:'Gallery workspace',exact:true}).click();
 await page.getByAltText('study-1.png',{exact:true}).waitFor();assert.equal(metadataReads,0,'browsing never loads full workflows');
 archiveMode='ready';release();await page.getByAltText('study-1.png',{exact:true}).waitFor({state:'detached'});
 archiveMode='error';await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.getByRole('alert').filter({hasText:'Archive unavailable'}).waitFor();assert.equal(await page.getByAltText('study-1.png',{exact:true}).count(),0,'cached membership survives a transient failure');
 await page.getByAltText('study-2.png',{exact:true}).waitFor();await page.getByAltText('study-2.png',{exact:true}).click({button:'right'});await page.getByRole('menuitem',{name:'Metadata',exact:true}).click();
 const info=page.locator('[data-panel-key="image-metadata"]');await info.getByRole('searchbox',{name:'Search metadata',exact:true}).fill('FullWorkflowOnlyMarker');await info.getByText('prompt.77.class_type',{exact:true}).waitFor();assert.equal(metadataReads,1);await info.getByRole('button',{name:'Close',exact:true}).first().click();
 archiveMode='ready';await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.getByText('Archive',{exact:true}).click();await page.getByAltText('study-1.png',{exact:true}).waitFor();await page.getByText('Media',{exact:true}).click();await page.getByAltText('study-2.png',{exact:true}).waitFor();
 await page.unroute('**/Gallery/images?**');await page.route('**/Gallery/images?**',route=>route.fulfill({status:500,contentType:'application/json',body:'{"error":"scan failed"}'}));await page.getByRole('button',{name:'Reload local images',exact:true}).click();await page.getByRole('alert').filter({hasText:'Cannot load local files'}).waitFor();
 assert.deepEqual(errors,[]);console.log('PASS local browsing independent of archive loading, cached membership on errors, deferred full metadata, archive navigation and visible catalogue failures');
}finally{release?.();await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1});
