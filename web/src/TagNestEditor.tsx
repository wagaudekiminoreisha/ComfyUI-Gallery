import {useState,type CSSProperties} from 'react';
const control:CSSProperties={color:'inherit',background:'var(--comfy-input-bg,#292929)',border:'1px solid var(--border-color,#555)',borderRadius:4,padding:'4px 7px',font:'inherit',cursor:'pointer'};
import {PopupMenu} from './PopupMenu';
import {nestEntries,nestTags} from './TagNesting';
import {ADD_MODES,type AddMode,type Chip} from './PromptBoxes';

/** The owner supplies exactly one source image or top-level tag box. */
export function TagNestEditor({chips,onChange}:{chips:Chip[];onChange:(chips:Chip[],byRoot:Map<string,Chip[]>)=>void}){
    const [open,setOpen]=useState(false),[picked,setPicked]=useState<string[]>([]),[menu,setMenu]=useState<{x:number;y:number}>();
    const rows=open?nestEntries(chips):[];
    const toggle=(path:string)=>setPicked(old=>old.includes(path)?old.filter(value=>value!==path):[...old,path]);
    const apply=(mode:AddMode)=>{const byRoot=new Map<string,Chip[]>();onChange(nestTags(chips,picked,mode,byRoot),byRoot);setPicked([]);setMenu(undefined);};
    const actions=<>{ADD_MODES.map(mode=><button type="button" key={mode.value} role="menuitem" disabled={!picked.length} onClick={()=>apply(mode.value)}>{mode.name}</button>)}</>;
    return <div style={{maxWidth:'100%',minWidth:0}}>
        <button style={control} type="button" aria-expanded={open} onClick={()=>{setOpen(!open);setPicked([]);}}>Group tags…</button>
        {open&&<div aria-label="Select tags to nest" style={{border:'1px solid var(--border-color,#555)',borderRadius:6,padding:6,maxHeight:320,overflow:'auto'}}>
            <small>Select tags or whole nests within this box. Grouping moves them out of their old branches; the new group determines activation.</small>
            <div style={{display:'flex',flexWrap:'wrap',gap:6,margin:'6px 0'}}><span>{picked.length} selected</span><button style={control} type="button" onClick={()=>setPicked([])}>Clear</button><select style={{...control,maxWidth:'100%'}} aria-label="Group selected tags as" value="" disabled={!picked.length} onChange={event=>apply(event.target.value as AddMode)}><option value="" disabled>Group selected as…</option>{ADD_MODES.map(mode=><option key={mode.value} value={mode.value}>{mode.name}</option>)}</select></div>
            {rows.map(row=><button type="button" key={row.path} aria-label={'Pick tag '+row.text} aria-pressed={picked.includes(row.path)} disabled={!row.chip.enabled} onClick={()=>toggle(row.path)} onContextMenu={event=>{event.preventDefault();event.stopPropagation();if(!picked.includes(row.path))setPicked([row.path]);setMenu({x:event.clientX,y:event.clientY});}} style={{...control,display:'block',maxWidth:'100%',textAlign:'left',whiteSpace:'normal',overflowWrap:'anywhere',margin:'3px 0',paddingLeft:8+Math.min(row.depth,8)*12,border:picked.includes(row.path)?'2px solid var(--p-primary-color,#70a9ff)':'1px solid var(--border-color,#555)'}}>{picked.includes(row.path)?'☑':'☐'} {row.text}</button>)}
            {menu&&<PopupMenu x={menu.x} y={menu.y} onClose={()=>setMenu(undefined)}>{actions}</PopupMenu>}
        </div>}
    </div>;
}
