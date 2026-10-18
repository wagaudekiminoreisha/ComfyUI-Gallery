import {Tree,Button,Dropdown,Modal,Select,Typography,message} from 'antd';
import {useHydrus} from './HydrusContext';
import {useState} from 'react';
import {useGalleryContext} from './GalleryContext';
import {loadPrefixes,type SharedLibrary} from './PrefixLibrary';
import {pairedHashIndex} from './PrefixLineage';
import {fetchLocalHashes} from './TagSearchPanel';
export function LocalFolderTree(){
 const hydrus=useHydrus();const gallery=useGalleryContext(),[collapsed,setCollapsed]=useState(false),[editing,setEditing]=useState<string>(),[prefixes,setPrefixes]=useState<string[]>([]),[hashes,setHashes]=useState<string[]>([]),[library,setLibrary]=useState<SharedLibrary>(),[saving,setSaving]=useState(false);
 const relative=(folder:string)=>folder.split('/').slice(1).join('/');
 const edit=async(folder:string)=>{const path=relative(folder),rules=(gallery.settings.routingRules||[]).filter(rule=>rule.folder===path);setPrefixes([...new Set(rules.flatMap(rule=>rule.prefixIds||[]))]);setHashes([...new Set(rules.filter(rule=>!rule.prefixIds?.length).flatMap(rule=>rule.lineageHashes||[]))]);setEditing(path);try{setLibrary(await loadPrefixes());}catch(error){message.error(String(error));}};
 const roots:any[]=[],index=new Map<string,any>();
 for(const path of Object.keys(gallery.data?.folders||{}).sort()){
  const parts=path.split('/');let parent:any;for(let i=0;i<parts.length;i++){const key=parts.slice(0,i+1).join('/');let node=index.get(key);if(!node){node={key,title:parts[i]||'Root',selectable:Object.prototype.hasOwnProperty.call(gallery.data?.folders||{},key),children:[]};index.set(key,node);(parent?parent.children:roots).push(node);}parent=node;}
  if(parent)parent.title=parts[parts.length-1]+' ('+Object.keys(gallery.data!.folders[path]).length+')';
 }
 for(const [path,node] of index){const title=node.title;node.title=<Dropdown trigger={['contextMenu']} menu={{items:[{key:'open',label:'Browse folder'},{key:'associations',label:'Prefix / lineage associations…',disabled:!relative(path)}],onClick:({key})=>key==='open'?gallery.setCurrentFolder(path):void edit(path)}}><span style={{display:'inline-block',minWidth:90}}>{title}</span></Dropdown>;}
 return <><nav aria-label="Local folders" style={{width:collapsed?42:190,flexShrink:0,overflow:'auto',borderRight:'1px solid #8884',padding:6}}><Button size="small" aria-label="Toggle local folders" onClick={()=>setCollapsed(!collapsed)}>{collapsed?'▶':'◀ Folders'}</Button>{!collapsed&&<Tree showLine defaultExpandAll key={Object.keys(gallery.data?.folders||{}).join('|')} treeData={roots} selectedKeys={[gallery.currentFolder]} onSelect={keys=>{if(keys.length){gallery.setCurrentFolder(String(keys[0]));gallery.setLibrarySearch(null);}}}/>}</nav>
 <Modal title={'Folder associations · '+editing} open={editing!==undefined} zIndex={3060} confirmLoading={saving} onCancel={()=>setEditing(undefined)} onOk={()=>void(async()=>{setSaving(true);try{const index=library?await pairedHashIndex(library,fetchLocalHashes):new Map<string,Set<string>>();const paired=[...index].filter(([,ids])=>prefixes.some(id=>ids.has(id))).map(([hash])=>hash);const rest=(gallery.settings.routingRules||[]).filter(rule=>!(rule.folder===editing&&(rule.prefixIds?.length||rule.lineageHashes?.length)));await gallery.setSettings({...gallery.settings,autoOrganize:prefixes.length||hashes.length?true:gallery.settings.autoOrganize,routingRules:[...rest,...(prefixes.length||hashes.length?[{name:'Associations → '+editing,folder:editing!,field:'positive',terms:[],match:'any',prefixIds:prefixes,lineageHashes:[...new Set([...hashes,...paired])]}]:[])]});setEditing(undefined);message.success('Folder associations saved. Matching files route on the next scan.');}catch(error){message.error(String(error));}finally{setSaving(false);}})()}>
 <Typography.Paragraph>Any selected prefix or source lineage routes into this folder. First matching folder rule wins. Saving enables automatic organization; use Settings → Folder rules to preview or disable it.</Typography.Paragraph>
 <Select aria-label="Folder prefix associations" mode="multiple" placeholder="Prefixes" value={prefixes} onChange={setPrefixes} options={library?.prefixes.map(prefix=>({value:prefix.id,label:'@'+prefix.name}))} style={{width:'100%',marginBottom:12}}/>
 <Select aria-label="Folder source lineages" mode="tags" placeholder="Source SHA-256 hashes — Enter adds one" value={hashes} options={Object.values(gallery.data?.folders||{}).flatMap(folder=>Object.values(folder)).flatMap(file=>hydrus.items[file.url]?.hash?[{value:hydrus.items[file.url].hash,label:file.name+' · '+hydrus.items[file.url].hash?.slice(0,8)}]:[])} onChange={values=>setHashes(values.filter(value=>/^[a-f0-9]{64}$/i.test(value)).map(value=>value.toLowerCase()))} style={{width:'100%'}}/>
 </Modal></>;
}
