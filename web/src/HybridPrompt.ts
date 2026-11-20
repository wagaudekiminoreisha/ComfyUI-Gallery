import {compileBoxes,sourceInput,type BoxState} from './PromptBoxes';
import type {RuleBox} from './RuleEngine';
export const HYBRID_ROLES=['identity','appearance','clothing','pose','expression','composition','environment','lighting','style','unassigned'] as const;
export type HybridRole=typeof HYBRID_ROLES[number];
export type HybridComponent={id:string;role?:HybridRole;subject?:string;source_text_enabled?:boolean;source_components_enabled?:boolean;source_roles?:HybridRole[];name?:string;type:'tags'|'prose'|'group'|'prefix'|'reference'|'source';selection?:'all'|'optional'|'one'|'optional-one';chance?:number;text?:string;children?:HybridComponent[];ref?:string;input?:string;format?:'tags'|'prose';inherit_rules?:boolean;side?:'positive'|'negative';placement?:'prefix'|'body'|'suffix';enabled?:boolean;description?:string;aliases?:string[];categories?:string[];image_keys?:string[];mode?:'global'|'on-demand'|'disabled';rules?:ComponentRule[];tag_rules?:RuleBox[];negative_tag_rules?:RuleBox[]};
export type ComponentRule={id:string;name?:string;target:string;action:'enable'|'disable';priority:number;tags:string[];components:string[];unless:string[];enabled?:boolean};
export type HybridDocument={version:1;components:HybridComponent[];source_images?:Record<string,string[]>;source_prefixes?:Record<string,string[]>;source_snapshots?:Record<string,string[]>;rules?:ComponentRule[];tag_rules?:RuleBox[];negative_tag_rules?:RuleBox[];seed?:number;override?:{enabled:boolean;positive:string;negative:string}};
export type HybridLibrary={version:1;components:Record<string,HybridComponent>;images?:Record<string,string[]>};
export const hybridId=()=>globalThis.crypto?.randomUUID?.()||'h'+Date.now().toString(36)+Math.random().toString(36).slice(2);
export const emptyHybrid=():HybridDocument=>({version:1,components:[]});
export const newHybridComponent=(type:HybridComponent['type']):HybridComponent=>({id:hybridId(),type,name:type==='prose'?'Description':type==='group'?'Group':'Tags',enabled:true,...(type==='group'?{children:[]}:type==='source'?{input:'source_text',format:'tags'}:{text:''})});
export function mapHybrid(rows:HybridComponent[],id:string,change:(row:HybridComponent)=>HybridComponent|undefined):HybridComponent[]{return rows.flatMap(row=>{const next=row.id===id?change(row):row.children?{...row,children:mapHybrid(row.children,id,change)}:row;return next?[next]:[];});}
export function cloneHybrid(row:HybridComponent):HybridComponent{return {...row,id:hybridId(),...(row.children?{children:row.children.map(cloneHybrid)}:{})};}
export function hybridSearch(library:HybridLibrary|undefined,query:string){const terms=query.toLowerCase().trim().split(/\s+/).filter(Boolean);return Object.values(library?.components||{}).filter(row=>{const haystack=[row.name,row.text,row.description,row.role,row.subject,...(row.aliases||[]),...(row.categories||[])].join(' ').toLowerCase();return terms.every(term=>haystack.includes(term));}).sort((a,b)=>(a.name||a.id).localeCompare(b.name||b.id));}
/** Explicit nondestructive import. Legacy dynamic tag syntax stays in tag components. */
export function legacyHybrid(state:BoxState):HybridDocument{return {version:1,components:state.boxes.map(box=>box.kind==='source'?{id:hybridId(),name:box.name||sourceInput(box),type:'source',input:sourceInput(box),format:'tags',enabled:box.enabled}:{id:hybridId(),name:box.name,type:'group',enabled:box.enabled,children:[{id:hybridId(),type:'tags',text:compileBoxes({version:1,boxes:[box]})}]}),tag_rules:state.rulesets?.filter(box=>box.origin!=='global')||[]};}

export function readHybridDocument(raw:unknown):HybridDocument{
 const value=typeof raw==='string'?JSON.parse(raw):raw;
 if(!value||value.version!==1||!Array.isArray(value.components))throw new Error('Unsupported or damaged hybrid document; the original data has been retained.');
 let count=0;const visit=(rows:any,depth:number)=>{if(!Array.isArray(rows)||depth>32)throw new Error('Invalid hybrid component hierarchy.');for(const row of rows){if(++count>5000||!row||typeof row!=='object'||typeof row.id!=='string')throw new Error('Invalid hybrid component record.');if(row.children!==undefined)visit(row.children,depth+1);}};visit(value.components,0);return value;
}
