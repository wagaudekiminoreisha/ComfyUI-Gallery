const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true});
 const page=await browser.newPage({viewport:{width:1650,height:1150}});
 page.setDefaultTimeout(10000);
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.goto('http://127.0.0.1:8191');
  // Shared libraries can outgrow the optional browser cache. The server save still succeeds.
  await page.evaluate(()=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='comfy.prompt-library.v2')throw new DOMException('Quota exceeded','QuotaExceededError');return set.call(this,key,value);};});
  await page.getByRole('tab',{name:'Gallery workspace',exact:true}).click();
  await page.getByAltText('study-1.png',{exact:true}).click({button:'right'});
  await page.getByRole('menuitem',{name:'Prefix associations… (1)',exact:true}).click();
  const panel=page.locator('[data-panel-key="source-prefix"]');
  const name='Save regression '+Date.now();
  await panel.getByRole('combobox',{name:'Prefix for these images',exact:true}).fill(name);
  await page.getByTitle('Create new prefix “'+name+'”',{exact:true}).click();
  const response=page.waitForResponse(r=>r.url().endsWith('/Gallery/prefixes')&&r.request().method()==='POST');
  await panel.getByRole('button',{name:/^Create “/}).click();
  assert.equal((await response).status(),200);
  await panel.getByRole('button',{name:'Update shared “'+name+'” and pair',exact:true}).waitFor();
  await panel.getByRole('button',{name:'Pair only',exact:true}).waitFor();
  assert.equal(await panel.getByRole('button',{name:'Pair only',exact:true}).isEnabled(),true);
  const paired=page.waitForResponse(r=>r.url().endsWith('/Gallery/prefixes')&&r.request().method()==='POST'&&r.request().postDataJSON().action==='associate');
  await panel.getByRole('button',{name:'Pair only',exact:true}).click();
  assert.equal((await paired).status(),200);
  await panel.getByRole('button',{name:'Update shared “'+name+'” and pair',exact:true}).waitFor({state:'visible'});
  await panel.getByRole('button',{name:'Close',exact:true}).first().click();
  await panel.waitFor({state:'detached'});
  assert.deepEqual(errors,[]);
  console.log('PASS prefix save selects saved prefix, enables pairing, and closes without unsaved warning');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
