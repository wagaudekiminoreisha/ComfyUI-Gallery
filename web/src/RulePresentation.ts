import type {Rule} from './RuleEngine';
import {ruleTag} from './RuleEngine';
import {promptRuleOccurrences} from './PromptRuleContext';

/** Read-only set notation; describes the executable program, never changes it. */
export function describeRule(rule:Rule,template:string){
 const parsed=promptRuleOccurrences(template),pool=[...new Set(rule.tags.map(ruleTag))],input=new Set(parsed.occurrences.map(item=>ruleTag(item.tag)));
 const value=rule.value?ruleTag(rule.value):'';
 const expressions={exclude:'T′ = T ∖ S',require:'T′ = T ∪ S',select:`T′ = (T ∖ (S ∖ {${value}})) ∪ {${value}}`,exclusive:'|T ∩ S| ≤ 1',protect:'B′ = B ∖ S'};
 return {incomplete:parsed.incomplete,expression:(rule.if_all?.length?'C ⊆ T ⇒ ':'')+expressions[rule.op],pool,condition:rule.if_all?.map(ruleTag)||[],matched:pool.filter(tag=>input.has(tag)),removed:pool.filter(tag=>input.has(tag)&&(rule.op==='exclude'||rule.op==='select'&&tag!==value)),added:(rule.op==='require'?pool:rule.op==='select'?[value]:[]).filter(tag=>!input.has(tag))};
}
