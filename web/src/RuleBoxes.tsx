import {newRuleBox} from './RulesLibrary';
import {activeRuleBoxes,type RuleBox,type Ruleset} from './RuleEngine';
import {RuleOperation,RuleNotation,RuleStyles} from './RuleOperation';
import {HairControls} from './HairControls';
import {cleanHairPolicy,type HairPolicy} from './HairPolicy';

type HairBox={value:HairPolicy|null;onChange:(value:HairPolicy|null)=>void};
export function RuleBoxes({value,onChange,definitions,origin='encoder',inherited=[],promote=false,template='',hairPrompting}:{value:RuleBox[];onChange:(value:RuleBox[])=>void;definitions:Ruleset[];origin?:RuleBox['origin'];inherited?:RuleBox[];promote?:boolean;template?:string;hairPrompting?:HairBox}){
 const all=[...inherited,...value],active=new Set(activeRuleBoxes(all));
 const patch=(id:string,changes:Partial<RuleBox>,preference=false)=>onChange(value.map(box=>box.id===id?{...box,...changes,...(promote&&preference?{origin:'encoder' as const,label:'Encoder override'}:{})}:box));
 const move=(index:number,delta:number)=>{const result=[...value];[result[index],result[index+delta]]=[result[index+delta],result[index]];onChange(result);};
 const card=(box:RuleBox,index:number,readOnly=false)=><fieldset className="cg-rule-box" key={(readOnly?'inherited:':'')+box.id} aria-label={'Ruleset box '+box.definition.name} style={{opacity:active.has(box)?1:.65}}>
  <legend><input aria-label={'Use ruleset '+box.definition.name} type="checkbox" disabled={readOnly} checked={box.enabled} onChange={event=>patch(box.id,{enabled:event.target.checked})}/>{box.definition.name} · {box.origin}{!active.has(box)&&box.enabled?' · overridden in this scope':''}</legend>
  <div className="cg-rule-toolbar">
   <button type="button" aria-label={'Collapse ruleset '+box.definition.name} disabled={readOnly} onClick={()=>patch(box.id,{collapsed:!box.collapsed})}>{box.collapsed?'Expand':'Collapse'}</button>
   {!readOnly&&<><button type="button" aria-label="Move ruleset up" disabled={!index} onClick={()=>move(index,-1)}>▲</button><button type="button" aria-label="Move ruleset down" disabled={index===value.length-1} onClick={()=>move(index,1)}>▼</button><button type="button" aria-label="Remove ruleset box" onClick={()=>onChange(value.filter(item=>item.id!==box.id))}>×</button></>}
   {readOnly&&<button type="button" onClick={()=>onChange([...value,{...newRuleBox(box.definition),scope:box.scope,preferences:{...box.preferences},label:'Override '+(box.label||'prefix')}])}>Override on encoder</button>}
  </div>
  {(!box.collapsed||readOnly)&&<div>
   <small>{box.label||box.definition.family} · pinned ruleset snapshot</small>
   <label style={{display:'block',marginTop:6}}>Policy scope <input aria-label="Ruleset scope" disabled={readOnly} value={box.scope} onChange={event=>patch(box.id,{scope:event.target.value||'main'})}/></label>
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
  <RuleStyles/>
  {inherited.map((box,index)=>card(box,index,true))}{value.map((box,index)=>card(box,index))}
  {hairPrompting?.value&&<HairControls value={hairPrompting.value} template={template} onChange={hairPrompting.onChange} onRemove={()=>hairPrompting.onChange(null)}/>}
  <div className="cg-rule-add"><span aria-hidden="true">＋</span><select aria-label="Add ruleset" value="" onChange={event=>{
   if(event.target.value==='__hair_prompting__'){hairPrompting?.onChange(cleanHairPolicy(null));return;}
   const definition=definitions.find(item=>item.id===event.target.value);if(definition)onChange([...value,newRuleBox(definition,origin)]);
  }}><option value="">Add ruleset…</option>{hairPrompting&&!hairPrompting.value&&<option value="__hair_prompting__">Hair prompting · attribute filter</option>}{definitions.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
  <RuleNotation/>
 </div>;
}
