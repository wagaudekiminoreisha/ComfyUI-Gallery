import {loadExclusiveSets} from './TagConflicts';
import {useDiscardDialog} from './DiscardDialog';
import {RulesetEditor} from './RulesetEditor';
import {useEffect,useState,useRef} from 'react';
import {Button,Input,Segmented,Select,Space,Alert,message} from 'antd';
import {FloatingPanel} from './FloatingPanel';
import {BASE_Z_INDEX} from './ComfyAppApi';
import {loadPrefixes,type SharedLibrary} from './PrefixLibrary';
import {BATCH_BLACKLIST_KEY,BATCH_BLACKLIST_EVENT,parseBatchBlacklist} from './BatchTagBlacklist';
import {announceRules,OPEN_RULES,rulesRequest,newRuleBox} from './RulesLibrary';
import {RuleBoxes} from './RuleBoxes';
import {activeRuleBoxes,applyRulePreview,type RuleBox,type RulesLibrary,type Ruleset,type RulesetMode} from './RuleEngine';
import {availableRules,disabledRulesets,globalRuleBoxes,rulesetMode} from './RuleAvailability';
import {RulesetTags} from './RulesetTags';

const empty:RulesLibrary={version:1,definitions:[],globals:[],prefixes:{}};
const modes: { value: RulesetMode; label: string; title: string }[] = [
 {value:'global',label:'Global',title:'Apply to every Gallery encoder'},
 {value:'on-demand',label:'On demand',title:'Apply only where attached'},
 {value:'disabled',label:'Disabled',title:'Ignore this ruleset everywhere'},
];
export function RulesManager(){
 const [open,setOpen]=useState(false),[library,setLibrary]=useState<RulesLibrary>(empty),[revision,setRevision]=useState(''),[prefixes,setPrefixes]=useState<SharedLibrary>({version:2,tags:[],prefixes:[]});
 const [target,setTarget]=useState('global'),[script,setScript]=useState(''),[selected,setSelected]=useState(''),[error,setError]=useState(''),[dirty,setDirty]=useState(false),[busy,setBusy]=useState(false),[test,setTest]=useState('');
 const {guard,dialog}=useDiscardDialog();
 const dirtyRef=useRef(false),scriptDirty=useRef(false),legacyImported=useRef(false);dirtyRef.current=dirty;
 const reload=async()=>{const [data,prefixes]=await Promise.all([rulesRequest(),loadPrefixes()]);setLibrary(data.library);setRevision(data.revision);setPrefixes(prefixes);setDirty(false);setSelected('');setScript('');scriptDirty.current=false;legacyImported.current=false;};
 useEffect(()=>{const show=(event:Event)=>{setOpen(true);setTarget((event as CustomEvent).detail?.prefixId||'global');if(!dirtyRef.current&&!scriptDirty.current)void reload().catch(error=>setError(String(error)));};window.addEventListener(OPEN_RULES,show);return()=>window.removeEventListener(OPEN_RULES,show);},[]);
 const change=(next:RulesLibrary)=>{setLibrary(next);setDirty(true);};
 const disabled=disabledRulesets(library);
 const attached=library.prefixes[target]||(target.startsWith('snapshot:')?activeRuleBoxes((prefixes.snapshots?.[target.slice(9)]?.rules||[]).filter(box=>box.origin!=='global')).map(box=>({...box,origin:'snapshot' as const})):[]);
 const boxes=target==='global'?globalRuleBoxes(library):availableRules(attached,disabled);
 const definition=library.definitions.find(item=>item.id===selected);
 const tagBox=boxes.find(box=>box.definition.id===selected&&box.scope==='main')||boxes.find(box=>box.definition.id===selected);
 const editDefinition=(definition:Ruleset)=>{
  if(scriptDirty.current){setError('Apply or discard the JSON draft before visual editing.');return;}
  change({...library,definitions:library.definitions.map(item=>item.id===selected?definition:item)});
  setScript(JSON.stringify(definition,null,2));
 };
 const setMode=(definition:Ruleset,mode:RulesetMode)=>{
  const globals=library.globals;
  const configured=globals.find(box=>box.definition.id===definition.id);
  let nextGlobals=globals;
  if(mode==='global'){
   if(!configured)nextGlobals=[...globals,newRuleBox(definition,'global')];
   else if(!globals.some(box=>box.definition.id===definition.id&&box.enabled)){
    nextGlobals=globals.map(box=>box===configured?{...box,enabled:true}:box);
   }
  }
  change({...library,globals:nextGlobals,availability:{...library.availability,[definition.id]:mode}});
  if(mode==='global')setTarget('global');
 };
 const changeAttachments=(value:RuleBox[])=>{
  if(target!=='global'){
   change({...library,prefixes:{...library.prefixes,[target]:[...value,...attached.filter(box=>disabled.has(box.definition.id))]}});
   return;
  }
  const ids=new Set(value.map(box=>box.definition.id)),availability={...library.availability};
  for(const box of boxes)if(!ids.has(box.definition.id))availability[box.definition.id]='on-demand';
  const saved=library.globals.filter(box=>rulesetMode(library,box.definition.id)!=='global');
  const restored=value.map(box=>{
   const previous=saved.find(candidate=>candidate.definition.id===box.definition.id&&candidate.scope===box.scope);
   availability[box.definition.id]='global';
   return previous?{...previous,enabled:true}:box;
  });
  change({...library,availability,globals:[...restored,...saved.filter(box=>!ids.has(box.definition.id))]});
 };
 const applyScript=()=>{try{
  const value=JSON.parse(script) as Ruleset;
  if(value.version!==1||!value.id||!value.name||!value.family||!Array.isArray(value.rules)||!Array.isArray(value.choices))throw new Error('Use a version 1 ruleset with id, name, family, rules and choices.');
  for(const choice of value.choices)if(!choice.id||!choice.label||!Array.isArray(choice.options)||!choice.options.some(option=>option.id===choice.default)||choice.options.some(option=>!option.id||!option.label||!Array.isArray(option.rules)))throw new Error('Invalid preference/option schema.');
  const rules=[...value.rules,...value.choices.flatMap(choice=>choice.options.flatMap(option=>option.rules))];
  for(const rule of rules)if(rule.except_tags!==undefined&&(!Array.isArray(rule.except_tags)||rule.except_tags.length>1000||rule.except_tags.some(tag=>typeof tag!=='string'||!tag.trim()||tag.length>300||/[,{}\[\]<>|\n\r]/.test(tag)||tag.trim().startsWith('('))))throw new Error('Tag exceptions must be a list of individual literal tags.');
  for(const rule of [...value.rules,...value.choices.flatMap(choice=>choice.options.flatMap(option=>option.rules))])if(!['exclude','protect','require','select','exclusive'].includes(rule.op)||!Array.isArray(rule.tags)||!rule.tags.length||rule.tags.some(tag=>typeof tag!=='string'||!tag.trim()||/[,{}\[\]<>|\n\r]/.test(tag)||tag.trim().startsWith('('))||rule.if_all!==undefined&&(!Array.isArray(rule.if_all)||rule.if_all.some(tag=>typeof tag!=='string'))||rule.op==='select'&&!rule.tags.includes(rule.value!))throw new Error('Invalid operation, literal tags or select value.');
  change({...library,definitions:[...library.definitions.filter(item=>item.id!==selected&&item.id!==value.id),value]});setSelected(value.id);scriptDirty.current=false;setError('');
 }catch(error){setError(String(error));}};
 const save=async()=>{if(scriptDirty.current){setError('Apply the script draft before saving the library.');return;}setBusy(true);setError('');try{const result=await rulesRequest(library,revision);setLibrary(result.library);setRevision(result.revision);setDirty(false);if(legacyImported.current){localStorage.removeItem(BATCH_BLACKLIST_KEY);window.dispatchEvent(new Event(BATCH_BLACKLIST_EVENT));}announceRules();legacyImported.current=false;message.success('Rules library saved.');}catch(error){setError(String(error));}finally{setBusy(false);}};
 const preview=(()=>{try{return applyRulePreview(test,target==='global'?boxes:[...globalRuleBoxes(library),...boxes]);}catch(error){return{text:'',errors:[String(error)],notes:[],protectedTags:[]};}})();
 return <>{dialog}<FloatingPanel panelKey="prompt-rules" title={'Rules & protections'+(dirty?' · unsaved':'')} open={open} onCancel={()=>guard(dirty||scriptDirty.current,()=>{setOpen(false);setDirty(false);scriptDirty.current=false;})} width={1000} zIndex={BASE_Z_INDEX+45}
  footer={<Space><Button onClick={()=>guard(dirty||scriptDirty.current,()=>void reload().catch(error=>setError(String(error))))}>Reload library</Button><Button aria-label="Save rules library" type="primary" disabled={!dirty} loading={busy} onClick={()=>void save()}>Save rules library</Button></Space>}>
  {error&&<Alert type="error" message={error}/>}
  <h3>Ruleset settings</h3>
  <Space wrap><Select aria-label="Edit ruleset" showSearch optionFilterProp="label" value={selected||undefined} placeholder="Choose a ruleset" style={{width:280}} options={library.definitions.map(item=>({value:item.id,label:item.name+' · '+modes.find(mode=>mode.value===rulesetMode(library,item.id))?.label}))} onChange={id=>guard(scriptDirty.current,()=>{scriptDirty.current=false;setSelected(id);setScript(JSON.stringify(library.definitions.find(item=>item.id===id),null,2));},'Discard unapplied script edits?')}/>
  <Segmented<RulesetMode> aria-label="Ruleset availability" options={modes} disabled={!definition} value={definition?rulesetMode(library,definition.id):'on-demand'} onChange={mode=>definition&&setMode(definition,mode)}/>
  </Space>
  {definition&&<RulesetTags key={selected+':'+target+':'+(tagBox?.id||'definition')} value={tagBox?.definition||definition}
    preferences={tagBox?.preferences} context={tagBox?(target==='global'?'Global':'Attached')+' · '+tagBox.scope:'New attachments'}
    onChange={value=>tagBox?changeAttachments(boxes.map(box=>box.id===tagBox.id?{...box,definition:value}:box)):editDefinition(value)}/>}
  <h3>Attach rulesets</h3>
  <Select aria-label="Rules binding target" value={target} onChange={setTarget} style={{width:'100%'}} options={[{value:'global',label:'Global encoder defaults'},...prefixes.prefixes.map(prefix=>({value:prefix.id,label:'Prefix: '+prefix.name})),...Object.values(prefixes.snapshots||{}).map(row=>({value:'snapshot:'+row.id,label:'Snapshot: '+(prefixes.prefixes.find(prefix=>prefix.id===row.prefix_id)?.name||'Prefix')+' · '+row.id.slice(0,8)}))]}/>
  <RuleBoxes template={test} definitions={library.definitions.filter(item=>!disabled.has(item.id))} origin={target==='global'?'global':target.startsWith('snapshot:')?'snapshot':'prefix'} value={boxes} onChange={changeAttachments}/>
  <h3>Ruleset scripts</h3><Button onClick={()=>void (async()=>{try{const {sets}=await loadExclusiveSets();const definitions:Ruleset[]=[];for(let at=0;at<sets.length;at+=150)definitions.push({version:1,id:'legacy-exclusivity-'+at,name:'Imported tag exclusions '+(1+at/150),family:'legacy-exclusivity',rules:sets.slice(at,at+150).map(set=>({op:'exclusive',tags:set.tags})),choices:[]});change({...library,definitions:[...library.definitions.filter(row=>!row.id.startsWith('legacy-exclusivity-')),...definitions],globals:[...library.globals.filter(row=>!row.definition.id.startsWith('legacy-exclusivity-')),...definitions.map(definition=>newRuleBox(definition,'global'))]});message.info('Imported as AT MOST ONE checks. Save to activate them; already disabled tags stay disabled.');}catch(error){setError(String(error));}})()}>Import legacy mutually exclusive tags</Button>
  <Space wrap>
  <Button onClick={()=>guard(scriptDirty.current,()=>{const definition:Ruleset={version:1,id:'custom-'+Date.now(),name:'New ruleset',family:'custom',rules:[],choices:[]};change({...library,definitions:[...library.definitions,definition]});setSelected(definition.id);setScript(JSON.stringify(definition,null,2));scriptDirty.current=false;},'Discard unapplied script edits?')}>New ruleset</Button>
  <Button onClick={()=>{let values:string[]=[];try{const raw=JSON.parse(localStorage.getItem(BATCH_BLACKLIST_KEY)||'[]');values=Array.isArray(raw)?raw:[];}catch{values=parseBatchBlacklist(localStorage.getItem(BATCH_BLACKLIST_KEY)||'');}if(!values.length){message.info('No legacy protected tags in this browser.');return;}legacyImported.current=true;const definition:Ruleset={version:1,id:'legacy-batch-protection',name:'Imported batch protections',family:'batch-protection',rules:[{op:'protect',tags:values}],choices:[]};change({...library,definitions:[...library.definitions.filter(item=>item.id!==definition.id),definition],globals:[...library.globals.filter(box=>box.definition.id!==definition.id),newRuleBox(definition,'global')]});window.dispatchEvent(new Event(BATCH_BLACKLIST_EVENT));}}>Import legacy blacklist as Protect rules</Button></Space>
  <p>Operations: exclude removes tags; require adds tags; select fixes one value from a tag pool; exclusive rejects competing co-active tags; protect excludes tags from batch edits. Optional if_all conditions run on the sampled input. Edit the rule tree or use Advanced JSON, then save. Attachments are pinned snapshots; replace a box to adopt an edited definition.</p>
  {definition&&<RulesetEditor key={selected} value={definition} onChange={editDefinition}/>}
  <details><summary>Advanced JSON script</summary><Input.TextArea aria-label="Ruleset JSON script" value={script} onChange={event=>{setScript(event.target.value);scriptDirty.current=true;setDirty(true);}} rows={14} style={{fontFamily:'monospace'}}/>
  <Button disabled={!script.trim()} onClick={applyScript}>Apply script draft</Button></details>
  <h3>Test attached rules</h3><Input.TextArea aria-label="Rule test prompt" value={test} onChange={event=>setTest(event.target.value)} rows={3}/>
  {preview.errors.map(error=><Alert key={error} type="error" message={error}/>)}<pre aria-label="Rule test result">{preview.text}</pre>
  <small>Preview uses reachable template branches; conditional rules receive a final check after sampling. Channels control policy precedence, not spatial conditioning.</small>
 </FloatingPanel></>;
}
