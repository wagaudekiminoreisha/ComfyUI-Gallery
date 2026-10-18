import type {FileDetails} from './types';
import {ComfyAppApi} from './ComfyAppApi';
export async function loadLocalMetadata(file:FileDetails,root:string):Promise<FileDetails['metadata']>{
 if(!(file.metadata as any)?.gallery_metadata_deferred)return file.metadata;
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);
 try{
  const response=await ComfyAppApi.localMetadata(root,file.url,controller.signal),result=await response.json();
  if(!response.ok||!result.metadata||typeof result.metadata!=='object')throw new Error(result.error||'Cannot load local metadata');
  return result.metadata;
 }finally{clearTimeout(timer);}
}
