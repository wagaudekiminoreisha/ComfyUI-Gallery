import {useEffect,useRef,useState} from 'react';
import {Alert,Button,Space,message} from 'antd';
import {RuleBoxes} from './RuleBoxes';
import {RulesetEditor} from './RulesetEditor';
import {rulesRequest,newRuleBox,announceRules} from './RulesLibrary';
import {activeRuleBoxes,type RuleBox,type RulesLibrary,type Ruleset} from './RuleEngine';
export function PrefixRulesEditor({bindingId,name,template,fallback=[]}:{bindingId?:string;name:string;template:string;fallback?:RuleBox[]}){
 const [library,setLibrary]=useState<RulesLibrary>(),[revision,setRevision]=useState(''),[boxes,setBoxes]=useState<RuleBox[]>([]),[edited,setEdited]=useState(''),[dirty,setDirty]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const drafts=useRef(new Map<string,RuleBox[]>()),target=useRef(bindingId||'draft'),dirtyRef=useRef(false);dirtyRef.current=dirty;
 useEffect(()=>{let live=true;const previous=target.current;if(dirtyRef.current)drafts.current.set(previous,boxes);else drafts.current.delete(previous);target.current=bindingId||'draft';void rulesRequest().then(data=>{if(!live)return;setLibrary(data.library);setRevision(data.revision);const draft=drafts.current.get(target.current)||(previous==='draft'&&dirty?drafts.current.get('draft'):undefined);setBoxes(draft||(data.library.prefixes[bindingId||'']||activeRuleBoxes(fallback)).map(box=>({...box,origin:bindingId?.startsWith('snapshot:')?'snapshot':'prefix'})));setDirty(!!draft);setError('');setEdited('');}).catch(error=>setError(String(error)));return()=>{live=false;};},[bindingId]);
 const update=(value:RuleBox[])=>{dirtyRef.current=true;setBoxes(value);drafts.current.set(target.current,value);setDirty(true);};
 const origin=bindingId?.startsWith('snapshot:')?'snapshot':'prefix';
 const save=async()=>{if(!bindingId||!library)return;setBusy(true);try{const result=await rulesRequest({...library,prefixes:{...library.prefixes,[bindingId]:boxes}},revision);setLibrary(result.library);setRevision(result.revision);setDirty(false);drafts.current.delete(target.current);announceRules();message.success('Rules saved for '+name);}catch(error){setError(String(error));}finally{setBusy(false);}};
 const selected=boxes.find(box=>box.id===edited);
 return <details className="cg-rule-tree" aria-label="Prefix private rules"><summary>Rules for {name||'new prefix'}{dirty?' · unsaved':''} · {boxes.length}</summary>
  <p>These attachments belong only to this {origin==='snapshot'?'snapshot':'prefix'}. Editing an attachment does not modify the reusable definition.</p>{error&&<Alert type="error" message={error}/>}
  <RuleBoxes value={boxes} definitions={library?.definitions||[]} origin={origin} template={template} onChange={update} onEdit={setEdited}/>
  <Space><Button disabled={busy} onClick={()=>void rulesRequest().then(data=>{setLibrary(data.library);setRevision(data.revision);setError('');message.info('Library refreshed; your rule draft is retained.');}).catch(error=>setError(String(error)))}>Refresh library</Button><Button onClick={()=>{const definition:Ruleset={version:1,id:'private-'+crypto.randomUUID(),name:'Private rules',family:'appearance',rules:[],choices:[]};const box=newRuleBox(definition,origin);update([...boxes,box]);setEdited(box.id);}}>+ Private ruleset</Button><Button disabled={!bindingId||!dirty} loading={busy} onClick={()=>void save()}>Save {origin} rules</Button></Space>
  {!bindingId&&<small>Save the prefix first, then save these rules. Your rule draft stays here.</small>}
  {selected&&<RulesetEditor value={selected.definition} onChange={definition=>update(boxes.map(box=>box.id===selected.id?{...box,definition}:box))}/>}
 </details>;
}
