import {filterSource,type BoxState,type SourceBox} from './PromptBoxes';
export type SourceSegment={key:string;name:string;text:string};
export function exclusionsFor(box:SourceBox,segment?:SourceSegment):string[]{return segment?box.excludedBySource?.[segment.key]||[]:box.excluded||[];}
/** Bind the old shared list once to the image visible when the workflow is upgraded. */
export function bindLegacySourceExclusions(state:BoxState,segments?:SourceSegment[]):BoxState{
 if(!segments?.length||!state.boxes.some(box=>box.kind==='source'&&box.excluded?.length))return state;
 return {...state,boxes:state.boxes.map(box=>box.kind==='source'&&box.excluded?.length?{...box,excluded:undefined,excludedBySource:{...box.excludedBySource,[segments[0].key]:[...new Set([...(box.excludedBySource?.[segments[0].key]||[]),...box.excluded])]}}:box)};
}
export function sourceExclusionPayload(box:SourceBox|undefined,segments?:SourceSegment[]){
 if(!box?.enabled||!segments?.length)return {};
 const active=segments.map(segment=>({...segment,excluded:exclusionsFor(box,segment)}));
 return active.some(segment=>segment.excluded.length)?{segments:active}:{};
}
export function filteredSourceText(box:SourceBox|undefined,segments?:SourceSegment[],fallback?:string){
 return box&&segments?.length?segments.map(segment=>filterSource(segment.text,exclusionsFor(box,segment)).trim()).filter(Boolean).join(', '):fallback;
}
