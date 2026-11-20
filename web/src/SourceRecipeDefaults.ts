import type {PrefixLibrary} from './PrefixLibrary';
type Choice={session:string;keys:string[];urls:string[];snapshot:string|null};
const memory=new Map<string,Choice>();
const STORAGE='gallery-source-recipes-session';
function read(){try{for(const [key,value] of JSON.parse(localStorage.getItem(STORAGE)||'[]'))if(value?.session&&Array.isArray(value.keys)&&Array.isArray(value.urls))memory.set(key,value);}catch{}return memory;}
export function rememberSourceRecipe(library:PrefixLibrary,prefixId:string,keys:string[],snapshot:string|null,urls:string[]=[]){
    if(!library.session_id)return;
    read().set(prefixId,{session:library.session_id,keys,urls,snapshot});
    try{localStorage.setItem(STORAGE,JSON.stringify([...memory].slice(-100)));}catch{}
}
export function defaultSourceRecipe(library:PrefixLibrary,prefixId:string,keys:string[],candidates:string[]=[]):string|undefined{
    const cached=read().get(prefixId);
    if(cached&&cached.session===library.session_id&&(cached.keys.some(key=>keys.includes(key))||cached.urls.some(url=>keys.some(key=>key.endsWith(':'+url))))){
        if(!cached.snapshot)return;
        if(library.snapshots?.[cached.snapshot]?.prefix_id===prefixId)return cached.snapshot;
    }
    if(keys.some(key=>library.associations?.[key]?.prefer_snapshots?.includes(prefixId))){
        return candidates.find(id=>library.snapshots?.[id]?.prefix_id===prefixId);
    }
}
