import {prioritizeSourceGarments} from './SourceGarmentPriority';
import type {RuleBox} from './RuleEngine';
import {compileBoxes,replaceSourceMarkers,filterSource,sourceInput,type BoxState} from './PromptBoxes';
import {filteredSourceText} from './SourceExclusions';
import type {SourceInfo} from './PromptBoxEditor';
import {mergePromptContributions} from './PromptDeduplication';

export function sharedEditorPrompt(state:BoxState,sources:Record<string,SourceInfo>){
    return mergePromptContributions(state.boxes.filter(box=>box.enabled).map(box=>{
        const info=box.kind==='source'?sources[sourceInput(box)]:undefined;
        return {id:box.id,source:box.kind==='source',label:box.kind==='source'?(box.name||sourceInput(box)):box.name,
            text:box.kind==='source'?(info?.connected?filteredSourceText(box,info.segments,info.text,info.merge)||'':''):compileBoxes({version:1,boxes:[box]})};
    }));
}
/** Preserve source ownership even when a manual tag occurs earlier in the layout. */
export function composeSharedPreview(compiled:string,sources:Record<string,string>,rules:RuleBox[]=[],issues:string[]=[]):string{
    const injected:{text:string;source:boolean}[]=[];
    const marked=replaceSourceMarkers(compiled,(excluded,input)=>{
        const index=injected.push({text:filterSource(sources[input]||'',excluded),source:true})-1;
        return '\0'+index+'\0';
    });
    const rows=marked.split(/\0(\d+)\0/).map((part,index)=>index%2?injected[Number(part)]:{text:part.trim().replace(/^,+|,+$/g,'').trim(),source:false});
    const priority=prioritizeSourceGarments(rows,rules);issues.push(...priority.errors);
    return mergePromptContributions(priority.rows).rows.map(row=>row.text.trim()).filter(Boolean).join(', ').replace(/(?:\s*,\s*){2,}/g,', ').trim().replace(/^,+|,+$/g,'').trim();
}
