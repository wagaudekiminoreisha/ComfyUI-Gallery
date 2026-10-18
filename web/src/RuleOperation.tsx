import type {Rule} from './RuleEngine';
import {describeRule} from './RulePresentation';
import ruleControlsCss from './RuleControls.css?inline';
export function RuleStyles(){return <style>{ruleControlsCss}</style>;}

function TagSet({label,tags}:{label:string;tags:string[]}){
 const text='{'+tags.join(', ')+'}';
 return tags.length>8?<details className="cg-rule-set"><summary><code>{label} = {'{'+tags.slice(0,6).join(', ')+', …}'}</code> · {tags.length}</summary><code>{text}</code></details>:<div className="cg-rule-set"><code>{label} = {text}</code></div>;
}
export function RuleOperation({rule,template='',inactive=false,keep=false,warning=false}:{rule:Rule;template?:string;inactive?:boolean;keep?:boolean;warning?:boolean}){
 const effect=describeRule(rule,template);
 return <div className="cg-rule-operation" aria-label={'Rule operation '+(keep?'keep':warning?'warn':rule.op)} data-inactive={inactive||undefined}>
  <code className="cg-rule-expression">{keep?'T′ ∩ S = T ∩ S':warning?'WARN(|T ∩ S| > 1)':effect.expression}</code>
  <div>{effect.incomplete?<code>Tₜ ∩ S = ? (preview limit)</code>:<TagSet label="Tₜ ∩ S" tags={effect.matched}/>}</div>
  {!effect.incomplete&&!keep&&!warning&&!!effect.removed.length&&<TagSet label="−" tags={effect.removed}/>}
  {!effect.incomplete&&!keep&&!warning&&!!effect.added.length&&<TagSet label="+" tags={effect.added}/>}
  {!!effect.condition.length&&<TagSet label="C" tags={effect.condition}/>}
  <details className="cg-rule-universe"><summary>S · {effect.pool.length} tags</summary><code>{'{'+effect.pool.join(', ')+'}'}</code></details>
 </div>;
}
export function RuleNotation(){return <small className="cg-rule-notation">T = sampled tags · Tₜ = template tags · B = batch-editable tags · S = rule tags. ∪ add · ∖ remove · ∩ match. Template matches may be optional.</small>;}
