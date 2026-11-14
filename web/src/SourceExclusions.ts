import {filterSource,sourceKey,splitTop,type BoxState,type SourceBox} from './PromptBoxes';
export type SourceSegment={key:string;name:string;text:string};
export function exclusionsFor(box:SourceBox,segment?:SourceSegment):string[]{return segment?box.excludedBySource?.[segment.key]||[]:box.excluded||[];}
export function replacementsFor(box:SourceBox,segment?:SourceSegment):Record<string,string>{return segment?box.replacementsBySource?.[segment.key]||{}:box.replacements||{};}
export function editSourceText(text:string,excluded:string[],replacements:Record<string,string>={}):string{
 return splitTop(filterSource(text,excluded),',').map(part=>Object.prototype.hasOwnProperty.call(replacements,sourceKey(part))?replacements[sourceKey(part)]:part).filter(part=>part.trim()).join(',');
}
/** Bind the old shared list once to the image visible when the workflow is upgraded. */
export function bindLegacySourceExclusions(state:BoxState,segments?:SourceSegment[]):BoxState{
 if(!segments?.length||!state.boxes.some(box=>box.kind==='source'&&box.excluded?.length))return state;
 return {...state,boxes:state.boxes.map(box=>box.kind==='source'&&box.excluded?.length?{...box,excluded:undefined,excludedBySource:{...box.excludedBySource,[segments[0].key]:[...new Set([...(box.excludedBySource?.[segments[0].key]||[]),...box.excluded])]}}:box)};
}
export function sourceExclusionPayload(box:SourceBox|undefined,segments?:SourceSegment[]){
 if(!box?.enabled)return {};
 if(!segments?.length)return Object.keys(box.replacements||{}).length?{replacements:box.replacements}:{};
 const active=segments.map(segment=>{const replacements=replacementsFor(box,segment);return {...segment,excluded:exclusionsFor(box,segment),...(Object.keys(replacements).length?{replacements}:{})};});
 return active.some(segment=>segment.excluded.length||segment.replacements)?{segments:active}:{};
}
export function filteredSourceText(box:SourceBox|undefined,segments?:SourceSegment[],fallback?:string){
 return box&&segments?.length?segments.map(segment=>editSourceText(segment.text,exclusionsFor(box,segment),replacementsFor(box,segment)).trim()).filter(Boolean).join(', '):box&&fallback?editSourceText(fallback,exclusionsFor(box),replacementsFor(box)):fallback;
}
