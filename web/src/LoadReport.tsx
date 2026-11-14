import {createRoot} from 'react-dom/client';
import {useState} from 'react';

const bytes=(value?:number)=>value===undefined?'unavailable':value>=1024**3?(value/1024**3).toFixed(2)+' GiB':(value/1024**2).toFixed(1)+' MiB';
const cell={padding:'5px 8px',textAlign:'left' as const,borderBottom:'1px solid #555'};
function Rows({head,rows}:{head:string[];rows:(string|number)[][]}){
 return <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}><thead><tr>{head.map(label=><th key={label} style={cell}>{label}</th>)}</tr></thead><tbody>{rows.map((row,index)=><tr key={index}>{row.map((value,at)=><td key={at} style={cell}>{value}</td>)}</tr>)}</tbody></table>;
}
function PromptDiagnosis({encoder}:{encoder:any}){
 const d=encoder.diagnostics;
 if(!d)return null;
 if(d.note)return <p>#{encoder.node_id}: {d.note}</p>;
 const groups=(d.groups||[]).flatMap((group:any)=>group.without_group_delta.map((delta:any)=>({group,delta}))).sort((a:any,b:any)=>(b.delta.token_delta??b.delta.slot_delta)-(a.delta.token_delta??a.delta.slot_delta));
 const rules=(d.rulesets||[]).flatMap((rule:any)=>(rule.delta||[]).map((delta:any)=>({rule,delta}))).sort((a:any,b:any)=>Math.abs(b.delta.token_delta??b.delta.slot_delta)-Math.abs(a.delta.token_delta??a.delta.slot_delta));
 const signed=(value:number|undefined)=>value===undefined?'unavailable':(value>0?'+':'')+value;
 return <details><summary>#{encoder.node_id} {encoder.side||''} · group and ruleset diagnosis</summary>
  <p>Largest group-associated token reductions first. These rows overlap; they cannot be added together.</p>
  <Rows head={['Group / box','Stream','Tokens removable','Slots removable','Chunks removable','Shared tags']} rows={groups.map(({group,delta}:any)=>[group.name,delta.stream,delta.token_delta??'unavailable',delta.slot_delta,delta.chunk_delta,group.shared_tags.length])}/>
  <p>Rulesets ranked by absolute token impact. Positive adds load; negative saves tokens, relative to disabling that ruleset.</p>
  <Rows head={['Ruleset','Origin / scope','Stream','Token impact','Slot impact','Chunk impact']} rows={rules.map(({rule,delta}:any)=>[rule.name,`${rule.origin} / ${rule.scope}`,delta.stream,signed(delta.token_delta),signed(delta.slot_delta),signed(delta.chunk_delta)])}/>
  {(d.rulesets||[]).filter((rule:any)=>rule.note).map((rule:any)=><p key={rule.id}>{rule.name}: {rule.note}</p>)}
  <details><summary>Inspect group text and selected alternatives</summary>{(d.groups||[]).map((group:any,index:number)=><p key={index}><strong>{group.name}</strong> ({group.kind}) · {group.syntax_characters} syntax characters<br/><code style={{overflowWrap:'anywhere'}}>Original: {group.syntax}</code><br/><code style={{overflowWrap:'anywhere'}}>Associated final text: {group.resolved_text||'none this run'}</code></p>)}</details>
  <p>{d.coverage.groups_analyzed}/{d.coverage.groups_total} groups · {d.coverage.rulesets_analyzed}/{d.coverage.rulesets_total} active rulesets · {d.analysis_ms} ms tokenizer analysis</p>
  {(d.notes||[]).map((note:string)=><p key={note} style={{opacity:.7}}>{note}</p>)}
 </details>;
}
export function LoadReport({report}:{report:any}){
 const [expanded,setExpanded]=useState(false);
 if(!report)return <div style={{padding:12}}>Connect the final IMAGE and queue to assess this operation on the ComfyUI host. Optional MODEL + LATENT enable a memory estimate. Connect positive/negative conditioning to retain token measurements across cached runs.</div>;
 const h=report.hardware||{},m=report.model||{},image=report.output_images?.shape||[];
 return <section style={{padding:12,fontFamily:'sans-serif',fontSize:12,lineHeight:1.5,color:'var(--input-text,#ddd)',background:'var(--comfy-input-bg,#222)'}}>
  <strong style={{fontSize:15}}>Operation load · {h.device||'Device unavailable'}</strong>
  <p>Device memory: {bytes(h.device_total_bytes)} total · {bytes(h.device_available_bytes)} available<br/>System RAM: {bytes(h.ram_total_bytes)} total · {bytes(h.ram_available_bytes)} available</p>
  {h.memory_note&&<p>{h.memory_note}</p>}
  <h4>Prompt tokens · measured after source edits and rules</h4>
  <Rows head={['Encoder','Stream','Content tokens','Encoded slots','Chunks']} rows={(report.encoders||[]).flatMap((encoder:any)=>encoder.token_streams?.length?encoder.token_streams.map((stream:any)=>[`${encoder.side||''} #${encoder.node_id}`,stream.stream,stream.content_tokens??'unavailable',stream.encoded_slots,`${stream.chunks} (${stream.chunk_sizes.join(' + ')})`]):[[`#${encoder.node_id}`,'unavailable','—','—','—']])}/>
  {(report.encoders||[]).map((encoder:any)=><p key={encoder.node_id+'-'+encoder.side} style={{opacity:.7}}>#{encoder.node_id}: {encoder.rules_applied||0} rule operations recorded. {encoder.conditioning&&<>Conditioning tensor: {encoder.conditioning.shape.join(' × ')} · {bytes(encoder.conditioning.bytes)}. </>}{encoder.note}</p>)}
  {!report.encoders?.length&&<p>No Gallery encoder measurement found on this branch.</p>}
  <h4>Which groups and rulesets add load?</h4>
  {(report.encoders||[]).map((encoder:any)=><PromptDiagnosis key={encoder.node_id+'-'+encoder.side} encoder={encoder}/>)}
  <h4>Model and device capacity</h4>
  <p>Connected model weights: {bytes(m.weight_bytes)}{m.dtype?' · '+m.dtype:''}<br/>Weights currently loaded: {bytes(m.loaded_weight_bytes)}<br/>Sampler working-memory estimate: {bytes(m.sampler_estimate_bytes)}<br/>Base model + sampler estimate: {bytes(m.base_estimate_bytes)}{m.capacity_fraction!==undefined?` · ${(m.capacity_fraction*100).toFixed(0)}% of device capacity`:''}</p>
  {m.capacity_fraction!==undefined&&<progress aria-label="Base memory estimate as fraction of device capacity" max={1} value={Math.min(1,m.capacity_fraction)} style={{width:'100%'}}/>}
  <p>{m.assessment||m.note||'Connect LATENT as well as MODEL to estimate sampler working memory.'}</p><p style={{opacity:.7}}>{m.estimate_note}</p>
  <h4>Images and sampling</h4>
  <p>Output: {image.length===4?`${image[0]} × ${image[2]} × ${image[1]} · ${image[3]} channels`:'shape unavailable'} · tensor storage {bytes(report.output_images?.bytes)}</p>
  <Rows head={['Source node','Active images','Layout','Input sizes']} rows={(report.source_images||[]).map((source:any)=>['#'+source.node_id,source.images??'unavailable',source.layout||source.note,(source.sizes||[]).map((image:any)=>`${image.width} × ${image.height}`).join(', ')||'unavailable'])}/>
  <Rows head={['Sampler','Steps','CFG','Denoise']} rows={(report.samplers||[]).map((sampler:any)=>[`${sampler.type} #${sampler.node_id}`,sampler.steps??'linked / unavailable',sampler.cfg??'linked / unavailable',sampler.denoise??'linked / unavailable'])}/>
  <h4>Upstream operations and model files</h4>
  <Rows head={['Live auxiliary model','Tensor weight storage']} rows={(report.auxiliary_models||[]).map((model:any)=>[model.kind,bytes(model.weight_bytes)])}/>
  <Rows head={['Image conditioning','Image-context slots','Tensor storage']} rows={(report.image_contexts||[]).map((context:any)=>[`${context.kind} ${context.side}`,context.image_context_slots??'unavailable',bytes(context.bytes)])}/>
  <Rows head={['Node','Operation','Settings']} rows={(report.processes||[]).map((process:any)=>['#'+process.node_id,process.type,Object.entries(process.parameters||{}).map(([key,value])=>`${key}: ${value}`).join(', ')])}/>
  <Rows head={['File','Kind','Storage size']} rows={(report.model_files||[]).map((file:any)=>[file.name,file.category,bytes(file.disk_bytes)])}/>
  {(report.notes||[]).map((note:string)=><p key={note} style={{opacity:.7}}>{note}</p>)}
  <button type="button" onClick={()=>setExpanded(!expanded)}>{expanded?'Hide':'Show'} report JSON</button>
  {expanded&&<textarea aria-label="Operation load report JSON" readOnly value={JSON.stringify(report,null,2)} style={{width:'100%',height:220,boxSizing:'border-box'}}/>}
 </section>;
}
export function installLoadReport(node:any){
 if(node.comfyClass!=='GalleryLoadReport'||node.__galleryLoadInstalled)return;
 node.__galleryLoadInstalled=true;
 const host=document.createElement('div');host.style.cssText='width:100%;height:100%;overflow:auto;pointer-events:auto';
 for(const type of ['pointerdown','mousedown','keydown','wheel'])host.addEventListener(type,event=>event.stopPropagation());
 const root=createRoot(host);let report:any;
 const render=()=>root.render(<LoadReport report={report}/>);
 const widget=node.addDOMWidget?.('gallery_load_report','div',host,{serialize:false,hideOnZoom:false});
 if(widget)widget.computeSize=()=>[500,560];
 const executed=node.onExecuted;
 node.onExecuted=function(data:any){const result=executed?.call(this,data);report=data?.load_report?.[0];render();node.setDirtyCanvas?.(true,true);return result;};
 const removed=node.onRemoved;node.onRemoved=function(...args:any[]){setTimeout(()=>root.unmount(),0);return removed?.apply(this,args);};
 node.setSize?.([560,650]);render();
}
