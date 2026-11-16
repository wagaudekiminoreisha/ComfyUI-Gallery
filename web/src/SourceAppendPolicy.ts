import type {ImageSourceImage} from './ImageSourceGeometry';
import {ancestry,imageSnapshotIds} from './PrefixLineage';
import {sourcePrefixRefs,mergeSourcePrefixTerms,type SourcePrefix} from './SourcePrefixes';

const hash=(value:unknown)=>typeof value==='string'&&/^[a-f0-9]{64}$/i.test(value)?value.toLowerCase():undefined;
export function sourceContentHash(image:ImageSourceImage):string|undefined{
    return hash(/^(?:gallery_sources|hydrus)\/([a-f0-9]{64})(?:\.[^/]+)?$/i.exec(image.input_name.replace(/\\/g,'/'))?.[1])||hash(image.metadata?.gallery_content_hash)||hash(image.metadata?.hydrus?.hash);
}
export function sameSourceImage(a:ImageSourceImage,b:ImageSourceImage):boolean{
    const ah=sourceContentHash(a),bh=sourceContentHash(b);
    // Content identity wins over a reused filename or gallery URL.
    if(ah&&bh)return ah===bh;
    if(a.input_name&&b.input_name&&a.input_name.replace(/\\/g,'/')===b.input_name.replace(/\\/g,'/'))return true;
    const am=a.metadata,bm=b.metadata;
    return !!am?.gallery_url&&am.gallery_url===bm?.gallery_url&&
        (!am.gallery_root||!bm?.gallery_root||am.gallery_root===bm.gallery_root)&&
        (!am.gallery_revision||!bm?.gallery_revision||am.gallery_revision===bm.gallery_revision);
}
export function partitionSourceAppend<T extends ImageSourceImage>(existing:ImageSourceImage[],incoming:T[]){
    const accepted:T[]=[],duplicates:{image:T;existing:ImageSourceImage}[]=[];
    for(const image of incoming){
        const match=[...existing,...accepted].find(other=>sameSourceImage(image,other));
        if(match)duplicates.push({image,existing:match});else accepted.push(image);
    }
    return {accepted,duplicates};
}
export function appendProvenance(metadata:Record<string,any>={}){
    const cached=metadata.gallery_append_provenance;
    const hashes=new Set<string>(Array.isArray(cached?.hashes)?cached.hashes.filter((item:unknown)=>!!hash(item)).map((item:string)=>item.toLowerCase()):ancestry(metadata).hashes);
    const own=hash(metadata.gallery_content_hash);if(own)hashes.add(own);
    const snapshots=new Set<string>((Array.isArray(cached?.snapshots)?cached.snapshots:undefined)||imageSnapshotIds({version:2,tags:[],prefixes:[]},[],metadata));
    return {hashes:[...hashes],snapshots:[...snapshots]};
}
export type AppendConfiguration={prefixes:SourcePrefix[];associatedIds:string[];metadata:Record<string,any>;positive:string[];negative:string[];usePositive:boolean;useNegative:boolean};
function commonProvenance(a:AppendConfiguration,b:AppendConfiguration){
    const ap=appendProvenance(a.metadata),bp=appendProvenance(b.metadata);
    return ap.hashes.some(hash=>bp.hashes.includes(hash))||ap.snapshots.some(id=>bp.snapshots.includes(id));
}
/** Only shared associations are managed; unrelated selections and per-image edits survive. */
export function reusablePrefixIds(from:AppendConfiguration,to:AppendConfiguration):Set<string>{
    const sameLineage=commonProvenance(from,to),available=new Set([...to.associatedIds,...to.prefixes.map(ref=>ref.id)]);
    return new Set([...from.associatedIds,...from.prefixes.map(ref=>ref.id)].filter(id=>sameLineage||available.has(id)));
}
export function reuseAppendConfiguration<T extends AppendConfiguration>(from:AppendConfiguration,to:T):T{
    const managed=reusablePrefixIds(from,to);
    if(!managed.size)return to;
    const remaining=to.prefixes.filter(ref=>!managed.has(ref.id));
    const copied=from.prefixes.filter(ref=>managed.has(ref.id)).map(ref=>({...structuredClone(ref),positive_enabled:from.usePositive&&ref.positive_enabled!==false,negative_enabled:from.useNegative&&ref.negative_enabled!==false}));
    const prefixes=[...remaining,...copied];
    const positive=mergeSourcePrefixTerms(to.usePositive?to.positive:[],to.prefixes,prefixes,'positive');
    const negative=mergeSourcePrefixTerms(to.useNegative?to.negative:[],to.prefixes,prefixes,'negative');
    return {...to,prefixes,associatedIds:[...new Set([...to.associatedIds,...copied.map(ref=>ref.id)])],
        positive:!to.usePositive&&!positive.length?to.positive:positive,
        negative:!to.useNegative&&!negative.length?to.negative:negative,
        usePositive:remaining.length?!!positive.length:from.usePositive,
        useNegative:remaining.length?!!negative.length:from.useNegative};
}
export function configurationFromSource(image:ImageSourceImage):AppendConfiguration{
    const prefixes=sourcePrefixRefs(image.metadata);
    return {prefixes,associatedIds:prefixes.map(ref=>ref.id),metadata:image.metadata||{},
        positive:prefixes.flatMap(ref=>ref.positive||[]),negative:prefixes.flatMap(ref=>ref.negative||[]),
        usePositive:prefixes.some(ref=>ref.positive_enabled!==false),useNegative:prefixes.some(ref=>ref.negative_enabled!==false)};
}
