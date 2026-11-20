import {useEffect,useSyncExternalStore} from 'react';
import {installPromptTagVocabulary} from './PromptTagVocabulary';
let state={version:0,ready:false,loading:false,error:''},etag='',pending:Promise<void>|undefined,refreshAgain=false,listening=false;
const listeners=new Set<()=>void>();
const publish=(value:Partial<typeof state>)=>{state={...state,...value};listeners.forEach(listener=>listener());};
export function reloadPromptTagVocabulary(force=false):Promise<void>{
 if(pending){if(force)refreshAgain=true;return pending;}
 publish({loading:true});
 pending=(async()=>{try{
  const api=(window as any).comfyAPI?.app?.app?.api||(window as any).comfyAPI?.api?.api,headers:Record<string,string>={};if(etag)headers['If-None-Match']=etag;const options={headers};
  const response=await(api?.fetchApi?api.fetchApi('/Gallery/prompt-tag-vocabulary',options):fetch('/Gallery/prompt-tag-vocabulary',options));
  if(response.status===304){publish({error:''});return;}
  const value=await response.json();if(!response.ok)throw new Error(value.error||'Prompt tag vocabulary unavailable.');
  if(value.version!==1||!value.aliases||typeof value.aliases!=='object'||Array.isArray(value.aliases)||Object.values(value.aliases).some(value=>typeof value!=='string'))throw new Error('Invalid prompt tag vocabulary.');
  installPromptTagVocabulary(value.aliases);etag=response.headers.get('ETag')||'';publish({ready:true,error:'',version:state.version+1});
 }catch(error){publish({error:String(error)});}finally{pending=undefined;publish({loading:false});if(refreshAgain){refreshAgain=false;void reloadPromptTagVocabulary();}}})();return pending;
}
export function usePromptTagVocabulary(){
 const value=useSyncExternalStore(listener=>{listeners.add(listener);return()=>{listeners.delete(listener);};},()=>state);
 useEffect(()=>{if(!listening){listening=true;const refresh=()=>{void reloadPromptTagVocabulary(true);};window.addEventListener('gallery-prefix-library-changed',refresh);window.addEventListener('focus',refresh);}if(!state.ready)void reloadPromptTagVocabulary();},[]);
 return value;
}
