const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true});const context=await browser.newContext({viewport:{width:1500,height:1100}});const page=await context.newPage();page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',e=>errors.push(e.message));const base='http://127.0.0.1:8191';
try{
 let initial=await(await page.request.get(base+'/Gallery/rulesets')).json();const defaults=require('../data/prompt-rulesets.json');await page.request.post(base+'/Gallery/rulesets',{data:{library:defaults,revision:initial.revision}});initial=await(await page.request.get(base+'/Gallery/rulesets')).json();
 await page.goto(base);await page.getByRole('tab',{name:'Gallery workspace',exact:true}).click();
 const observer=await page.context().newPage();await observer.goto(base);await observer.getByRole('tab',{name:'Gallery workspace',exact:true}).click();await observer.evaluate(()=>{window.rulesBroadcastSeen=0;window.addEventListener('gallery-rules-changed',()=>window.rulesBroadcastSeen++);});
 await page.evaluate(()=>localStorage.setItem('comfy-gallery-batch-tag-blacklist','protected tag\nother protected'));
 await page.getByRole('button',{name:'Rules & protections',exact:true}).first().click();
 const manager=page.locator('[data-panel-key="prompt-rules"]');await manager.waitFor();
 await manager.getByLabel('Add ruleset',{exact:true}).selectOption('builtin-hair');
 const hair=manager.getByRole('group',{name:'Ruleset box Hair',exact:true});
 const length=hair.locator('select').first();await length.selectOption('short_hair');
 await manager.getByRole('button',{name:'Import legacy blacklist as Protect rules',exact:true}).click();
 await manager.getByRole('button',{name:'Save rules library',exact:true}).click();
 await page.waitForFunction(async()=>{const data=await(await fetch('/Gallery/rulesets')).json();return data.library.globals.length===2;});await observer.waitForFunction(()=>window.rulesBroadcastSeen>0);await observer.close();
 await manager.getByRole('button',{name:'New ruleset',exact:true}).click();await manager.getByText('Advanced JSON script',{exact:true}).click();await manager.getByLabel('Ruleset JSON script').fill(JSON.stringify({version:1,id:'qa-script',name:'QA script',family:'test',rules:[{op:'exclude',tags:['unwanted']}],choices:[]}));
 await manager.getByRole('button',{name:'Save rules library',exact:true}).click();await manager.getByText('Apply the script draft before saving the library.',{exact:true}).waitFor();
 await manager.getByRole('button',{name:'Apply script draft',exact:true}).click();await manager.getByRole('button',{name:'Save rules library',exact:true}).click();
 await page.waitForFunction(async()=>{const data=await(await fetch('/Gallery/rulesets')).json();return data.library.definitions.some(d=>d.id==='qa-script');});
 await manager.getByRole('button',{name:'Close',exact:true}).first().click();
 // Prefix rules use a separate attachment, with pinned script snapshots.
 const prefixState=await(await page.request.get(base+'/Gallery/prefixes')).json();
 const prefixResponse=await page.request.post(base+'/Gallery/prefixes',{data:{action:'save',name:'QA rules prefix',terms:['long hair','blue eyes'],revision:prefixState.revision}});assert.equal(prefixResponse.status(),200);
 const prefix=(await prefixResponse.json()).library.prefixes.find(p=>p.name==='QA rules prefix');
 const rules=await(await page.request.get(base+'/Gallery/rulesets')).json();const definition=rules.library.definitions.find(d=>d.id==='builtin-hair');
 rules.library.prefixes[prefix.id]=[{id:'prefix-hair',definition,origin:'prefix',scope:'main',preferences:{length:'long_hair'},enabled:true,collapsed:false}];
 assert.equal((await page.request.post(base+'/Gallery/rulesets',{data:rules})).status(),200);
 await page.evaluate(()=>{
 const frame=document.createElement('div');frame.id='qa-rules';frame.style.cssText='position:fixed;left:10px;top:5px;width:650px;height:1000px;z-index:5000;background:#222;color:white;overflow:auto';document.body.append(frame);
 const node={comfyClass:'GalleryPromptEncode',widgets:[{name:'text',value:'long hair, blue eyes, protected tag'},{name:'source_mode',value:'after'}],inputs:[{name:'source_text',link:null}],properties:{},setDirtyCanvas(){},addWidget(type,name,value,callback){this.widgets.push({type,name,value,callback});},addDOMWidget(name,type,el){frame.append(el);return{name,type};}};
 window.comfyAPI.app.app.graph.add(node);window.qaExtension.nodeCreated(node);window.qaRules=node;
 });
 const editor=page.locator('#qa-rules');await editor.getByRole('group',{name:'Ruleset box Hair',exact:true}).waitFor();
 let program=await page.evaluate(async()=>JSON.parse(await window.qaRules.widgets.find(w=>w.name==='rules_state').serializeValue()));assert.equal(program.length,2);assert.equal(program[0].preferences.length,'short_hair');
 await page.evaluate(id=>window.qaRules.__galleryPromptBoxes.insert('long hair, blue eyes','after','QA rules prefix',id),prefix.id);
 // Queue serialization waits for the just-started prefix load.
 program=await page.evaluate(async()=>JSON.parse(await window.qaRules.widgets.find(w=>w.name==='rules_state').serializeValue()));assert.equal(program.filter(b=>b.origin==='prefix').length,1);
 await editor.getByRole('button',{name:'Override on encoder',exact:true}).click();
 const override=editor.getByRole('group',{name:'Ruleset box Hair',exact:true}).last();await override.locator('select').first().selectOption('short_hair');
 await editor.getByText('Required and excluded:',{exact:false}).waitFor({state:'detached'});
 program=await page.evaluate(async()=>JSON.parse(await window.qaRules.widgets.find(w=>w.name==='rules_state').serializeValue()));assert.equal(program.filter(b=>b.origin==='encoder').length,1);
 assert.equal(program.find(b=>b.origin==='encoder').preferences.length,'short_hair');
 assert(await editor.getByText('overridden in this scope',{exact:false}).count()>=1);
 await editor.getByLabel('Add ruleset',{exact:true}).selectOption('builtin-pose');await editor.getByRole('group',{name:'Ruleset box Pose',exact:true}).waitFor();
 await editor.getByRole('group',{name:'Ruleset box Pose',exact:true}).getByLabel('Collapse ruleset Pose').click();await editor.getByRole('group',{name:'Ruleset box Pose',exact:true}).getByLabel('Collapse ruleset Pose').filter({hasText:'Expand'}).waitFor();
 await editor.getByRole('group',{name:'Ruleset box Pose',exact:true}).getByLabel('Remove ruleset box').click();
 await editor.getByRole('button',{name:'Select all chips',exact:true}).first().click();
 await editor.getByText('2 selected',{exact:true}).waitFor();const selected=await page.evaluate(()=>window.qaRules.properties.prompt_boxes.boxes[0].chips);assert(selected.some(c=>c.text==='protected tag'));
 const savedProgram=await page.evaluate(async()=>JSON.parse(await window.qaRules.widgets.find(w=>w.name==='rules_state').serializeValue()));
 await page.route('**/Gallery/rulesets',route=>route.abort());
 await page.evaluate(()=>{const node=window.qaRules;node.properties=JSON.parse(JSON.stringify(node.properties));node.onConfigure();});
 await editor.getByText('Rules library unavailable; saved snapshots remain active.',{exact:false}).waitFor();
 const restoredProgram=await page.evaluate(async()=>JSON.parse(await window.qaRules.widgets.find(w=>w.name==='rules_state').serializeValue()));assert.deepEqual(restoredProgram,savedProgram);
 await page.unroute('**/Gallery/rulesets');
 assert.deepEqual(errors,[]);console.log('PASS rules editor scripts/save, legacy protections, global snapshots, prefix inheritance, queue wait, encoder override and adjustable boxes');
 // Restore fixture rules for other regression scripts.
 const restore=await(await page.request.get(base+'/Gallery/rulesets')).json();await page.request.post(base+'/Gallery/rulesets',{data:{library:initial.library,revision:restore.revision}});
}catch(error){console.error('PAGE ERRORS',errors);console.error(await page.locator('[data-panel-key=prompt-rules] button').evaluateAll(rows=>rows.map(el=>el.outerHTML).slice(-5)));console.error((await page.locator('body').innerText()).slice(-12000));throw error;}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
