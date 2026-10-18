import { editChips, moveChipTo, newId,parsePrompt,compileChip, type BoxState, type Chip } from './PromptBoxes';

export const PROMPT_CHIP_TYPE = 'application/x-gallery-prompt-chip';

/** Move within one editor; copy between independent editors and from image/source prompts. */
export function dropPromptChip(state: BoxState, chip: Chip, boxId: string, target?: { chipId: string; after: boolean }): BoxState {
    if (state.boxes.some(box => box.kind === 'group' && box.chips.some(item => item === chip))) return moveChipTo(state, chip.id, boxId, target);
    const member=(chip as Chip & {memberOf?:{chipId:string;text:string}}).memberOf;
    let nextState=state;
    if(member)nextState={...state,boxes:state.boxes.map(box=>box.kind!=='group'?box:{...box,chips:box.chips.flatMap(parent=>{if(parent.id!==member.chipId||parent.kind!=='or')return [parent];const options=parent.options.map(option=>parsePrompt(option).filter(item=>compileChip(item)!==member.text).map(compileChip).join(', ')).filter(Boolean);return options.length?[{...parent,options}]:[];})})};
    const {memberOf,...transfer}=chip as Chip & {memberOf?:unknown};
    return editChips(nextState, boxId, chips => {
        const next = [...chips], at = target ? next.findIndex(item => item.id === target.chipId) : -1;
        next.splice(at < 0 ? next.length : at + (target?.after ? 1 : 0), 0, { ...transfer, id: newId() } as Chip);
        return next;
    });
}
