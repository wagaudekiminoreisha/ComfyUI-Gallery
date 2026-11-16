import {imageOrigin,type ImageSourceImage} from './ImageSourceGeometry';
import {sourcePrefixRefs} from './SourcePrefixes';
export type SourceSelectionGroup={id:string;name:string;images:string[];kind:'arrival'|'manual'};
export type SourceGrouping='arrivals'|'prefix'|'manual'|'flat';
export function recordSourceGroup(previous:SourceSelectionGroup[]=[],images:ImageSourceImage[],name?:string,kind:'arrival'|'manual'='arrival'):SourceSelectionGroup[]{
    const names=[...new Set(images.map(image=>image.input_name))];
    if(!names.length||kind==='arrival'&&names.length<2)return previous;
    const signature=JSON.stringify([...names].sort());
    const old=previous.find(group=>group.kind===kind&&(name?group.name===name:JSON.stringify([...group.images].sort())===signature));
    const group={id:old?.id||'group-'+(globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2)),name:(name||'Batch '+(previous.filter(group=>group.kind==='arrival').length+1)).slice(0,80),images:names,kind};
    return [...previous.filter(group=>group!==old),group].slice(-64);
}
export function sourceSelectionGroups(images:ImageSourceImage[],saved:SourceSelectionGroup[]=[],mode:SourceGrouping='arrivals'):{id:string;name:string;images:ImageSourceImage[]}[]{
    if(mode==='flat')return [{id:'all',name:'All images',images}];
    const result:{id:string;name:string;images:ImageSourceImage[]}[]=[],used=new Set<string>();
    if(mode!=='prefix')for(const group of saved.filter(group=>group.kind===(mode==='manual'?'manual':'arrival'))){
        const members=images.filter(image=>group.images.includes(image.input_name));
        if(members.length){result.push({id:group.id,name:group.name,images:members});members.forEach(image=>used.add(image.input_name));}
    }
    const automatic=new Map<string,{id:string;name:string;images:ImageSourceImage[]}>();
    for(const image of images.filter(image=>!used.has(image.input_name))){
        const refs=sourcePrefixRefs(image.metadata),lineage=Array.isArray(image.metadata?.gallery_associations)?image.metadata.gallery_associations:[];
        const signature=refs.map(ref=>ref.id+':'+(ref.snapshot_id||'')).sort().join('|')||lineage.map((row:any)=>typeof row==='string'?row:row.prefix_id||row.id||'').filter(Boolean).sort().join('|');
        const id=signature?'prefix:'+signature:'origin:'+imageOrigin(image);
        const name=refs.length?refs.map(ref=>ref.name||ref.id).join(' + '):signature?'Shared provenance':imageOrigin(image)==='gallery'?'Generated · unpaired':imageOrigin(image)==='hydrus'?'Hydrus · unpaired':'Imported · unpaired';
        if(!automatic.has(id))automatic.set(id,{id,name,images:[]});automatic.get(id)!.images.push(image);
    }
    return [...result,...automatic.values()];
}
