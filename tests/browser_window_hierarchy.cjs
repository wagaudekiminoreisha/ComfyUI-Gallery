const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true});
 const page=await browser.newPage({viewport:{width:1650,height:1100}});const errors=[];
 page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(10000);
 try {
  await page.goto('http://127.0.0.1:8191');await page.getByRole('tab',{name:'Gallery workspace',exact:true}).click();
  await page.getByAltText('study-4.png',{exact:true}).click();
  const viewer=page.locator('[data-panel-key="viewer"]');
  await viewer.getByRole('button',{name:'Maximize panel',exact:true}).click();
  const above=async key=>{
    await page.waitForFunction(key=>{
      const child=document.querySelector('[data-panel-key="'+key+'"]'),parent=document.querySelector('[data-panel-key="viewer"]');
      return child&&parent&&Number(getComputedStyle(child).zIndex)>Number(getComputedStyle(parent).zIndex);
    },key);
  };
  for(let i=0;i<2;i++) {
    await viewer.focus();await viewer.getByRole('button',{name:'Metadata',exact:true}).click();await above('image-metadata');
  }
  await page.locator('[data-panel-key="image-metadata"]').getByRole('button',{name:'Close',exact:true}).first().click();
  for(let i=0;i<2;i++) {
    await viewer.focus();await viewer.getByRole('button',{name:'Use for prefix…',exact:true}).click();await above('source-prefix');
  }
  await page.locator('[data-panel-key="source-prefix"]').getByRole('button',{name:'Close',exact:true}).first().click();
  for(let i=0;i<2;i++) {
    await viewer.focus();await viewer.getByAltText('Viewing study-4.png',{exact:true}).click({button:'right'});
    await page.getByRole('menuitem',{name:'Export local selection to Hydrus',exact:true}).click();await above('hydrus-export');
  }
  await page.locator('[data-panel-key="hydrus-export"]').getByRole('button',{name:'Close',exact:true}).first().click();
  await viewer.focus();await viewer.getByRole('button',{name:'Delete',exact:true}).click();
  const confirm=page.getByRole('dialog',{name:'Delete 1 local file(s)?',exact:true});await confirm.waitFor();
  assert(await confirm.evaluate(el=>Number(getComputedStyle(el.closest('.ant-modal-wrap')).zIndex)>Number(getComputedStyle(document.querySelector('[data-panel-key="viewer"]')).zIndex)));
  await confirm.getByRole('button',{name:'Cancel',exact:true}).click();
  assert.deepEqual(errors,[]);
  console.log('PASS repeated metadata, prefix and export requests above maximized viewer, child menu and confirmation hierarchy');
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
