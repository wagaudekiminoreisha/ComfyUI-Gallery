import {createContext,useContext} from 'react';
import {promptRuleOccurrences} from './PromptRuleContext';
import {ruleTag} from './RuleEngine';
import {parsePrompt,compileChip,type Chip} from './PromptBoxes';
export const RuleImpact=createContext<Set<string>|null>(null);
export const promptLeaves=(text:string)=>promptRuleOccurrences(text).occurrences.map(item=>item.tag);
export function useRuleImpact(){return useContext(RuleImpact);}
export function CollapsedTags({text,enabled=true}:{text:string;enabled?:boolean}){const effective=useRuleImpact();return <div className="cg-rule-tag-chips" aria-label="Collapsed tag effects">{promptLeaves(text).map((tag,index)=>{const omitted=!enabled||!!effective&&!effective.has(ruleTag(tag));return <span className="cg-rule-tag" key={index} data-rule-omitted={omitted||undefined} style={{textDecoration:omitted?'line-through':undefined,opacity:omitted ? .5 : 1}}>{tag.replace(/_/g,' ')}</span>;})}</div>;}
export function tagCount(chips:Chip[]){return promptLeaves(chips.map(chip=>compileChip({...chip,enabled:true})).join(', ')).length;}
