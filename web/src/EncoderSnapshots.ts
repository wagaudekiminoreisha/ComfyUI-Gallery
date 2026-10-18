import type {BoxState} from './PromptBoxes';
import {compileChip,formatBoxTerms,splitTop,filterSource} from './PromptBoxes';
import {capturePrefixSnapshot,loadPrefixes,type PrefixImage} from './PrefixLibrary';
import type {RuleBox} from './RuleEngine';
export type SnapshotTarget={sourceKey?:string;prefixId:string;terms:string[];negative_terms:string[];image_keys?:string[];image_refs?:Record<string,PrefixImage>;snapshotId?:string};
export type SnapshotReference={prefix_id:string;prefix_name:string;snapshot_id:string|null;terms:string[];negative_terms:string[];image_keys:string[]};
export async function preparePrefixSnapshots(node:any,state:BoxState,source:{negative?:boolean;snapshotTargets?:SnapshotTarget[]},rules:RuleBox[]):Promise<SnapshotReference[]>{
 const library=await loadPrefixes();const sourceBox=state.boxes.find(box=>box.kind==='source');
 const targets:SnapshotTarget[]=sourceBox?.enabled&&!source.negative?(source.snapshotTargets||[]).map(target=>({...target,terms:splitTop(filterSource(target.terms.join(', '),target.sourceKey?sourceBox.excludedBySource?.[target.sourceKey]||sourceBox.excluded||[]:sourceBox.excluded||[]),',')})):[];
 for(const box of state.boxes)if(box.kind==='group'&&box.enabled)for(const id of [...(box.prefixId?[box.prefixId]:[]),...(box.prefixIds||[])]){
  const prefix=library.prefixes.find(row=>row.id===id);if(!prefix?.tags.length)continue;
  targets.push({prefixId:id,terms:formatBoxTerms(box.chips.map(compileChip).filter(Boolean),box.format),negative_terms:prefix.negative_terms||[],snapshotId:box.prefixSnapshotId});
 }
 const result:SnapshotReference[]=[];node.properties||={};const cache=node.properties.gallery_snapshot_cache||{};
 for(const candidate of targets){
  const target={...candidate,terms:candidate.terms.map(term=>term.trim()).filter(Boolean),negative_terms:candidate.negative_terms.map(term=>term.trim()).filter(Boolean)};
  const payload={prefix_id:target.prefixId,terms:target.terms,negative_terms:target.negative_terms,rules,hair_policy:state.hairPolicy,image_keys:target.image_keys||[],image_refs:target.image_refs||{}};
  const digest=crypto.subtle?Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify({payload,parent:library.prefixes.find(p=>p.id===target.prefixId),tags:library.tags}))))).map(value=>value.toString(16).padStart(2,'0')).join(''):'';
  const snapshot_id=digest&&Object.prototype.hasOwnProperty.call(cache,digest)?cache[digest]:await capturePrefixSnapshot(payload);if(digest)cache[digest]=snapshot_id;
  result.push({prefix_id:target.prefixId,prefix_name:library.prefixes.find(row=>row.id===target.prefixId)?.name||'Prefix',snapshot_id,terms:target.terms,negative_terms:target.negative_terms,image_keys:target.image_keys||[]});
 }
 node.properties.gallery_snapshot_cache=Object.fromEntries(Object.entries(cache).slice(-100));node.properties.gallery_prefix_snapshots=result;return result;
}
