const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true});
 const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.goto('http://127.0.0.1:8191');
  await page.getByRole('tab',{name:'Gallery workspace',exact:true}).click();
  await page.evaluate(()=>{
   const host=document.createElement('div');host.id='qa-load-report';host.style.cssText='position:fixed;left:10px;top:64px;width:650px;height:880px;overflow:auto;z-index:5000';document.body.append(host);
   const node={comfyClass:'GalleryLoadReport',widgets:[],setSize(){},setDirtyCanvas(){},addDOMWidget(name,type,element){host.append(element);return{name,type};}};
   window.comfyAPI.app.app.graph.add(node);window.qaExtension.nodeCreated(node);window.qaLoadNode=node;
  });
  const panel=page.locator('#qa-load-report');
  await panel.getByText(/Connect the final IMAGE/).waitFor();
  await page.evaluate(()=>window.qaLoadNode.onExecuted({load_report:[{
   hardware:{device:'QA GPU',device_total_bytes:8*1024**3,device_available_bytes:3*1024**3,ram_total_bytes:32*1024**3,ram_available_bytes:16*1024**3},
   encoders:[{node_id:'2',side:'positive',token_streams:[{stream:'l',content_tokens:101,encoded_slots:154,chunks:2,chunk_sizes:[77,77]}],rules_applied:3,
    diagnostics:{groups:[{name:'Character look',kind:'box',syntax:'{blue eyes|green eyes}',syntax_characters:22,resolved_text:'blue eyes',shared_tags:[],without_group_delta:[{stream:'l',token_delta:12,slot_delta:77,chunk_delta:1}]}],rulesets:[{id:'safety',name:'Safety filter',origin:'global',scope:'main',delta:[{stream:'l',token_delta:-3,slot_delta:0,chunk_delta:0}]}],coverage:{groups_analyzed:1,groups_total:1,rulesets_analyzed:1,rulesets_total:1},analysis_ms:2,notes:['Rows are not additive.']}}],
   model:{weight_bytes:6*1024**3,sampler_estimate_bytes:3*1024**3,base_estimate_bytes:9*1024**3,capacity_fraction:1.125,assessment:'Base estimate exceeds device capacity; offloading may be needed.',estimate_note:'Auxiliary models are not included.'},
   output_images:{shape:[2,768,512,3],bytes:2*768*512*3*4},
   source_images:[{node_id:'3',images:2,layout:'batch',sizes:[{width:640,height:480}]}],
   samplers:[{node_id:'4',type:'KSampler',steps:25,cfg:7,denoise:1}],
   processes:[{node_id:'5',type:'IPAdapterAdvanced',parameters:{weight:0.8}}],
   model_files:[{name:'base.safetensors',category:'checkpoints',disk_bytes:6*1024**3}],notes:['File sizes are storage bytes, not GPU memory.']
  }]}));
  await panel.getByText('Operation load · QA GPU',{exact:true}).waitFor();
  assert.equal(await panel.getByRole('cell',{name:'101',exact:true}).count(),1);
  await panel.getByText('Base estimate exceeds device capacity; offloading may be needed.',{exact:true}).waitFor();
  await panel.getByRole('cell',{name:'IPAdapterAdvanced',exact:true}).waitFor();
  await panel.getByText('#2 positive · group and ruleset diagnosis',{exact:true}).click();
  await panel.getByRole('cell',{name:'Character look',exact:true}).waitFor();
  await panel.getByRole('cell',{name:'Safety filter',exact:true}).waitFor();
  assert.equal(await panel.getByRole('cell',{name:'-3',exact:true}).count(),1);
  await panel.getByText('Inspect group text and selected alternatives',{exact:true}).click();
  await panel.getByText('Associated final text: blue eyes',{exact:true}).waitFor();
  await panel.getByRole('button',{name:'Show report JSON',exact:true}).click();
  const report=JSON.parse(await panel.getByRole('textbox',{name:'Operation load report JSON',exact:true}).inputValue());
  assert.equal(report.encoders[0].token_streams[0].chunks,2);
  assert.equal(report.hardware.device_total_bytes,8*1024**3);
  assert.deepEqual(errors,[]);
  console.log('PASS load report mounting, hardware capacity, token streams, adapter inventory and JSON export');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
