import {sourceBox,sourceInput,type BoxState,type SourceBox} from './PromptBoxes';
export type DisconnectedSources=Record<string,{box:SourceBox;index:number}>;
/** Source cards reflect wires. Cache disconnected edits for a later reconnection. */
export function reconcileSourceConnections(state:BoxState,inputs:string[],cache:DisconnectedSources={}):{state:BoxState;cache:DisconnectedSources}{
    const saved={...cache};let changed=false;
    const boxes=state.boxes.filter((box,index)=>{
        if(box.kind!=='source'||inputs.includes(sourceInput(box)))return true;
        saved[sourceInput(box)]={box,index};changed=true;return false;
    });
    for(const input of inputs){
        if(boxes.some(box=>box.kind==='source'&&sourceInput(box)===input))continue;
        const old=saved[input];boxes.splice(Math.min(old?.index??boxes.length,boxes.length),0,old?.box||sourceBox(input));delete saved[input];changed=true;
    }
    return {state:changed?{...state,boxes}:state,cache:saved};
}
