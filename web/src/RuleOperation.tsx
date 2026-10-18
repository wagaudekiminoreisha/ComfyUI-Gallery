import {LogicBadge,RuleTagChips} from './LogicBadge';
import type {Rule,RuleCondition} from './RuleEngine';
import {describeRule} from './RulePresentation';
import ruleControlsCss from './RuleControls.css?inline';
export function RuleStyles(){return <style>{ruleControlsCss}</style>;}

function TagSet({label,tags}:{label:string;tags:string[]}){
 return <div className="cg-rule-set">{label.includes("∩")?<LogicBadge name="IN BOTH"/>:<small>{label}</small>} <RuleTagChips tags={tags}/></div>;
}
export function RuleOperation({rule,template='',inactive=false,keep=false,warning=false}:{rule:Rule;template?:string;inactive?:boolean;keep?:boolean;warning?:boolean}){
 const effect=describeRule(rule,template);
 return <div className="cg-rule-operation" aria-label={'Rule operation '+(keep?'keep':warning?'warn':rule.op)} data-inactive={inactive||undefined}>
  <div className="cg-rule-toolbar"><LogicBadge name={keep?'KEEP':warning?'AT MOST ONE':({exclude:'EXCLUDE',require:'ADD',select:'PICK ONE',exclusive:'AT MOST ONE',protect:'PROTECT'}[rule.op])}/><code className="cg-rule-expression">{keep?'T′ ∩ S = T ∩ S':warning?'WARN(|T ∩ S| > 1)':effect.expression}</code></div>
  <div>{effect.incomplete?<code>Tₜ ∩ S = ? (preview limit)</code>:<TagSet label="Tₜ ∩ S" tags={effect.matched}/>}</div>
  {!effect.incomplete&&!keep&&!warning&&!!effect.removed.length&&<TagSet label="−" tags={effect.removed}/>}
  {!effect.incomplete&&!keep&&!warning&&!!effect.added.length&&<TagSet label="+" tags={effect.added}/>}
  {rule.condition&&<Condition value={rule.condition}/>}
  {!!effect.condition.length&&<TagSet label="C" tags={effect.condition}/>}
  <details className="cg-rule-universe"><summary><small>S · {effect.pool.length}</small> <RuleTagChips tags={effect.pool.slice(0,4)}/>{effect.pool.length>4&&<small> +{effect.pool.length-4}</small>}</summary><RuleTagChips tags={effect.pool}/></details>
 </div>;
}
export function RuleNotation(){return <small className="cg-rule-notation">T = sampled tags · Tₜ = template tags · B = batch-editable tags · S = rule tags. ∪ add · ∖ remove · ∩ match. Template matches may be optional.</small>;}

function Condition({value}:{value:RuleCondition}){
 return value.op==='tag'?<RuleTagChips tags={[value.tag]}/>:<div className="cg-rule-tree"><LogicBadge name={value.op==='all'?'AND':value.op==='any'?'OR':'NOT'}/>{value.children.map((child,index)=><Condition key={index} value={child}/>)}</div>;
}
