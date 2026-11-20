const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true}),page=await browser.newPage({viewport:{width:1400,height:1000}}),errors=[];page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(15000);const base='http://127.0.0.1:8191',sentence='this character should have her hand over her forehead',custom='qa_filter_trigger_'+Date.now().toString(36),customDisplay=custom.replace(/_/g,' ');
 try{
  await page.route('**/Gallery/images?**',async route=>{const response=await route.fetch(),data=await response.json();for(const folder of Object.values(data.folders))for(const file of Object.values(folder)){const text=file.name==='study-1.png'?'(blond_hair:1.2), '+custom:file.name==='study-2.png'?sentence:file.name==='study-3.png'?'this character has blue hair and looks away':'blue_hair, blue_eyes';file.metadata={...file.metadata,prompt:{'1':{class_type:'CLIPTextEncode',inputs:{text}},'2':{class_type:'KSampler',inputs:{positive:['1',0]}}}};}await route.fulfill({json:data});});
  const vocabularyReady=page.waitForResponse(response=>response.url().includes('/Gallery/prompt-tag-vocabulary')&&response.status()===200);
  await page.goto(base);await page.getByRole('tab',{name:'Gallery workspace',exact:true}).click();
  const count=n=>page.waitForFunction(n=>document.querySelectorAll('[data-gallery-entry]').length===n,n),search=page.getByRole('combobox',{name:'Filter local files',exact:true});
  const initialVocabulary=await vocabularyReady,etag=await initialVocabulary.headerValue('ETag');assert(etag);assert.equal((await page.request.get(base+'/Gallery/prompt-tag-vocabulary',{headers:{'If-None-Match':etag}})).status(),304);
  await count(4);await page.getByText('Loading searchable prompt tags…',{exact:true}).waitFor({state:'hidden'});
  await search.fill('blonde hair');await count(1);await page.getByAltText('study-1.png',{exact:true}).waitFor();await search.fill('blond hair');await count(1);
  await search.fill(sentence);await count(0);assert.equal(await page.getByRole('option').filter({hasText:sentence}).count(),0);
  await search.fill('blue hair');await count(1);await page.getByAltText('study-4.png',{exact:true}).waitFor();await search.fill(customDisplay);await count(0);
  // Registering a custom library tag updates filters and suggestions without reloading images.
  const prior=await(await page.request.get(base+'/Gallery/prefixes')).json(),saved=await page.request.post(base+'/Gallery/prefixes',{data:{action:'save',revision:prior.revision,name:'Custom filter '+custom,terms:[custom]}});assert.equal(saved.status(),200);
  const refresh=page.waitForResponse(response=>response.url().includes('/Gallery/prompt-tag-vocabulary')&&response.status()===200);await page.evaluate(()=>window.dispatchEvent(new Event('gallery-prefix-library-changed')));await refresh;await count(1);await page.getByAltText('study-1.png',{exact:true}).waitFor();
  await search.press('Enter');await count(1);await search.press('Backspace');await count(4);
  let outage=true;await page.route('**/Gallery/prompt-tag-vocabulary',route=>outage?route.fulfill({status:503,json:{error:'QA vocabulary unavailable'}}):route.continue());await page.reload();await page.getByRole('tab',{name:'Gallery workspace',exact:true}).click();const retry=page.getByRole('button',{name:'Retry tag definitions',exact:true});await retry.waitFor();outage=false;await retry.click();await retry.waitFor({state:'hidden'});await search.fill('blonde hair');await count(1);
  assert.deepEqual(errors,[]);console.log('PASS database-only gallery prompt filters, aliases, no word mining, no prose suggestions and live saved-custom-tag registration');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
