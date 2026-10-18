const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true});const page=await browser.newPage({viewport:{width:1400,height:1100}});const errors=[];page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(15000);
try{
 await page.goto('http://127.0.0.1:8191');await page.getByRole('tab',{name:'Gallery workspace',exact:true}).click();
 await page.evaluate(()=>{const host=document.createElement('div');host.id='qa-rule-duplicates';host.style.cssText='position:fixed;right:0;top:0;width:650px;height:1050px;overflow:auto;z-index:5000;background:#222';document.body.append(host);const graph=window.comfyAPI.app.app.graph;const node={comfyClass:'GalleryPromptEncode',widgets:[{name:'text',value:''},{name:'source_mode',value:'after'}],inputs:[{name:'source_text',link:null}],properties:{},setDirtyCanvas(){},addWidget(type,name,value,callback){this.widgets.push({type,name,value,callback});},addDOMWidget(name,type,el){host.append(el);return {name,type};}};graph.add(node);window.qaExtension.nodeCreated(node);window.qaEncoder=node;});
 const editor=page.locator('#qa-rule-duplicates'),picker=editor.getByRole('combobox',{name:'Add ruleset',exact:true});
 await picker.locator('option[value="builtin-pose"]').waitFor({state:'attached'});await picker.selectOption('builtin-pose');
 const card=editor.getByRole('group',{name:'Ruleset box Pose',exact:true});await card.waitFor();
 assert.equal(await picker.locator('option[value="builtin-pose"]').count(),0);
 const id=await page.evaluate(()=>window.qaEncoder.properties.prompt_boxes.rulesets.find(box=>box.definition.id==='builtin-pose').id);
 await card.getByRole('checkbox',{name:'Use ruleset Pose',exact:true}).uncheck();await picker.locator('option[value="builtin-pose"]').waitFor({state:'attached'});await picker.selectOption('builtin-pose');
 assert.equal(await card.count(),1);assert.equal(await page.evaluate(()=>window.qaEncoder.properties.prompt_boxes.rulesets.find(box=>box.definition.id==='builtin-pose').id),id);assert(await card.getByRole('checkbox',{name:'Use ruleset Pose',exact:true}).isChecked());
 await card.getByRole('button',{name:'Remove ruleset box',exact:true}).click();await picker.locator('option[value="builtin-pose"]').waitFor({state:'attached'});
 assert.deepEqual(errors,[]);console.log('PASS encoder ruleset picker hides active definitions, reuses disabled cards and restores removed choices');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
