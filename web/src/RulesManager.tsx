import {useEffect,useState,useRef} from 'react';
import {Button,Input,Select,Space,Alert,message} from 'antd';
import {FloatingPanel} from './FloatingPanel';
import {BASE_Z_INDEX} from './ComfyAppApi';
import {loadPrefixes,type SharedLibrary} from './PrefixLibrary';
import {BATCH_BLACKLIST_KEY,BATCH_BLACKLIST_EVENT,parseBatchBlacklist} from './BatchTagBlacklist';
import {announceRules,OPEN_RULES,rulesRequest,newRuleBox} from './RulesLibrary';
import {RuleBoxes} from './RuleBoxes';
import {applyRulePreview,type RulesLibrary,type Ruleset} from './RuleEngine';

const empty:RulesLibrary={version:1,definitions:[],globals:[],prefixes:{}};
export function RulesManager(){
 const [open,setOpen]=useState(false),[library,setLibrary]=useState<RulesLibrary>(empty),[revision,setRevision]=useState(''),[prefixes,setPrefixes]=useState<SharedLibrary>({version:2,tags:[],prefixes:[]});
 const [target,setTarget]=useState('global'),[script,setScript]=useState(''),[selected,setSelected]=useState(''),[error,setError]=useState(''),[dirty,setDirty]=useState(false),[busy,setBusy]=useState(false),[test,setTest]=useState('');
 const dirtyRef=useRef(false),scriptDirty=useRef(false),legacyImported=useRef(false);dirtyRef.current=dirty;
 const reload=async()=>{const [data,prefixes]=await Promise.all([rulesRequest(),loadPrefixes()]);setLibrary(data.library);setRevision(data.revision);setPrefixes(prefixes);setDirty(false);setSelected('');setScript('');scriptDirty.current=false;legacyImported.current=false;};
 useEffect(()=>{const show=(event:Event)=>{setOpen(true);setTarget((event as CustomEvent).detail?.prefixId||'global');if(!dirtyRef.current&&!scriptDirty.current)void reload().catch(error=>setError(String(error)));};window.addEventListener(OPEN_RULES,show);return()=>window.removeEventListener(OPEN_RULES,show);},[]);
 const change=(next:RulesLibrary)=>{setLibrary(next);setDirty(true);};
 const boxes=target==='global'?library.globals:library.prefixes[target]||[];
 const applyScript=()=>{try{
  const value=JSON.parse(script) as Ruleset;
  if(value.version!==1||!value.id||!value.name||!value.family||!Array.isArray(value.rules)||!Array.isArray(value.choices))throw new Error('Use a version 1 ruleset with id, name, family, rules and choices.');
  for(const choice of value.choices)if(!choice.id||!choice.label||!Array.isArray(choice.options)||!choice.options.some(option=>option.id===choice.default)||choice.options.some(option=>!option.id||!option.label||!Array.isArray(option.rules)))throw new Error('Invalid preference/option schema.');
  for(const rule of [...value.rules,...value.choices.flatMap(choice=>choice.options.flatMap(option=>option.rules))])if(!['exclude','protect','require','select','exclusive'].includes(rule.op)||!Array.isArray(rule.tags)||!rule.tags.length||rule.tags.some(tag=>typeof tag!=='string'||!tag.trim()||/[,{}\[\]<>|\n\r]/.test(tag)||tag.trim().startsWith('('))||rule.if_all!==undefined&&(!Array.isArray(rule.if_all)||rule.if_all.some(tag=>typeof tag!=='string'))||rule.op==='select'&&!rule.tags.includes(rule.value!))throw new Error('Invalid operation, literal tags or select value.');
  change({...library,definitions:[...library.definitions.filter(item=>item.id!==selected&&item.id!==value.id),value]});setSelected(value.id);scriptDirty.current=false;setError('');
 }catch(error){setError(String(error));}};
 const save=async()=>{if(scriptDirty.current){setError('Apply the script draft before saving the library.');return;}setBusy(true);setError('');try{const result=await rulesRequest(library,revision);setLibrary(result.library);setRevision(result.revision);setDirty(false);if(legacyImported.current){localStorage.removeItem(BATCH_BLACKLIST_KEY);window.dispatchEvent(new Event(BATCH_BLACKLIST_EVENT));}announceRules(legacyImported.current);legacyImported.current=false;message.success('Rules library saved. Reload defaults on existing encoders to update pinned snapshots.');}catch(error){setError(String(error));}finally{setBusy(false);}};
 const preview=(()=>{try{return applyRulePreview(test,boxes);}catch(error){return{text:'',errors:[String(error)],notes:[],protectedTags:[]};}})();
 return <FloatingPanel panelKey="prompt-rules" title={'Rules & protections'+(dirty?' · unsaved':'')} open={open} onCancel={()=>{if(!dirty&&!scriptDirty.current||confirm('Discard unsaved rules changes?')){setOpen(false);setDirty(false);scriptDirty.current=false;}}} width={1000} zIndex={BASE_Z_INDEX+45}
  footer={<Space><Button onClick={()=>{if(!dirty&&!scriptDirty.current||confirm('Discard unsaved rules changes and reload?'))void reload().catch(error=>setError(String(error)));}}>Reload library</Button><Button aria-label="Save rules library" type="primary" disabled={!dirty} loading={busy} onClick={()=>void save()}>Save rules library</Button></Space>}>
  <p>Rulesets are separate from tag prefixes. Global defaults → inherited prefix → encoder override, per family and policy scope. Equal-level contradictions stop encoding. Rule scripts are declarative JSON, not executable JavaScript.</p>
  {error&&<Alert type="error" message={error}/>}
  <h3>Attach rulesets</h3>
  <Select aria-label="Rules binding target" value={target} onChange={setTarget} style={{width:'100%'}} options={[{value:'global',label:'Global encoder defaults'},...prefixes.prefixes.map(prefix=>({value:prefix.id,label:'Prefix: '+prefix.name}))]}/>
  <RuleBoxes template={test} definitions={library.definitions} origin={target==='global'?'global':'prefix'} value={boxes} onChange={value=>change(target==='global'?{...library,globals:value}:{...library,prefixes:{...library.prefixes,[target]:value}})}/>
  <h3>Ruleset scripts</h3>
  <Space wrap><Select aria-label="Edit ruleset" value={selected||undefined} placeholder="Choose a ruleset" style={{width:240}} options={library.definitions.map(item=>({value:item.id,label:item.name}))} onChange={id=>{if(scriptDirty.current&&!confirm('Discard unapplied script edits?'))return;scriptDirty.current=false;setSelected(id);setScript(JSON.stringify(library.definitions.find(item=>item.id===id),null,2));}}/>
  <Button onClick={()=>{if(scriptDirty.current&&!confirm('Discard unapplied script edits?'))return;scriptDirty.current=true;setDirty(true);setSelected('');setScript(JSON.stringify({version:1,id:'custom-'+Date.now(),name:'New ruleset',family:'custom',rules:[{op:'exclude',tags:['example tag']}],choices:[]},null,2));}}>New ruleset</Button>
  <Button onClick={()=>{let values:string[]=[];try{const raw=JSON.parse(localStorage.getItem(BATCH_BLACKLIST_KEY)||'[]');values=Array.isArray(raw)?raw:[];}catch{values=parseBatchBlacklist(localStorage.getItem(BATCH_BLACKLIST_KEY)||'');}if(!values.length){message.info('No legacy protected tags in this browser.');return;}legacyImported.current=true;const definition:Ruleset={version:1,id:'legacy-batch-protection',name:'Imported batch protections',family:'batch-protection',rules:[{op:'protect',tags:values}],choices:[]};change({...library,definitions:[...library.definitions.filter(item=>item.id!==definition.id),definition],globals:[...library.globals.filter(box=>box.definition.id!==definition.id),newRuleBox(definition,'global')]});window.dispatchEvent(new Event(BATCH_BLACKLIST_EVENT));}}>Import legacy blacklist as Protect rules</Button></Space>
  <p>Operations: exclude removes tags; require adds tags; select fixes one value from a tag pool; exclusive rejects competing co-active tags; protect excludes tags from batch edits. Optional if_all conditions run on the sampled input. Edit JSON, apply the draft, then save. Attachments are pinned snapshots; replace a box to adopt an edited definition.</p>
  <Input.TextArea aria-label="Ruleset JSON script" value={script} onChange={event=>{setScript(event.target.value);scriptDirty.current=true;setDirty(true);}} rows={14} style={{fontFamily:'monospace'}}/>
  <Button disabled={!script.trim()} onClick={applyScript}>Apply script draft</Button>
  <h3>Test attached rules</h3><Input.TextArea aria-label="Rule test prompt" value={test} onChange={event=>setTest(event.target.value)} rows={3}/>
  {preview.errors.map(error=><Alert key={error} type="error" message={error}/>)}<pre aria-label="Rule test result">{preview.text}</pre>
  <small>Preview uses reachable template branches; conditional rules receive a final check after sampling. Scope controls policy precedence, not spatial conditioning.</small>
 </FloatingPanel>;
}
