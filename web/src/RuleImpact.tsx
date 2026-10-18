import {createContext,useContext,useState,Fragment} from 'react';
import {LogicBadge} from './LogicBadge';
import {promptRuleOccurrences} from './PromptRuleContext';
import {ruleTag} from './RuleEngine';
import {parsePrompt,compileChip,type Chip} from './PromptBoxes';
export const RuleImpact=createContext<Set<string>|null>(null);
export const promptLeaves=(text:string)=>promptRuleOccurrences(text).occurrences.map(item=>item.tag);
export function useRuleImpact(){return useContext(RuleImpact);}
/** Read-only recipe preview: preserve branches, compound options and weights. */
function PromptRelations({text,enabled,depth=0}:{text:string;enabled:boolean;depth?:number}){
 const effective=useRuleImpact(),chips=parsePrompt(text);
 if(depth>32)return <span>{text}</span>;
 return <span className="cg-prompt-expression" data-prompt-operator={chips.length>1?'AND':undefined}>{chips.map((chip,index)=>{
  let content;
  if(chip.kind==='or')content=<span className="cg-prompt-branch" data-prompt-operator="OR">{chip.optional&&<LogicBadge name="OPTIONAL"/>}{chip.options.map((option,at)=><Fragment key={at}>{at>0&&<LogicBadge name="OR"/>}<PromptRelations text={option} enabled={enabled} depth={depth+1}/></Fragment>)}{chip.optional&&<><LogicBadge name="OR"/><span className="cg-rule-empty">∅</span></>}</span>;
  else if(chip.weight!==undefined||chip.emphasis)content=<span className="cg-prompt-branch"><small>{chip.weight!==undefined?'×'+chip.weight:chip.emphasis==='square'?'[ emphasis ]':'( emphasis )'}</small><PromptRelations text={chip.text} enabled={enabled} depth={depth+1}/></span>;
  else {const omitted=!enabled||!!effective&&!effective.has(ruleTag(chip.text));content=<span className="cg-rule-tag" data-rule-omitted={omitted||undefined} style={{textDecoration:omitted?'line-through':undefined,opacity:omitted ? .5 : 1}}>{chip.text.replace(/_/g,' ')}</span>;}
  return <Fragment key={index}>{index>0&&<LogicBadge name="AND"/>}{chip.kind==='or'&&chip.weight!==undefined?<span className="cg-prompt-branch"><small>×{chip.weight}</small>{content}</span>:content}</Fragment>;
 })}</span>;
}
export function CollapsedTags({text,enabled=true}:{text:string;enabled?:boolean}){
 const [open,setOpen]=useState(false),chips=parsePrompt(text),single=chips.length===1?chips[0]:undefined;
 return <details className="cg-prompt-preview" aria-label="Collapsed tag effects" onClick={event=>event.stopPropagation()} onToggle={event=>setOpen(event.currentTarget.open)}>
  <summary>Prompt · {promptLeaves(text).length} tags {chips.length>1?<LogicBadge name="AND"/>:single?.kind==='or'?<><LogicBadge name="OR"/>{single.optional&&<LogicBadge name="OPTIONAL"/>}</>:null}</summary>
  {open&&<div className="cg-prompt-preview-body"><button type="button" onClick={()=>void navigator.clipboard.writeText(text)}>Copy syntax</button><PromptRelations text={text} enabled={enabled}/></div>}
 </details>;
}
export function tagCount(chips:Chip[]){return promptLeaves(chips.map(chip=>compileChip({...chip,enabled:true})).join(', ')).length;}
