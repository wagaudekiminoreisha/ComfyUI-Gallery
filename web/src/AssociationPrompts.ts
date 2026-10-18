import {extractLocalPrompts,type LocalPrompts} from './LocalImageSearch';
import {encoderRecords,metadataSources} from './PromptResolution';
import {sourcePrompt,type ImageSourceManifest} from './ImageSourceGeometry';
const object=(value:any):any=>{if(typeof value==='string'){try{return JSON.parse(value);}catch{return {};}}return value&&typeof value==='object'?value:{};};
/** Source recipes stay separate from tags added by downstream encoders. */
export function associationPrompts(metadata:unknown,sourceOnly=true):LocalPrompts{
 const actual=extractLocalPrompts(metadata,true);if(!sourceOnly)return actual;
 const data=metadataSources(metadata),manifests:any[]=[];
 for(const node of Object.values(object(data.prompt)))if((node as any)?.class_type==='GalleryImageSource')manifests.push(object((node as any).inputs?.sources));
 if(!manifests.length)for(const node of object(data.workflow).nodes||[])if(node?.type==='GalleryImageSource')manifests.push(object(node.widgets_values?.[0]));
 if(manifests.length){const valid=manifests.filter(value=>Array.isArray(value.images));return {positive:valid.map(value=>sourcePrompt(value as ImageSourceManifest,'positive')).filter(Boolean).join(', '),negative:valid.map(value=>sourcePrompt(value as ImageSourceManifest,'negative')).filter(Boolean).join(', ')};}
 const prefix=data.gallery_prefix;if(Array.isArray(prefix?.positive))return {positive:prefix.positive.join(', '),negative:Array.isArray(prefix.negative)?prefix.negative.join(', '):''};
 const records=Object.values(encoderRecords(metadata));if(records.length===1&&typeof records[0].source_text==='string')return {...actual,positive:records[0].source_text};
 return actual;
}
