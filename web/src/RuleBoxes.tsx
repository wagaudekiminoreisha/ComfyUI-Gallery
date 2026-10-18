import {newRuleBox} from './RulesLibrary';
import {activeRuleBoxes,type RuleBox,type Ruleset} from './RuleEngine';

export function RuleBoxes({value,onChange,definitions,origin='encoder',inherited=[],promote=false}:{value:RuleBox[];onChange:(value:RuleBox[])=>void;definitions:Ruleset[];origin?:RuleBox['origin'];inherited?:RuleBox[];promote?:boolean}){
 const all=[...inherited,...value],active=new Set(activeRuleBoxes(all));
 const patch=(id:string,changes:Partial<RuleBox>,preference=false)=>onChange(value.map(box=>box.id===id?{...box,...changes,...(promote&&preference?{origin:'encoder' as const,label:'Encoder override'}:{})}:box));
 const move=(index:number,delta:number)=>{const result=[...value];[result[index],result[index+delta]]=[result[index+delta],result[index]];onChange(result);};
 const card=(box:RuleBox,index:number,readOnly=false)=><fieldset key={(readOnly?'inherited:':'')+box.id} aria-label={'Ruleset box '+box.definition.name} style={{border:'1px solid #9270c9',borderRadius:6,padding:6,margin:'6px 0',opacity:active.has(box)?1:.65,minWidth:0}}>
  <legend><input aria-label={'Use ruleset '+box.definition.name} type="checkbox" disabled={readOnly} checked={box.enabled} onChange={event=>patch(box.id,{enabled:event.target.checked})}/>{box.definition.name} · {box.origin}{!active.has(box)&&box.enabled?' · overridden in this scope':''}</legend>
  <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
   <button type="button" aria-label={'Collapse ruleset '+box.definition.name} disabled={readOnly} onClick={()=>patch(box.id,{collapsed:!box.collapsed})}>{box.collapsed?'Expand':'Collapse'}</button>
   {!readOnly&&<><button type="button" aria-label="Move ruleset up" disabled={!index} onClick={()=>move(index,-1)}>▲</button><button type="button" aria-label="Move ruleset down" disabled={index===value.length-1} onClick={()=>move(index,1)}>▼</button><button type="button" aria-label="Remove ruleset box" onClick={()=>onChange(value.filter(item=>item.id!==box.id))}>×</button></>}
   {readOnly&&<button type="button" onClick={()=>onChange([...value,{...newRuleBox(box.definition),scope:box.scope,preferences:{...box.preferences},label:'Override '+(box.label||'prefix')}])}>Override on encoder</button>}
  </div>
  {(!box.collapsed||readOnly)&&<div>
   <small>{box.label||box.definition.family} · pinned ruleset snapshot</small>
   <label style={{display:'block'}}>Policy scope <input aria-label="Ruleset scope" disabled={readOnly} value={box.scope} onChange={event=>patch(box.id,{scope:event.target.value||'main'})}/></label>
   {box.definition.choices.map(choice=><label key={choice.id} style={{display:'block',marginTop:6}}>{choice.label} <select aria-label={choice.label} disabled={readOnly} value={box.preferences[choice.id]??choice.default} onChange={event=>patch(box.id,{preferences:{...box.preferences,[choice.id]:event.target.value}},true)} style={{maxWidth:'100%'}}>{choice.options.map(option=><option key={option.id} value={option.id}>{option.label}</option>)}</select></label>)}
   {!box.definition.choices.length&&<small>Script rules only · edit in workspace Rules.</small>}
  </div>}
 </fieldset>;
 return <div aria-label="Ruleset boxes">
  {inherited.map((box,index)=>card(box,index,true))}{value.map((box,index)=>card(box,index))}
  <select aria-label="Add ruleset" value="" onChange={event=>{const definition=definitions.find(item=>item.id===event.target.value);if(definition)onChange([...value,newRuleBox(definition,origin)]);}} style={{maxWidth:'100%'}}><option value="">Add ruleset…</option>{definitions.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select>
 </div>;
}
