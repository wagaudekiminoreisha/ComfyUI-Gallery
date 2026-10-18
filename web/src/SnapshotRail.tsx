import {useEffect,useState} from 'react';
import {openImageSearch} from './TagSearchPanel';
import {Button} from 'antd';
import {loadPrefixes,type PrefixSnapshot} from './PrefixLibrary';
export function SnapshotRail({prefixId,selected,onSelect}:{prefixId?:string;selected?:string;onSelect:(snapshot:PrefixSnapshot|null)=>void}){
 const [snapshots,setSnapshots]=useState<PrefixSnapshot[]>([]),[expanded,setExpanded]=useState(false);
 useEffect(()=>{let live=true;const load=()=>{void loadPrefixes().then(data=>{if(live)setSnapshots(Object.values(data.snapshots||{}).filter(row=>row.prefix_id===prefixId));}).catch(()=>{});};load();window.addEventListener('gallery-prefix-snapshots-changed',load);return()=>{live=false;window.removeEventListener('gallery-prefix-snapshots-changed',load);};},[prefixId]);
 if(!prefixId)return null;
 return <aside className={'cg-snapshot-rail '+(expanded?'expanded':'')} aria-label="Prefix snapshots">
  <Button size="small" aria-label="Expand prefix snapshots" onClick={()=>setExpanded(!expanded)}>{expanded?'◀':'▶'} {snapshots.length} snapshots</Button>
  {selected&&<Button size="small" onClick={()=>openImageSearch({chips:[{kind:'snapshot',id:selected,name:'Variant'}]})}>Find snapshot images</Button>}{expanded&&<><Button type={!selected?'primary':'default'} onClick={()=>onSelect(null)}>Parent prefix</Button>{snapshots.map((row,index)=><Button key={row.id} type={row.id===selected?'primary':'default'} onClick={()=>onSelect(row)}>{row.name||'Snapshot '+(index+1)} · {Object.keys(row.members).length} image links</Button>)}</>}
 </aside>;
}
