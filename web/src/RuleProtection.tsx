import {createContext,useEffect,useState} from 'react';
import {applyRulePreview} from './RuleEngine';
import {rulesRequest,RULES_CHANGED} from './RulesLibrary';
import {globalRuleBoxes} from './RuleAvailability';
export const RuleProtection=createContext<string[]>([]);
export function useGlobalProtections(text:string){
 const [tags,setTags]=useState<string[]>([]);
 useEffect(()=>{let live=true;const load=()=>{void rulesRequest().then(result=>{if(live)setTags(applyRulePreview(text,globalRuleBoxes(result.library)).protectedTags);}).catch(()=>{});};load();window.addEventListener(RULES_CHANGED,load);return()=>{live=false;window.removeEventListener(RULES_CHANGED,load);};},[text]);
 return tags;
}
