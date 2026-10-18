import type { PrefixImage, PrefixLibrary } from './PrefixLibrary';

/** Broad prefix associations include original pairings and all snapshot memberships. */
export function collectPrefixImages(library: PrefixLibrary, prefixId: string): PrefixImage[] {
 const images=new Map<string,PrefixImage>();
 const add=(key:string,reference:PrefixImage|undefined,paired:boolean)=>{
  let image=reference;
  if(!image&&key.startsWith('sha256:'))image={hash:key.slice(7)};
  if(!image&&key.startsWith('local:')){const at=key.lastIndexOf(':/static_gallery/');if(at>0)image={root:key.slice(6,at),local_url:key.slice(at+1)};}
  if(!image)return;
  const id=image.hash||(image.root||'')+(image.local_url||image.input_name||key),known=images.get(id);
  images.set(id,{...known,...image,keys:[...(known?.keys||[]),...(paired?[key]:[])]});
 };
 for(const [key,item]of Object.entries(library.associations||{}))if(item.prefix_id===prefixId)add(key,item.image,true);
 for(const row of Object.values(library.snapshots||{}))if(row.prefix_id===prefixId)for(const [key,ref]of Object.entries(row.members))add(key,Object.keys(ref).length?ref:undefined,false);
 return [...images.values()];
}
