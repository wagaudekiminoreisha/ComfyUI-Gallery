import {ComfyAppApi} from './ComfyAppApi';
import type {RuleBox,RulesLibrary,Ruleset} from './RuleEngine';
export const RULES_CHANGED='gallery-rules-changed',OPEN_RULES='gallery-rules-open';
export const newRuleBox=(definition:Ruleset,origin:RuleBox['origin']='encoder'):RuleBox=>({id:crypto.randomUUID?.()||'rule-'+Date.now()+'-'+Math.random(),definition:JSON.parse(JSON.stringify(definition)),scope:'main',origin,preferences:{},enabled:true,collapsed:false});
export async function rulesRequest(library?:RulesLibrary,revision?:string):Promise<{library:RulesLibrary;revision:string}>{
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),10000);
    try {
        const response=await ComfyAppApi.rulesLibrary({...library?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({library,revision})}:{},signal:controller.signal});
        const result=await response.json();if(!response.ok)throw new Error(result.error||'Rules request failed');
        return result;
    } finally {clearTimeout(timeout);}
}
const rulesChannel=typeof BroadcastChannel!=='undefined'?new BroadcastChannel('gallery-rules-library'):undefined;
if(rulesChannel)rulesChannel.onmessage=event=>window.dispatchEvent(new CustomEvent(RULES_CHANGED,{detail:{resetGlobals:event.data===true}}));
export function announceRules(resetGlobals=false){window.dispatchEvent(new CustomEvent(RULES_CHANGED,{detail:{resetGlobals}}));rulesChannel?.postMessage(resetGlobals);}

export function openRules(prefixId?:string){window.dispatchEvent(new CustomEvent(OPEN_RULES,{detail:{prefixId}}));}
