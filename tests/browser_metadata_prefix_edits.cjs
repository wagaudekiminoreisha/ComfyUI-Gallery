const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true});
 const page=await browser.newPage({viewport:{width:1500,height:1100}});const errors=[];let writes=0;
 page.on('pageerror',error=>errors.push(error.message));
 page.on('request',request=>{if(new URL(request.url()).pathname==='/Gallery/prefixes'&&request.method()==='POST')writes++;});
 try{
  await page.goto('http://127.0.0.1:8191');await page.getByRole('tab',{name:'Gallery workspace',exact:true}).click();
  await page.getByAltText('study-4.png',{exact:true}).click({button:'right'});await page.getByRole('menuitem',{name:'Metadata',exact:true}).click();
  const info=page.locator('[data-panel-key="image-metadata"]'),search=info.getByRole('searchbox',{name:'Search metadata',exact:true});
  await info.focus();await page.keyboard.press('Control+f');assert(await search.evaluate(el=>el===document.activeElement));
  await search.fill('ksampler');const results=info.getByLabel('Metadata search results',{exact:true});
  await results.getByText('prompt.92.class_type',{exact:true}).waitFor();assert(await results.locator('mark').count()>0);
  await search.fill('not-a-metadata-value');await results.getByText('No metadata matches.',{exact:true}).waitFor();
  await search.fill('');await results.waitFor({state:'detached'});
  await info.getByRole('button',{name:'Prefix associations…',exact:true}).click();
  const flow=page.locator('[data-panel-key="source-prefix"]'),picker=flow.getByRole('combobox',{name:'Prefix for these images',exact:true});
  const before=await flow.getByRole('tab').filter({hasText:/^Positive/}).innerText();
  await picker.fill('Draft original');await page.getByTitle('Create new prefix “Draft original”',{exact:true}).waitFor();await picker.press('Enter');
  const name=flow.getByRole('textbox',{name:'New prefix name',exact:true});await page.waitForFunction(()=>document.querySelector('input[aria-label="New prefix name"]')?.value==='Draft original');
  await name.fill('Renamed draft');await name.press('Enter');
  await flow.getByText('New prefix “Renamed draft” (created when you save)',{exact:true}).waitFor();
  assert.equal(await flow.getByRole('tab').filter({hasText:/^Positive/}).innerText(),before);
  await name.fill('');assert.equal(await picker.inputValue(),'');
  await name.fill('A new draft');assert.equal(await name.inputValue(),'A new draft');assert.equal(writes,0,'Enter and rename must not persist a prefix');
  assert.deepEqual(errors,[]);
  console.log('PASS scoped metadata search, keyboard shortcut, highlights/clear, and editable/removable prefix name after Enter without saving or losing terms');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
