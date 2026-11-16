const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true});
 const page=await browser.newPage({viewport:{width:1500,height:1050}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto('http://127.0.0.1:8191');await page.getByRole('tab',{name:'Gallery workspace',exact:true}).click();
  await page.getByAltText('study-4.png',{exact:true}).click();
  const viewer=page.getByRole('dialog',{name:/Gallery viewer/}),selected=viewer.getByRole('checkbox',{name:'Selected',exact:true});
  const image=()=>viewer.getByRole('img',{name:/^Viewing /});await image().waitFor();
  await viewer.getByRole('button',{name:'Metadata',exact:true}).focus();
  await image().click();assert.equal(await selected.isChecked(),false,'clicking to focus must not select');
  assert.equal(await page.getByRole('button',{name:'Selection mode ON',exact:true}).count(),0);
  const first=await image().getAttribute('alt');await page.keyboard.press('ArrowRight');assert.notEqual(await image().getAttribute('alt'),first);
  await viewer.getByTitle('Next image (→)',{exact:true}).focus();
  await page.keyboard.press('ArrowLeft');assert.equal(await image().getAttribute('alt'),first,'viewer button focus must not swallow arrow navigation');
  await image().dblclick({delay:240});assert.equal(await selected.isChecked(),false,'slow OS double-click must not select');
  await image().dblclick({delay:20});assert.equal(await selected.isChecked(),true,'fast double-click selects');
  await image().click();assert.equal(await selected.isChecked(),true,'focus click preserves deliberate selection');
  await image().dblclick({delay:20});assert.equal(await selected.isChecked(),false,'fast double-click deselects');
  await image().click({modifiers:['Control']});assert.equal(await selected.isChecked(),true);
  await page.keyboard.press('Space');assert.equal(await selected.isChecked(),false);
  await selected.check();assert.equal(await selected.isChecked(),true);
  assert.deepEqual(errors,[]);console.log('PASS focus-only image clicks, 160ms double-click gate, arrow navigation after button focus, modifier click, Space and explicit selection');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
