/** Keep named workflow data and migrate positional widgets before LiteGraph assigns combo values. */
export const ENCODER_WIDGETS=['text','source_mode','hair_policy','rules_state','prefix_snapshots','source_image_exclusions'] as const;
const modes=new Set(['after','before','replace','boxes']);
const object=(value:any)=>{try{const data=typeof value==='string'?JSON.parse(value):value;return data&&typeof data==='object'?data:undefined;}catch{return undefined;}};
const encoded=(value:any)=>typeof value==='string'?value:JSON.stringify(value);
export function encoderWidgetValues(info:any):Record<string,any>{
 const values=Array.isArray(info?.widgets_values)?info.widgets_values:[],properties=info?.properties||{};
 const saved=properties.gallery_encoder_widgets?.version===1?properties.gallery_encoder_widgets.values:undefined;
 const boxes=properties.prompt_boxes;
 const result:Record<string,any>={text:typeof values[0]==='string'?values[0]:'',source_mode:boxes||typeof values[0]==='string'&&values[0].includes('⟦source')?'boxes':'after',hair_policy:JSON.stringify(boxes?.hairPolicy||{}),rules_state:JSON.stringify([...(Array.isArray(properties.gallery_inherited_rules)?properties.gallery_inherited_rules:[]),...(Array.isArray(boxes?.rulesets)?boxes.rulesets:[])]),prefix_snapshots:JSON.stringify(properties.gallery_prefix_snapshots||[]),source_image_exclusions:'{}'};
 let rulesFound=false,snapshotsFound=false;
 for(const value of values.slice(1)){
  if(typeof value==='string'&&modes.has(value)){result.source_mode=value;continue;}
  const parsed=object(value);if(!parsed)continue;
  if(!Array.isArray(parsed)&&['natural','specific','minimal'].includes(parsed.mode)){result.hair_policy=encoded(value);continue;}
  if(!Array.isArray(parsed)&&Array.isArray(parsed.segments)){result.source_image_exclusions=encoded(value);continue;}
  if(Array.isArray(parsed)){
   if(parsed.length&&parsed.every(row=>row&&typeof row==='object'&&row.definition)){result.rules_state=encoded(value);rulesFound=true;continue;}
   if(parsed.length&&parsed.every(row=>row&&typeof row==='object'&&typeof row.prefix_id==='string')){result.prefix_snapshots=encoded(value);snapshotsFound=true;continue;}
   if(!parsed.length){if(!rulesFound){result.rules_state='[]';rulesFound=true;}else if(!snapshotsFound){result.prefix_snapshots='[]';snapshotsFound=true;}}
  }
 }
 if(saved&&typeof saved==='object')for(const name of ENCODER_WIDGETS)if(Object.prototype.hasOwnProperty.call(saved,name)){
  const value=saved[name];if(name==='source_mode'){if(modes.has(value))result[name]=value;}else if(name==='text'){if(typeof value==='string')result[name]=value;}else {const parsed=object(value);const valid=name==='hair_policy'?parsed&&!Array.isArray(parsed)&&(!Object.keys(parsed).length||['natural','specific','minimal'].includes(parsed.mode)):name==='source_image_exclusions'?parsed&&!Array.isArray(parsed):Array.isArray(parsed);if(valid)result[name]=encoded(value);}
 }
 return result;
}
export function orderEncoderWidgets(node:any){
 if(!Array.isArray(node.widgets))return;
 const known=ENCODER_WIDGETS.flatMap(name=>node.widgets.filter((widget:any)=>widget.name===name));
 const rest=node.widgets.filter((widget:any)=>!ENCODER_WIDGETS.includes(widget.name));
 node.widgets.splice(0,node.widgets.length,...known,...rest);
}
export function migrateEncoderWorkflow(data:any){
 for(const info of Array.isArray(data?.nodes)?data.nodes:[]){if(info?.type!=='GalleryPromptEncode')continue;
  const values=encoderWidgetValues(info);info.properties||={};if(!info.properties.gallery_encoder_widgets&&Array.isArray(info.widgets_values)&&!modes.has(info.widgets_values[1]))info.properties.gallery_encoder_legacy_widgets=[...info.widgets_values];info.properties.gallery_encoder_widgets={version:1,values};
  info.widgets_values=ENCODER_WIDGETS.map(name=>values[name]);
 }
}
export function registerEncoderConstructor(nodeType:any){
 const prototype=nodeType?.prototype;if(!prototype||prototype.__galleryEncoderSerialization)return;
 prototype.__galleryEncoderSerialization=true;
 const configure=prototype.configure;
 prototype.configure=function(info:any,...args:any[]){
  orderEncoderWidgets(this);
  const values=encoderWidgetValues(info),copy={...info,properties:{...info?.properties,gallery_encoder_widgets:{version:1,values}},widgets_values:(this.widgets||[]).map((widget:any)=>Object.prototype.hasOwnProperty.call(values,widget.name)?values[widget.name]:widget.value)};
  return configure?.call(this,copy,...args);
 };
}
export function installEncoderSerialization(node:any){
 if(node.__galleryNamedWidgets)return;node.__galleryNamedWidgets=true;orderEncoderWidgets(node);
 const serialize=node.onSerialize;
 node.onSerialize=function(info:any,...args:any[]){const result=serialize?.call(this,info,...args);const values:Record<string,any>={};
  for(const widget of this.widgets||[])if(ENCODER_WIDGETS.includes(widget.name))values[widget.name]=widget.value;
  info.properties||={};info.properties.gallery_encoder_widgets={version:1,values};return result;
 };
}
/** Fallback for already-created nodes or hosts that skipped registration hooks. */
export function repairEncoderValues(node:any){
 const mode=node.widgets?.find((widget:any)=>widget.name==='source_mode');
 if(mode&&modes.has(mode.value))return;
 const values=encoderWidgetValues({properties:node.properties,widgets_values:(node.widgets||[]).map((widget:any)=>widget.value)});
 for(const widget of node.widgets||[])if(Object.prototype.hasOwnProperty.call(values,widget.name))widget.value=values[widget.name];
}
