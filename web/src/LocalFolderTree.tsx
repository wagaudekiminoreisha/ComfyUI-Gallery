import {Tree,Button} from 'antd';
import {useState} from 'react';
import {useGalleryContext} from './GalleryContext';
export function LocalFolderTree(){
 const gallery=useGalleryContext(),[collapsed,setCollapsed]=useState(false);
 const roots:any[]=[],index=new Map<string,any>();
 for(const path of Object.keys(gallery.data?.folders||{}).sort()){
  const parts=path.split('/');let parent:any;for(let i=0;i<parts.length;i++){const key=parts.slice(0,i+1).join('/');let node=index.get(key);if(!node){node={key,title:parts[i]||'Root',selectable:Object.prototype.hasOwnProperty.call(gallery.data?.folders||{},key),children:[]};index.set(key,node);(parent?parent.children:roots).push(node);}parent=node;}
  if(parent)parent.title=parts[parts.length-1]+' ('+Object.keys(gallery.data!.folders[path]).length+')';
 }
 return <nav aria-label="Local folders" style={{width:collapsed?42:190,flexShrink:0,overflow:'auto',borderRight:'1px solid #8884',padding:6}}><Button size="small" aria-label="Toggle local folders" onClick={()=>setCollapsed(!collapsed)}>{collapsed?'▶':'◀ Folders'}</Button>{!collapsed&&<Tree showLine defaultExpandAll key={Object.keys(gallery.data?.folders||{}).join('|')} treeData={roots} selectedKeys={[gallery.currentFolder]} onSelect={keys=>{if(keys.length){gallery.setCurrentFolder(String(keys[0]));gallery.setLibrarySearch(null);}}}/>}</nav>;
}
