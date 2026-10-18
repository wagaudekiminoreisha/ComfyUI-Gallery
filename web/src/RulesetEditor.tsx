import {Button,Input,Select,Space,Tag} from 'antd';
import type {Rule,RuleCondition,Ruleset} from './RuleEngine';
import {LogicBadge} from './LogicBadge';
import {RuleStyles} from './RuleOperation';
const id=()=>crypto.randomUUID?.()||'item-'+Date.now()+'-'+Math.random();
const names={exclude:'EXCLUDE',require:'ADD',select:'PICK ONE',exclusive:'AT MOST ONE',protect:'PROTECT'};
function TagInput({value,onChange,label}:{value:string[];onChange:(value:string[])=>void;label:string}){return <Select mode="tags" aria-label={label} value={value} onChange={onChange} tokenSeparators={[',']} maxTagCount={6} style={{minWidth:180,width:'100%'}} placeholder="Type tags and press Enter" tagRender={({label,closable,onClose})=><Tag closable={closable} onClose={onClose}>{label}</Tag>}/>;}
function ConditionEditor({value,onChange,depth=0}:{value?:RuleCondition;onChange:(value:RuleCondition|undefined)=>void;depth?:number}){
 const group=value&&value.op!=='tag'?value:undefined;
 return <div className="cg-rule-tree" aria-label="Rule condition tree">
  <Space><LogicBadge name="IF"/><Select aria-label="Condition operator" value={value?.op||'always'} style={{width:130}} onChange={op=>onChange(op==='always'?undefined:op==='tag'?{op:'tag',tag:''}:{op:op as 'all'|'any'|'not',children:group?.children||[]})} options={[{value:'always',label:'Always'},{value:'tag',label:'TAG'},{value:'all',label:'AND · all'},{value:'any',label:'OR · any'},{value:'not',label:'NOT · none'}]}/>
  {value?.op==='tag'&&<Input aria-label="Condition tag" value={value.tag} onChange={event=>onChange({...value,tag:event.target.value})} placeholder="Tag"/>}</Space>
  {group&&<>{group.children.map((child,index)=><div key={index}><ConditionEditor value={child} depth={depth+1} onChange={next=>onChange({...group,children:group.children.flatMap((item,at)=>at===index?next?[next]:[]:[item])})}/><Button size="small" onClick={()=>onChange({...group,children:group.children.filter((_,at)=>at!==index)})}>Remove condition</Button></div>)}
   <Space><Button size="small" onClick={()=>onChange({...group,children:[...group.children,{op:'tag',tag:''}]})}>+ Tag condition</Button><Button size="small" disabled={depth>=7} onClick={()=>onChange({...group,children:[...group.children,{op:'all',children:[]}]})}>+ Nested group</Button></Space>
  </>}
 </div>;
}
export function RuleListEditor({value,onChange}:{value:Rule[];onChange:(value:Rule[])=>void}){
 const patch=(index:number,next:Rule)=>onChange(value.map((row,at)=>at===index?next:row));
 return <div aria-label="Rule steps">{value.map((rule,index)=><fieldset className="cg-rule-box" key={index}>
  <legend>Step {index+1}</legend><Space wrap><Select aria-label="Rule action" value={rule.op} onChange={op=>patch(index,{...rule,op,...(op==='select'?{value:rule.value||rule.tags[0]||''}:{})})} style={{width:170}} options={Object.entries(names).map(([value,label])=>({value,label}))}/>
  <Button aria-label="Move rule up" disabled={!index} onClick={()=>{const rows=[...value];[rows[index-1],rows[index]]=[rows[index],rows[index-1]];onChange(rows);}}>↑</Button><Button danger onClick={()=>onChange(value.filter((_,at)=>at!==index))}>Remove rule</Button></Space>
  <TagInput label="Rule tags" value={rule.tags} onChange={tags=>patch(index,{...rule,tags,...(rule.op==='select'&&!tags.includes(rule.value||'')?{value:tags[0]||''}:{})})}/>
  {rule.op==='select'&&<Select aria-label="Required rule choice" placeholder="Choose the fixed tag" value={rule.value} onChange={value=>patch(index,{...rule,value})} options={rule.tags.map(tag=>({value:tag,label:tag}))} style={{width:'100%',marginTop:6}}/>}
  <details><summary>Conditions{rule.condition||rule.if_all?.length?' · customized':' · always'}</summary><ConditionEditor value={rule.condition||(rule.if_all?.length?{op:'all',children:rule.if_all.map(tag=>({op:'tag',tag}))}:undefined)} onChange={condition=>{const next={...rule,condition};delete next.if_all;patch(index,next);}}/></details>
 </fieldset>)}<Button onClick={()=>onChange([...value,{op:'exclude',tags:[]}])}>+ Rule</Button></div>;
}
export function RulesetEditor({value,onChange}:{value:Ruleset;onChange:(value:Ruleset)=>void}){
 return <div className="cg-rule-controls cg-rule-tree" aria-label="Visual ruleset editor"><RuleStyles/>
  <Space wrap><label>Name <Input aria-label="Ruleset name" value={value.name} onChange={event=>onChange({...value,name:event.target.value})}/></label><label>Override family <Input aria-label="Ruleset family" value={value.family} onChange={event=>onChange({...value,family:event.target.value})}/></label></Space>
  <details open><summary><LogicBadge name="AND"/>Base rules · {value.rules.length}</summary><RuleListEditor value={value.rules} onChange={rules=>onChange({...value,rules})}/></details>
  {value.choices.map((choice,index)=><details className="cg-rule-tree" key={choice.id}><summary><LogicBadge name="OR"/>{choice.label} · {choice.options.length} options</summary>
   <Space><Input aria-label="Preference label" value={choice.label} onChange={event=>onChange({...value,choices:value.choices.map((row,at)=>at===index?{...row,label:event.target.value}:row)})}/><Button danger onClick={()=>onChange({...value,choices:value.choices.filter((_,at)=>at!==index)})}>Remove preference</Button></Space>
   {choice.options.map((option,at)=><details key={option.id} className="cg-rule-tree"><summary>{option.label}{option.id===choice.default?' · default':''}</summary>
    <Input aria-label="Option label" value={option.label} onChange={event=>onChange({...value,choices:value.choices.map((row,n)=>n===index?{...row,options:row.options.map((item,m)=>m===at?{...item,label:event.target.value}:item)}:row)})}/>
    <Space><Button disabled={option.id===choice.default} onClick={()=>onChange({...value,choices:value.choices.map((row,n)=>n===index?{...row,default:option.id}:row)})}>Make default</Button><Button danger disabled={choice.options.length===1} onClick={()=>{const options=choice.options.filter(item=>item.id!==option.id);onChange({...value,choices:value.choices.map((row,n)=>n===index?{...row,options,default:row.default===option.id?options[0].id:row.default}:row)});}}>Remove option</Button></Space>
    <RuleListEditor value={option.rules} onChange={rules=>onChange({...value,choices:value.choices.map((row,n)=>n===index?{...row,options:row.options.map((item,m)=>m===at?{...item,rules}:item)}:row)})}/>
   </details>)}
   <Button onClick={()=>onChange({...value,choices:value.choices.map((row,n)=>n===index?{...row,options:[...row.options,{id:id(),label:'New option',rules:[]}]}:row)})}>+ Option</Button>
  </details>)}
  <Button onClick={()=>{const option=id();onChange({...value,choices:[...value.choices,{id:id(),label:'New preference',default:option,options:[{id:option,label:'Keep supplied',rules:[]}]}]});}}>+ Preference</Button>
 </div>;
}
