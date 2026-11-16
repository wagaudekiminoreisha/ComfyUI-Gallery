import {parsePrompt,compileChip,groupChips,type Chip,type AddMode} from './PromptBoxes';
export type NestEntry={path:string;text:string;depth:number;chip:Chip};
/** Paths identify occurrences, including identical tags in different branches. */
export function nestEntries(chips:Chip[],prefix='',depth=0):NestEntry[]{
    if(depth>32)return [];
    return chips.flatMap((chip,index)=>{
        const path=prefix+index;
        return [{path,text:compileChip({...chip,enabled:true}),depth,chip},...(chip.kind==='or'&&chip.enabled?chip.options.flatMap((option,at)=>nestEntries(parsePrompt(option),path+'/'+at+'/',depth+1)):[])];
    });
}
/** Move selected occurrences within one owning box. Never flatten unselected branches. */
export function nestTags(chips:Chip[],paths:string[],mode:AddMode,byRoot?:Map<string,Chip[]>):Chip[]{
    const entries=nestEntries(chips),known=new Set(entries.filter(row=>row.chip.enabled).map(row=>row.path));
    const selected=new Set(paths.filter(path=>known.has(path)).filter(path=>!paths.some(parent=>path.startsWith(parent+'/'))));
    const chosen=entries.filter(row=>selected.has(row.path));
    if(!chosen.length)return chips;
    const first=Math.min(...chosen.map(row=>Number(row.path.split('/')[0])));
    const made=groupChips(mode,chosen.map(row=>row.text));
    const rewrite=(items:Chip[],prefix=''):Chip[]=>items.flatMap((chip,index)=>{
        const done=(values:Chip[])=>{if(!prefix)byRoot?.set(chip.id,values);return values;};
        const path=prefix+index;
        const before=!prefix&&index===first?made:[];
        if(selected.has(path))return done(before);
        if(chip.kind!=='or'||![...selected].some(selectedPath=>selectedPath.startsWith(path+'/')))return done([...before,chip]);
        const options=chip.options.map((option,at)=>rewrite(parsePrompt(option),path+'/'+at+'/').map(compileChip).join(', ')).filter(Boolean);
        return done([...before,...(options.length?[{...chip,options}]:[])]);
    });
    return rewrite(chips);
}
