import catalog from '../../data/source-tag-categories.json';
import stock from '../../data/prompt-rulesets.json';
import aliases from '../../data/global-tag-rules.json';
import {splitTop} from './PromptBoxes';
export type SourceCategory={id:string;label:string;families:string[];facets:string[];parent?:string;tags?:string[]};
export const SOURCE_CATEGORIES:SourceCategory[]=catalog.categories;
export const SOURCE_PRESETS=catalog.presets;
const key=(text:string)=>{const normalized=text.trim().toLowerCase().replace(/\s+/g,'_');return (aliases.aliases as Record<string,string>)[normalized]||normalized;};
const tags=Object.fromEntries(SOURCE_CATEGORIES.map(category=>[category.id,new Set(stock.definitions.filter(definition=>category.families.includes(definition.family)).flatMap(definition=>[...definition.rules,...definition.choices.flatMap(choice=>choice.options.flatMap(option=>option.rules))].flatMap(rule=>rule.tags)).map(key))]));
for(const category of SOURCE_CATEGORIES)for(const facet of aliases.facets)if(category.facets.some(prefix=>facet.id.startsWith(prefix)))for(const member of facet.members)tags[category.id].add(key(member.tag));
for(const category of SOURCE_CATEGORIES)for(const tag of category.tags||[])tags[category.id].add(key(tag));
for(const category of SOURCE_CATEGORIES)if(category.parent)for(const tag of tags[category.id])tags[category.parent]?.add(tag);
export function filterSourceCategories(text:string,excluded:string[]=[]):{text:string;removed:{tag:string;categories:string[]}[]}{
 const removed=new Map<string,string[]>();
 const wraps=(value:string,left:string,right:string)=>{if(!value.startsWith(left)||!value.endsWith(right))return false;let depth=0;for(let at=0;at<value.length;at++){if(value[at]===left)depth++;else if(value[at]===right)depth--;if(depth===0&&at!==value.length-1)return false;}return depth===0;};
 const rewrite=(value:string,depth=0):string=>{
  if(depth>32)return value;
  return splitTop(value,',').flatMap(raw=>{
   const part=raw.trim();if(!part)return [];
   if(wraps(part,'{','}')){const options=splitTop(part.slice(1,-1),'|').map(option=>rewrite(option,depth+1));return options.some(Boolean)?['{'+options.join('|')+'}']:[];}
   if(wraps(part,'(',')')||wraps(part,'[',']')){const weight=/:-?\d+(?:\.\d+)?(?=\)$)/.exec(part)?.[0]||'';const inner=part.slice(1,-1-(weight.length||0));const kept=rewrite(inner,depth+1);return kept?[part[0]+kept+weight+part.slice(-1)]:[];}
   const categories=excluded.filter(category=>tags[category]?.has(key(part)));if(categories.length){removed.set(part,categories);return [];}return [part];
  }).join(', ');
 };
 return {text:excluded.length?rewrite(text):text,removed:[...removed].map(([tag,categories])=>({tag,categories}))};
}
