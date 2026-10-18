import {Dropdown} from 'antd';
import type {ReactElement} from 'react';
import {useGalleryContext} from './GalleryContext';
import {useHydrus} from './HydrusContext';
import {sourceViewerEntry} from './SourceViewer';
import {openImageInfo,openSourcePrefix,localEntry} from './ImageInfo';
import {openImageSearch} from './TagSearchPanel';
import type {ImageSourceImage} from './ImageSourceGeometry';
/** One context menu for node history and crop/stitch source images. */
export function SourceImageMenu({image,children,onRemove}:{image:ImageSourceImage;children:ReactElement;onRemove?:()=>void}){
 const gallery=useGalleryContext(),hydrus=useHydrus();const files=Object.values(gallery.data?.folders||{}).flatMap(folder=>Object.values(folder));const entry=sourceViewerEntry(image,files,file=>localEntry(file,hydrus.items[file.url]?.hash));const hash=entry.hash||/([a-f0-9]{64})/i.exec(image.input_name)?.[1];
 return <Dropdown autoFocus trigger={['contextMenu']} menu={{items:[{key:'view',label:'Open image'},{key:'info',label:'Metadata'},{key:'search',label:'Find related images',disabled:!hash&&!entry.local?.url.startsWith('/static_gallery/')},{key:'prefix',label:'Prefix associations…',disabled:entry.source==='node'},...(onRemove?[{key:'remove',label:'Remove from this node',danger:true}]:[])],onClick:({key})=>{if(key==='view')window.dispatchEvent(new CustomEvent('gallery-open-viewer',{detail:{sourceImages:[image],sourceIndex:0}}));if(key==='info')openImageInfo({url:entry.local?.url,remote:entry.remote,metadata:image.metadata||{},name:image.title||image.input_name});if(key==='prefix')openSourcePrefix([entry]);if(key==='search')openImageSearch({chips:[{kind:'image',url:entry.local?.url||'hydrus:'+hash,hash,name:image.title||image.input_name,metadata:image.metadata}]});if(key==='remove')onRemove?.();}}}>{children}</Dropdown>;
}
