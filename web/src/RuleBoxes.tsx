import {useState} from 'react';
import {Modal,Input} from 'antd';
import {BASE_Z_INDEX} from './ComfyAppApi';
import {newRuleBox} from './RulesLibrary';
import {activeRuleBoxes,type RuleBox,type Ruleset} from './RuleEngine';
import {RuleOperation,RuleNotation,RuleStyles} from './RuleOperation';
import {HairControls} from './HairControls';
import {cleanHairPolicy,type HairPolicy} from './HairPolicy';

type HairBox={value:HairPolicy|null;onChange:(value:HairPolicy|null)=>void};
export function RuleBoxes({value,onChange,definitions,origin='encoder',inherited=[],promote=false,template='',hairPrompting,onEdit}:{value:RuleBox[];onChange:(value:RuleBox[])=>void;definitions:Ruleset[];origin?:RuleBox['origin'];inherited?:RuleBox[];promote?:boolean;template?:string;hairPrompting?:HairBox;onEdit?:(id:string)=>void}){
 const [folded,setFolded]=useState<Record<string,boolean>>({}),[channel,setChannel]=useState<{boxId:string;name:string}>();
 const all=[...inherited,...value],active=new Set(activeRuleBoxes(all));
 const patch=(id:string,changes:Partial<RuleBox>,preference=false)=>onChange(value.map(box=>box.id===id?{...box,...changes,...(promote&&preference?{origin:'encoder' as const,label:'Encoder override'}:{})}:box));
 const move=(index:number,delta:number)=>{const result=[...value];[result[index],result[index+delta]]=[result[index+delta],result[index]];onChange(result);};
 const card=(box:RuleBox,index:number,readOnly=false)=><fieldset className="cg-rule-box" key={(readOnly?'inherited:':'')+box.id} aria-label={'Ruleset box '+box.definition.name} style={{opacity:active.has(box)?1:.65}}>
  <legend><input aria-label={'Use ruleset '+box.definition.name} type="checkbox" disabled={readOnly} checked={box.enabled} onChange={event=>patch(box.id,{enabled:event.target.checked})}/>{box.definition.name} · {box.origin}{!active.has(box)&&box.enabled?' · overridden in this scope':''}</legend>
  <div className="cg-rule-toolbar">
   <button type="button" aria-label={((readOnly?folded[box.id]??box.collapsed:box.collapsed)?'Expand ruleset ':'Collapse ruleset ')+box.definition.name} aria-expanded={!(readOnly?folded[box.id]??box.collapsed:box.collapsed)} title={(readOnly?folded[box.id]??box.collapsed:box.collapsed)?'Expand':'Collapse'} onClick={()=>readOnly?setFolded({...folded,[box.id]:!(folded[box.id]??box.collapsed)}):patch(box.id,{collapsed:!box.collapsed})}>{(readOnly?folded[box.id]??box.collapsed:box.collapsed)?'▸':'▾'}</button>
   {!readOnly&&<><button type="button" aria-label="Move ruleset up" disabled={!index} onClick={()=>move(index,-1)}>▲</button><button type="button" aria-label="Move ruleset down" disabled={index===value.length-1} onClick={()=>move(index,1)}>▼</button><button type="button" aria-label="Remove ruleset box" onClick={()=>onChange(value.filter(item=>item.id!==box.id))}>×</button></>}
   {readOnly&&<button type="button" onClick={()=>onChange([...value,{...newRuleBox(box.definition),scope:box.scope,preferences:{...box.preferences},label:'Override '+(box.label||'prefix')}])}>Override on encoder</button>}
   {!readOnly&&onEdit&&<button type="button" onClick={()=>onEdit(box.id)}>Edit rules</button>}
  </div>
  {!(readOnly?folded[box.id]??box.collapsed:box.collapsed)&&<div>
   <small>{box.label||box.definition.family} · pinned ruleset snapshot</small>
   <label style={{display:'block',marginTop:6}}>Policy channel <select aria-label="Ruleset scope" disabled={readOnly} value={box.scope} onChange={event=>event.target.value==='__separate__'?setChannel({boxId:box.id,name:''}):patch(box.id,{scope:event.target.value})}><option value="main">Main · inherit and override</option>{[...new Set(all.map(row=>row.scope))].filter(scope=>scope!=='main').map((scope,index)=><option key={scope} value={scope}>Additional channel {index+1}{!scope.startsWith('channel-')?' · '+scope:''}</option>)}<option value="__separate__">Create independent channel…</option></select></label><small>Same family + channel: encoder overrides snapshot, prefix and global defaults. Independent channels combine; they do not bind subjects or regions.</small>
   {box.definition.rules.map((rule,index)=><RuleOperation key={index} rule={rule} template={template} inactive={!active.has(box)}/>)}
   {box.definition.choices.map(choice=>{
    const option=choice.options.find(option=>option.id===(box.preferences[choice.id]??choice.default));
    return <div className="cg-rule-preference" key={choice.id} aria-label={'Rule preference '+choice.label}>
     <label>{choice.label} <select aria-label={choice.label} disabled={readOnly} value={option?.id} onChange={event=>patch(box.id,{preferences:{...box.preferences,[choice.id]:event.target.value}},true)}>{choice.options.map(option=><option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
     {option?.rules.length?option.rules.map((rule,index)=><RuleOperation key={index} rule={rule} template={template} inactive={!active.has(box)}/>):<code className="cg-rule-operation">T′ = T</code>}
    </div>;
   })}
  </div>}
 </fieldset>;
 return <div aria-label="Ruleset boxes" className="cg-rule-controls">
  <RuleStyles/><Modal title="Name independent policy channel" open={!!channel} zIndex={BASE_Z_INDEX+160} onCancel={()=>setChannel(undefined)} onOk={()=>{if(channel?.name.trim()){patch(channel.boxId,{scope:channel.name.trim()});setChannel(undefined);}}} okButtonProps={{disabled:!channel?.name.trim()}}><Input autoFocus aria-label="Policy channel name" maxLength={100} value={channel?.name||''} onChange={event=>channel&&setChannel({...channel,name:event.target.value})}/><p>A family is an override key, such as hair. Within one family and channel, encoder rules take priority over inherited prefix rules and apply to the whole prompt. Different channels combine their rules; they do not create subject ownership.</p></Modal>
  {inherited.map((box,index)=>card(box,index,true))}{value.map((box,index)=>card(box,index))}
  {hairPrompting?.value&&<HairControls value={hairPrompting.value} template={template} onChange={hairPrompting.onChange} onRemove={()=>hairPrompting.onChange(null)}/>}
  <div className="cg-rule-add"><span aria-hidden="true">＋</span><select aria-label="Add ruleset" value="" onChange={event=>{
   if(event.target.value==='__hair_prompting__'){hairPrompting?.onChange(cleanHairPolicy(null));return;}
   const definition=definitions.find(item=>item.id===event.target.value);if(definition)onChange([...value,newRuleBox(definition,origin)]);
  }}><option value="">Add ruleset…</option>{hairPrompting&&!hairPrompting.value&&<option value="__hair_prompting__">Hair prompting · attribute filter</option>}{definitions.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
  <RuleNotation/>
 </div>;
}
