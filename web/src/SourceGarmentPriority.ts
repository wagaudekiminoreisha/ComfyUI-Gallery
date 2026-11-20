/** Mirrors source_garment_priority.py. Source AND tags anchor manual choices. */
import pack from '../../data/source-garment-priority.json';
import {splitTop} from './PromptBoxes';
import {promptWrapper,type Contribution} from './PromptDeduplication';
import {ruleTag,activeRuleBoxes,activeRuleChannels,choiceChannel,type RuleBox} from './RuleEngine';
const tags=pack.tags as Record<string,Record<string,string>>,parents=pack.parents as Record<string,string>;
const key=(text:string)=>(pack.aliases as Record<string,string>)[ruleTag(text)]||ruleTag(text);
export function prioritizeSourceGarments<T extends Contribution>(rows:T[],rules:RuleBox[]=[]):{rows:T[];errors:string[]}{
    if(rows.some(row=>/\bBREAK\b/.test(row.text)))return {rows,errors:[]};
    const fixed=(text:string,depth=0):string[]=>depth>32?[]:splitTop(text,',').flatMap(raw=>{
        const part=raw.trim(),wrapped=promptWrapper(part);
        return wrapped?fixed(wrapped[0],depth+1):part&&!part.startsWith('{')?[key(part)]:[];
    });
    const source=new Set(rows.filter(row=>row.source).flatMap(row=>fixed(row.text)));
    const ancestors=(value:string)=>{const result=new Set([value]);while(parents[value]){value=parents[value];result.add(value);}return result;};
    const related=(a:string,b:string)=>ancestors(a).has(b)||ancestors(b).has(a);
    const anchors:Record<string,Set<string>>={};
    for(const tag of source)for(const [slot,value] of Object.entries(tags[tag]||{}))(anchors[slot]??=new Set()).add(value);
    for(const [slot,values] of Object.entries(anchors))if(values.has('multicolored')||[...values].some(a=>[...values].some(b=>!related(a,b))))delete anchors[slot];
    if(!Object.keys(anchors).length)return {rows,errors:[]};
    let layered=false,multiple=false;
    for(const box of activeRuleBoxes(rules)){
        for(const choice of box.definition.choices)if(choice.id==='bottoms'&&activeRuleChannels(box,rules).includes(choiceChannel(box.definition,choice))){
            const value=box.preferences.bottoms??choice.default;layered ||= value==='layered'||/^(skirt|dress)-/.test(value);multiple ||= value==='multiple';
        }
        if(box.definition.family==='clothing-layers'&&['skirt-pants','skirt-track','skirt-leggings'].includes(box.preferences.layering))layered=true;
    }
    const permitted=(slot:string,a:string,b:string)=>{
        if(related(a,b)||b==='multicolored')return true;
        if(slot!=='lower')return false;if(multiple)return true;
        const over=(a:string,b:string)=>['skirt','dress'].includes(a)&&(['pants','jeans','track_pants','cargo_pants'].includes(b)||a==='skirt'&&b==='leggings');
        return layered&&(over(a,b)||over(b,a));
    };
    const errors:string[]=[];
    const stripKnown=(text:string,depth=0):string=>depth>32?text:splitTop(text,',').flatMap(raw=>{
        const part=raw.trim(),wrapped=promptWrapper(part);
        if(wrapped){const inner=stripKnown(wrapped[0],depth+1);return inner?[part[0]+inner+wrapped[1]+part.slice(-1)]:[];}
        return source.has(key(part))?[]:[part];
    }).filter(Boolean).join(', ');
    const rewrite=(text:string,depth=0):string=>{
        if(depth>32)throw new Error('Source garment priority nesting exceeds 32 levels.');
        return splitTop(text,',').flatMap(raw=>{
            const part=raw.trim(),wrapped=promptWrapper(part);
            if(wrapped){const inner=rewrite(wrapped[0],depth+1);return inner?[part[0]+inner+wrapped[1]+part.slice(-1)]:[];}
            if(!part.startsWith('{')||!part.endsWith('}'))return part?[part]:[];
            const options=splitTop(part.slice(1,-1),'|'),optional=options.some(option=>!option.trim());
            const valid=options.flatMap(option=>{
                const before=errors.length,value=rewrite(option,depth+1);
                if(errors.length>before){errors.splice(before);return [];}
                const traits=fixed(value).flatMap(tag=>Object.entries(tags[tag]||{}));
                if(traits.some(([slot,trait])=>anchors[slot]&&[...anchors[slot]].some(anchor=>!permitted(slot,anchor,trait))))return [];
                const matches=traits.some(([slot,trait])=>['base','outer','lower'].includes(slot)&&anchors[slot]&&[...anchors[slot]].some(anchor=>related(anchor,trait)));
                return [{text:stripKnown(value),matches}];
            });
            const chosen=(!optional&&valid.some(row=>row.matches)?valid.filter(row=>row.matches):valid).map(row=>row.text);
            if(!chosen.length){if(!optional)errors.push('No compatible alternative remains for the source outfit: '+part);return [];}
            return chosen.some(Boolean)?[chosen.length===1?chosen[0]:'{'+chosen.join('|')+'}']:[];
        }).join(', ');
    };
    return {rows:rows.map(row=>row.source?row:{...row,text:rewrite(row.text)}),errors:[...new Set(errors)]};
}
