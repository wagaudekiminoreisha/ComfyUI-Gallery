import type {RuleBox} from './RuleEngine';
const same=(a:RuleBox,b:RuleBox)=>a.definition.id===b.definition.id&&a.scope===b.scope;
export const hasActiveRuleset=(boxes:RuleBox[],id:string,scope='main')=>boxes.some(box=>box.enabled&&box.definition.id===id&&box.scope===scope);
/** Reuse disabled cards rather than accumulating copies with new IDs. */
export function insertRuleBox(boxes:RuleBox[],candidate:RuleBox,override=false):RuleBox[]{
 const existing=boxes.find(box=>box.enabled&&same(box,candidate))||boxes.find(box=>same(box,candidate));
 if(!existing)return [...boxes,candidate];
 if(existing.enabled&&(!override||existing.origin==='encoder'))return boxes;
 const replacement=override&&existing.origin!=='encoder'?{...candidate,id:existing.id}:{...existing,enabled:true,collapsed:false};
 return boxes.map(box=>box===existing?replacement:box);
}
/** Editing/enabling one card deactivates old copies of that ruleset in its channel. */
export function patchRuleBox(boxes:RuleBox[],id:string,changes:Partial<RuleBox>):RuleBox[]{
 const original=boxes.find(box=>box.id===id);if(!original)return boxes;
 const target={...original,...changes};
 return boxes.map(box=>box.id===id?target:target.enabled&&same(box,target)?{...box,enabled:false}:box);
}
