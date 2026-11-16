import type {ReactNode} from 'react';
import {compileChip,parsePrompt,type Chip} from './PromptBoxes';
import type {sharedEditorPrompt} from './SharedPrompt';

export function SharedPromptCard({merged,onEdit,renderChip,compact,onMergedView}:{merged:ReturnType<typeof sharedEditorPrompt>;onEdit:(id:string,syntax:string)=>void;renderChip:(chip:Chip,onSelect:()=>void)=>ReactNode;compact:boolean;onMergedView:()=>void}){
    return <section aria-label="Merged prompt tags" style={{border:'1px solid #5489bd',borderRadius:8,padding:8,minWidth:0,overflowWrap:'anywhere',display:'flex',flexDirection:'column',gap:8}}>
        <strong>Shared tags · {merged.references.length} matching expression{merged.references.length===1?'':'s'} merged</strong>
        {compact?<button type="button" onClick={onMergedView} style={{alignSelf:'flex-start',padding:'4px 8px',border:'1px solid #8886',borderRadius:4,background:'transparent',color:'inherit',cursor:'pointer'}}>Show merged tags</button>:<small>Source cards own matching tags. Matching optional groups share one roll. Click a chip to edit its contribution.</small>}
        {!compact&&merged.rows.map((row,index)=>{
            const incoming=merged.references.filter(ref=>ref.to===index),outgoing=merged.references.filter(ref=>ref.from===index);
            if(!row.text.trim())return outgoing.length?<small key={row.id} title={outgoing.map(ref=>ref.text).join(', ')}>{row.label} → shared with {[...new Set(outgoing.map(ref=>merged.rows[ref.to].label))].join(', ')}</small>:null;
            return <div key={row.id} data-shared-owner={row.id}>
                <small style={{display:'block',marginBottom:4}}>{row.source?'Source · ':''}{row.label}{incoming.length>0&&<span title={[...new Set(incoming.map(ref=>merged.rows[ref.from].label))].join(', ')}> · {incoming.length} shared</span>}</small>
                <div style={{display:'flex',flexWrap:'wrap',alignItems:'center',gap:6}}>{parsePrompt(row.text).map((chip,at)=><span key={at}>{renderChip(chip,()=>onEdit(row.id,compileChip(chip)))}</span>)}</div>
                {!!outgoing.length&&<small>Also shares tags with {[...new Set(outgoing.map(ref=>merged.rows[ref.to].label))].join(', ')}</small>}
            </div>;
        })}
    </section>;
}
