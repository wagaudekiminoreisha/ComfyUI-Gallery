import { compileChip, parsePrompt } from './PromptBoxes';
import { compatibleBranches, promptRuleOccurrences } from './PromptRuleContext';
import pack from '../../data/global-tag-rules.json';

export type RuleCondition={op:'tag';tag:string}|{op:'all'|'any'|'not';children:RuleCondition[]};
export type Rule = { op: 'exclude'|'protect'|'require'|'select'|'exclusive'; tags:string[]; value?:string; if_all?:string[];condition?:RuleCondition };
export type Ruleset = { version:1; id:string; name:string; family:string; rules:Rule[]; choices:{id:string;label:string;default:string;options:{id:string;label:string;rules:Rule[]}[]}[] };
export type RuleBox = {id:string;definition:Ruleset;scope:string;origin:'global'|'prefix'|'snapshot'|'encoder';label?:string;preferences:Record<string,string>;enabled:boolean;collapsed:boolean};
export type RulesLibrary = {version:1;definitions:Ruleset[];globals:RuleBox[];prefixes:Record<string,RuleBox[]>};
export const ruleTag = (text:string) => {const key=text.trim().toLowerCase().replace(/\s+/g,'_');return (pack.aliases as Record<string,string>)[key]||key;};
const ranks={global:0,prefix:1,snapshot:2,encoder:3};
export const ruleBoxKey=(box:RuleBox)=>box.definition.family+'\n'+box.scope;
export function activeRuleBoxes(boxes:RuleBox[]) {
    const maxima=new Map<string,number>();
    for(const box of boxes)if(box.enabled)maxima.set(ruleBoxKey(box),Math.max(maxima.get(ruleBoxKey(box))??-1,ranks[box.origin]));
    return boxes.filter(box=>box.enabled&&ranks[box.origin]===maxima.get(ruleBoxKey(box)));
}
export function selectedRules(box:RuleBox):Rule[]{return [...box.definition.rules,...box.definition.choices.flatMap(choice=>choice.options.find(option=>option.id===(box.preferences[choice.id]??choice.default))?.rules||[])];}
function filterTags(text:string,excluded:Set<string>,depth=0):string {
    if(depth>32)throw new Error('Prompt nesting exceeds rules limit.');
    return parsePrompt(text).flatMap(chip=>{
        if(chip.kind==='or'){
            const options=chip.options.map(option=>filterTags(option,excluded,depth+1));
            return options.some(Boolean)?[compileChip({...chip,options})]:[];
        }
        if(chip.text!==text&&/[,{}()[\]]/.test(chip.text)){const inner=filterTags(chip.text,excluded,depth+1);return inner?[compileChip({...chip,text:inner})]:[];}
        return excluded.has(ruleTag(chip.text))?[]:[compileChip(chip)];
    }).join(', ');
}
export function conditionPreview(condition:RuleCondition|undefined,items:{tag:string;conditions:Map<number,number>}[]):boolean|undefined {
    if(!condition)return true;
    if(condition.op==='tag'){const found=items.filter(item=>item.tag===ruleTag(condition.tag));return found.some(item=>!item.conditions.size)?true:found.length?undefined:false;}
    const values=condition.children.map(child=>conditionPreview(child,items));
    if(condition.op==='all')return values.includes(false)?false:values.every(value=>value===true)?true:undefined;
    if(condition.op==='any')return values.includes(true)?true:values.every(value=>value===false)?false:undefined;
    return values.includes(true)?false:values.every(value=>value===false)?true:undefined;
}
/** Preview checks reachable branches; conditional rules wait for resolved input unless guaranteed. */
export function applyRulePreview(text:string,boxes:RuleBox[]){
    const parsed=promptRuleOccurrences(text),items=parsed.occurrences.map(item=>({...item,tag:ruleTag(item.tag)}));
    const excluded=new Set<string>(),required=new Map<string,string>(),protectedTags=new Set<string>(),exclusive:{tags:string[];name:string}[]=[];
    const errors:string[]=[],notes:string[]=[];
    for(const box of activeRuleBoxes(boxes))for(const rule of selectedRules(box)){
        if(rule.if_all?.length&&!rule.if_all.every(tag=>items.some(item=>item.tag===ruleTag(tag)&&!item.conditions.size))){notes.push('Conditional rules are checked after optional choices.');continue;}
        const matches=conditionPreview(rule.condition,items);if(matches===false)continue;if(matches===undefined){notes.push('Conditional rules are checked after optional choices.');continue;}
        const tags=rule.tags.map(ruleTag);
        if(rule.op==='exclude')tags.forEach(tag=>excluded.add(tag));
        if(rule.op==='protect')tags.forEach(tag=>protectedTags.add(tag));
        if(rule.op==='require')rule.tags.forEach(tag=>required.set(ruleTag(tag),tag));
        if(rule.op==='select'){const value=ruleTag(rule.value!);tags.filter(tag=>tag!==value).forEach(tag=>excluded.add(tag));required.set(value,rule.value!);}
        if(rule.op==='exclusive')exclusive.push({tags,name:box.definition.name});
    }
    for(const tag of required.keys())if(excluded.has(tag))errors.push('Required and excluded: '+tag.replace(/_/g,' '));
    const output=items.some(item=>excluded.has(item.tag))?filterTags(text,excluded):text;
    const remaining=promptRuleOccurrences(output).occurrences.map(item=>({...item,tag:ruleTag(item.tag)}));
    // Always-required literals must exist unconditionally; an optional occurrence is insufficient.
    const additions=[...required].filter(([tag])=>!remaining.some(item=>item.tag===tag&&!item.conditions.size)).map(([,tag])=>tag);
    const candidates=[...remaining,...[...required.keys()].map(tag=>({tag,conditions:new Map<number,number>()}))];
    for(const rule of exclusive)if(candidates.some((a,i)=>rule.tags.includes(a.tag)&&candidates.slice(i+1).some(b=>b.tag!==a.tag&&rule.tags.includes(b.tag)&&compatibleBranches(a.conditions,b.conditions))))errors.push(rule.name+': competing exclusive tags can occur together. Choose a preference.');
    if(parsed.incomplete)notes.push('Rule preview is incomplete for this large prompt; execution performs the final check.');
    return {text:[output,...additions].filter(Boolean).join(', '),errors:[...new Set(errors)],notes:[...new Set(notes)],protectedTags:[...protectedTags].map(tag=>tag.replace(/_/g,' '))};
}
