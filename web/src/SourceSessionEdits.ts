import {sourceInput,type BoxState,type SourceBox} from './PromptBoxes';
export const sourceEdits=(box:SourceBox)=>({excluded:box.excluded,excludedBySource:box.excludedBySource,replacements:box.replacements,replacementsBySource:box.replacementsBySource});
export function resetSourceSessionEdits(state:BoxState,previous:string|undefined,current:string,inputs:string[]):{state:BoxState;backup:SourceBox[]}{
    if(!previous||previous===current)return {state,backup:[]};
    const backup=state.boxes.filter((box):box is SourceBox=>box.kind==='source'&&inputs.includes(sourceInput(box)));
    return {state:{...state,boxes:state.boxes.map(box=>backup.includes(box as SourceBox)?{...box,excluded:undefined,excludedBySource:undefined,replacements:undefined,replacementsBySource:undefined}:box)},backup};
}
