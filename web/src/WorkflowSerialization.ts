/** Lossless workflow-only storage. Live widgets and API prompts stay expanded. */
import {gzipSync,gunzipSync,strToU8,strFromU8} from 'fflate';
import {ENCODER_WIDGETS} from './EncoderFields';

const KEY='gallery_workflow_archive';
const MAX_BYTES=64*1024*1024;
type Archive={version:1;codec:'gzip-base64';bytes:number;data:string};
type Payload={properties:Record<string,any>;metadata?:Record<string,any>[];sourceMetadata?:[number,number][]};
const crcTable=Uint32Array.from({length:256},(_,index)=>{let value=index;for(let bit=0;bit<8;bit++)value=value&1?0xedb88320^(value>>>1):value>>>1;return value>>>0;});
const crc32=(bytes:Uint8Array)=>{let value=0xffffffff;for(const byte of bytes)value=crcTable[(value^byte)&255]^(value>>>8);return (value^0xffffffff)>>>0;};
const galleryNode=(info:any)=>['GalleryImageSource','GalleryPromptEncode'].includes(info?.type||info?.comfyClass);
const galleryProperty=(name:string)=>name==='prompt_boxes'||name.startsWith('gallery_');
const essentialMetadata=(value:Record<string,any>)=>Object.fromEntries(Object.entries(value).filter(([key])=>
    ['gallery_prefix','gallery_prefixes','gallery_origin','gallery_url','gallery_root','gallery_revision','gallery_content_hash'].includes(key)));
function base64(bytes:Uint8Array):string{
    let value='';for(let at=0;at<bytes.length;at+=16384)value+=String.fromCharCode(...bytes.subarray(at,at+16384));
    return btoa(value);
}
function decode(archive:Archive):Payload{
    if(archive.version!==1||archive.codec!=='gzip-base64'||!Number.isInteger(archive.bytes)||archive.bytes<0||archive.bytes>MAX_BYTES||typeof archive.data!=='string'||archive.data.length>MAX_BYTES*2)throw new Error('Unsupported or oversized Gallery workflow archive.');
    try{
        const data=Uint8Array.from(atob(archive.data),char=>char.charCodeAt(0));
        if(data.length<18)throw new Error('Truncated archive');
        const size=new DataView(data.buffer,data.byteOffset+data.byteLength-4,4).getUint32(0,true);
        if(size!==archive.bytes)throw new Error('Archive size mismatch');
        const raw=gunzipSync(data,{out:new Uint8Array(size)});
        if(crc32(raw)!==new DataView(data.buffer,data.byteOffset+data.byteLength-8,4).getUint32(0,true))throw new Error('Archive checksum mismatch');
        const payload=JSON.parse(strFromU8(raw));
        if(!payload||!payload.properties||typeof payload.properties!=='object'||Array.isArray(payload.properties))throw new Error('Invalid archive payload');
        return payload;
    }catch(error){throw new Error('Cannot restore Gallery workflow state. Keep the original workflow and reload with a compatible Gallery version.'+' '+(error instanceof Error?error.message:String(error)));}
}
/** Return an expanded copy; never mutate an export or a live graph's objects. */
export function restoreWorkflowNode(info:any):any{
    if(!galleryNode(info)||!info.properties?.[KEY])return info;
    const payload=decode(info.properties[KEY]);
    const properties={...info.properties,...payload.properties};delete properties[KEY];
    const widgets=Array.isArray(info.widgets_values)?[...info.widgets_values]:info.widgets_values;
    const metadata=(index:number)=>{
        if(!Number.isInteger(index)||index<0||!payload.metadata?.[index])throw new Error('Invalid Gallery workflow metadata reference.');
        return structuredClone(payload.metadata[index]);
    };
    if(Array.isArray(payload.sourceMetadata)){
        const manifest=JSON.parse(widgets[0]);
        for(const [image,index] of payload.sourceMetadata){
            if(!Number.isInteger(image)||!manifest.images?.[image])throw new Error('Invalid Gallery source image reference.');
            manifest.images[image].metadata=metadata(index);
        }
        widgets[0]=JSON.stringify(manifest);
    }
    if(Array.isArray(properties.gallery_source_history))properties.gallery_source_history=properties.gallery_source_history.map((image:any)=>{
        const ref=image?.metadata?.__gallery_archive_metadata;
        return Number.isInteger(ref)?{...image,metadata:metadata(ref)}:image;
    });
    const named=properties.gallery_encoder_widgets;
    if(named?.version===2){
        const values:Record<string,any>={};
        for(const [name,index] of Object.entries(named.fields||{})){
            if(!ENCODER_WIDGETS.includes(name as any)||!Number.isInteger(index)||Number(index)<0||Number(index)>=widgets.length)throw new Error('Invalid Gallery encoder widget reference.');
            values[name]=widgets[Number(index)];
        }
        properties.gallery_encoder_widgets={version:1,values};
    }
    return {...info,properties,widgets_values:widgets};
}
/** Compact only owned Gallery data. Standard node fields, links and widget positions stay intact. */
export function compactWorkflowNode(info:any,cache?:{json?:string;archive?:Archive}):any{
    if(!galleryNode(info)||info.properties?.[KEY])return info;
    const properties={...info.properties};
    const payload:Payload={properties:{}};
    for(const [name,value] of Object.entries(properties))if(galleryProperty(name)){
        payload.properties[name]=value;delete properties[name];
    }
    const widgets=Array.isArray(info.widgets_values)?[...info.widgets_values]:info.widgets_values;
    // Named widget values are exact references to the canonical positional values.
    const named=payload.properties.gallery_encoder_widgets;
    if((info.type||info.comfyClass)==='GalleryPromptEncode'&&named?.version===1&&Array.isArray(widgets)){
        const fields:Record<string,number>={};let exact=true;
        for(const [name,value] of Object.entries(named.values||{})){
            const index=ENCODER_WIDGETS.indexOf(name as any);
            if(index<0||JSON.stringify(widgets[index])!==JSON.stringify(value)){exact=false;break;}
            fields[name]=index;
        }
        if(exact){properties.gallery_encoder_widgets={version:2,fields};delete payload.properties.gallery_encoder_widgets;}
    }
    if((info.type||info.comfyClass)==='GalleryImageSource'&&typeof widgets?.[0]==='string'){
        const pool:Record<string,any>[]=[],ids=new Map<string,number>();
        const intern=(value:Record<string,any>)=>{
            const json=JSON.stringify(value);let index=ids.get(json);
            if(index===undefined){index=pool.length;pool.push(value);ids.set(json,index);}
            return index;
        };
        try{
            const manifest=JSON.parse(widgets[0]);
            const refs:[number,number][]=[];
            const images=manifest.images.map((image:any,index:number)=>{
                if(!image.metadata||typeof image.metadata!=='object')return image;
                refs.push([index,intern(image.metadata)]);
                return {...image,metadata:essentialMetadata(image.metadata)};
            });
            widgets[0]=JSON.stringify({...manifest,images});
            payload.sourceMetadata=refs;
        }catch{return info;} // Preserve malformed legacy manifests for the existing editor's error handling.
        if(Array.isArray(payload.properties.gallery_source_history))payload.properties.gallery_source_history=payload.properties.gallery_source_history.map((image:any)=>
            image?.metadata&&typeof image.metadata==='object'?{...image,metadata:{__gallery_archive_metadata:intern(image.metadata)}}:image);
        payload.metadata=pool;
    }
    const json=JSON.stringify(payload),raw=strToU8(json);
    if(raw.length<2048||raw.length>MAX_BYTES)return info;
    let archive=cache?.json===json?cache.archive:undefined;
    if(!archive){archive={version:1,codec:'gzip-base64',bytes:raw.length,data:base64(gzipSync(raw,{level:6,mtime:0}))};if(cache){cache.json=json;cache.archive=archive;}}
    const packed={...info,properties:{...properties,[KEY]:archive},widgets_values:widgets};
    return JSON.stringify(packed).length+256<JSON.stringify(info).length?packed:info;
}
/** Expand before LiteGraph assigns widgets; existing plain exports are a no-op. */
export function restoreWorkflow(data:any):any{
    if(!Array.isArray(data?.nodes))return data;
    const nodes=data.nodes.map(restoreWorkflowNode);
    data.nodes=nodes;
    return data;
}
export function registerWorkflowConstructor(nodeType:any){
    const proto=nodeType?.prototype;if(!proto||proto.__galleryArchiveConfigure)return;
    proto.__galleryArchiveConfigure=true;const configure=proto.configure;
    proto.configure=function(info:any,...args:any[]){return configure?.call(this,restoreWorkflowNode(info),...args);};
}
export function installWorkflowSerialization(node:any){
    if(!galleryNode(node)||node.__galleryArchiveSerialization)return;
    node.__galleryArchiveSerialization=true;const serialize=node.onSerialize,cache:{}={};
    node.onSerialize=function(info:any,...args:any[]){const result=serialize?.call(this,info,...args);Object.assign(info,compactWorkflowNode({...info,type:info.type||this.comfyClass||this.type},cache));return result;};
}
// Metadata readers may receive an exported workflow without an API prompt.
const expanded=new WeakMap<object,any>();
export function expandedWorkflow(data:any):any{
    if(!data||typeof data!=='object'||!Array.isArray(data.nodes)||!data.nodes.some((node:any)=>node.properties?.[KEY]))return data;
    let value=expanded.get(data);
    if(!value){value=restoreWorkflow({...data,nodes:[...data.nodes]});expanded.set(data,value);}
    return value;
}
