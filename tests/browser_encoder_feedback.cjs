const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true});const page=await browser.newPage({viewport:{width:1500,height:1100}});const errors=[];page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.goto('http://127.0.0.1:8191');await page.getByRole('tab',{name:'Gallery workspace',exact:true}).click();
  await page.evaluate(()=>{
   const graph=window.comfyAPI.app.app.graph;
   const make=(id,left,text)=>{
    const frame=document.createElement('div');frame.id=id;frame.style.cssText=`position:fixed;left:${left}px;top:10px;width:600px;height:720px;z-index:5000;background:#222;color:#ddd`;document.body.append(frame);
    const node={comfyClass:'GalleryPromptEncode',size:[600,800],widgets:[{name:'text',value:text},{name:'source_mode',value:'after'}],inputs:[{name:'source_text',link:null}],properties:{},resizes:[],
     setDirtyCanvas(){},setSize(size){this.size=[...size];this.resizes.push([...size]);frame.style.width=size[0]+'px';frame.style.height=(size[1]-80)+'px';},computeSize(){return [600,(this.domOptions?.getHeight()||320)+80];},
     addWidget(type,name,value,callback){this.widgets.push({type,name,value,callback});},addDOMWidget(name,type,el,options){this.domOptions=options;frame.append(el);return{name,type};}};
    graph.add(node);window.qaExtension.nodeCreated(node);return node;
   };
   window.qaFeedbackA=make('qa-feedback-a',20,'alpha, beta');window.qaFeedbackB=make('qa-feedback-b',760,'other');
   // A canvas extension cancelling HTML dragstart must not break pointer-based chip dragging.
   document.addEventListener('dragstart',event=>{if(event.target.closest('[data-chip-id]'))event.preventDefault();},true);
  });
  const a=page.locator('#qa-feedback-a'),b=page.locator('#qa-feedback-b');
  await a.getByRole('button',{name:'Edit alpha',exact:true}).waitFor();
  const box=a.getByLabel('Tag box #1',{exact:true}),select=box.getByLabel('Convert prompt format',{exact:true});
  await select.dispatchEvent('pointerdown',{pointerType:'mouse',button:0});await select.focus();await select.selectOption('group');
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('#qa-feedback-a [aria-label="Tag box #1"]')).borderTopColor==='rgb(73, 170, 25)');
  assert(await select.evaluate(el=>el===document.activeElement),'format border updates without blurring the active select');
  await select.selectOption('tag');
  await page.evaluate(()=>{window.qaFeedbackA.__galleryPromptBoxes.insert('tail tag','after','Tail');window.qaFeedbackA.setSize([600,1100]);});
  const tail=a.getByLabel('Tag box Tail',{exact:true});await tail.getByRole('button',{name:'Delete box',exact:true}).click();
  await page.waitForFunction(()=>window.qaFeedbackA.size[1]<900);await tail.waitFor({state:'detached'});await page.waitForTimeout(180);
  assert.equal(await page.evaluate(()=>window.qaFeedbackA.size[0]),600);
  const height=await page.evaluate(()=>window.qaFeedbackA.size[1]);await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>window.qaFeedbackA.size[1]),height,'settled size must not oscillate');
  await a.getByLabel('Add ruleset',{exact:true}).selectOption('__hair_prompting__');await a.getByLabel('Hair mode',{exact:true}).selectOption('minimal');
  await page.waitForFunction(()=>window.qaFeedbackA.size[1]>=700&&window.qaFeedbackA.size[1]<=980);
  await a.getByRole('button',{name:'Collapse hair prompting',exact:true}).click();await a.getByLabel('Hair mode',{exact:true}).waitFor({state:'hidden'});await a.getByRole('button',{name:'Expand hair prompting',exact:true}).click();assert.equal(await a.getByLabel('Hair mode',{exact:true}).inputValue(),'minimal');
  await a.getByRole('button',{name:'Remove hair prompting',exact:true}).click();await page.waitForFunction(()=>window.qaFeedbackA.size[1]<900);
  assert.equal(await page.evaluate(()=>window.qaFeedbackA.size[0]),600,'removing policy preserves node width');
  // In-editor movement, independent-editor copies and cancellation use real pointer input.
  await page.evaluate(()=>window.qaFeedbackA.__galleryPromptBoxes.insert('destination','after','Target'));
  await a.getByRole('button',{name:'Edit alpha',exact:true}).dragTo(a.getByLabel('Tag box Target',{exact:true}));
  await page.waitForFunction(()=>window.qaFeedbackA.properties.prompt_boxes.boxes.find(box=>box.name==='Target').chips.some(chip=>chip.text==='alpha'));
  await a.getByRole('button',{name:'Edit beta',exact:true}).dragTo(b.getByLabel('Tag box #1',{exact:true}));
  await b.getByRole('button',{name:'Edit beta',exact:true}).waitFor();assert.equal(await a.getByRole('button',{name:'Edit beta',exact:true}).count(),1,'copy between editors retains origin');
  const beta=await a.getByRole('button',{name:'Edit beta',exact:true}).boundingBox();await page.mouse.move(beta.x+5,beta.y+5);await page.mouse.down();await page.mouse.move(beta.x+20,beta.y+15,{steps:3});
  const trash=page.getByRole('button',{name:'Remove dragged tag',exact:true});await trash.waitFor();assert.equal(await trash.count(),1);
  const bin=await trash.boundingBox();await page.mouse.move(bin.x+bin.width/2,bin.y+bin.height/2,{steps:5});await page.mouse.up();
  await a.getByRole('button',{name:'Edit beta',exact:true}).waitFor({state:'detached'});await trash.waitFor({state:'detached'});assert.equal(await b.getByRole('button',{name:'Edit beta',exact:true}).count(),1);
  await page.evaluate(()=>{document.getElementById('qa-feedback-b').style.display='none';window.dispatchEvent(new CustomEvent('gallery-prefix-manager',{detail:{name:'Drag workspace QA',positive:['workspace tag']}}));});
  const panel=page.locator('[data-panel-key="prefix-editor"]');await panel.waitFor();await panel.evaluate(el=>Object.assign(el.style,{left:'660px',top:'20px',width:'800px',height:'900px',transform:'none'}));
  const workspace=panel.getByLabel('Prefix tag box',{exact:true}).filter({visible:true});
  await a.getByRole('button',{name:'Edit alpha',exact:true}).dragTo(workspace);
  await workspace.getByRole('button',{name:'Edit alpha',exact:true}).waitFor();assert.equal(await a.getByRole('button',{name:'Edit alpha',exact:true}).count(),1);
  await workspace.getByRole('button',{name:'Edit workspace tag',exact:true}).dragTo(a.getByLabel('Tag box #1',{exact:true}));
  await a.getByRole('button',{name:'Edit workspace tag',exact:true}).waitFor();
  // Dropping outside any prompt target cancels, and clicking still edits normally afterward.
  const cancel=await a.getByRole('button',{name:'Edit workspace tag',exact:true}).boundingBox();await page.mouse.move(cancel.x+5,cancel.y+5);await page.mouse.down();await page.mouse.move(5,1050,{steps:5});await page.mouse.up();
  assert.equal(await a.getByRole('button',{name:'Edit workspace tag',exact:true}).count(),1);await trash.waitFor({state:'detached'});
  await a.getByRole('button',{name:'Edit workspace tag',exact:true}).click();await a.getByRole('textbox',{name:'Tag text',exact:true}).waitFor();
  assert.deepEqual(errors,[]);console.log('PASS encoder shrink/width/stability, immediate focused format borders, pointer moves/copies across nodes and workspace, temporary trash and cancelled drops with native drag cancelled');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
