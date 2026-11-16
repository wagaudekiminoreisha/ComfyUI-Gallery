import {deduplicatePromptPreview,hasUnresolvedChoices} from './PromptDeduplication';
import {SOURCE_INPUTS,sourceInput,addSourceBox} from './PromptBoxes';
import { inheritedRuleKey, privateRuleBoxes, selectedInheritedRules, snapshotRuleBoxes } from './InheritedRules';
import {installEncoderSerialization,repairEncoderValues,orderEncoderWidgets} from './EncoderSerialization';
import {bindLegacySourceExclusions,sourceExclusionPayload,filteredSourceText} from './SourceExclusions';
import {sourcePrefixRefs, sourcePrefixTerms} from './SourcePrefixes';
import {readSourceManifest, saveSourceManifest} from './ImageSourceBridge';
import {preparePrefixSnapshots} from './EncoderSnapshots';
import {rulesRequest,RULES_CHANGED} from './RulesLibrary';
import {applyRulePreview,type RuleBox,type RulesLibrary} from './RuleEngine';
import {availableRules,disabledRulesets,globalRuleBoxes} from './RuleAvailability';
import { cleanHairPolicy, filterHairPrompt } from './HairPolicy';
import { removeTagsFromChip } from './BatchTagBlacklist';
import { createRoot } from 'react-dom/client';
import { encoderSizing } from './EncoderSizing';
import { PromptBoxEditor, type SourceInfo } from './PromptBoxEditor';
import { makeSuggest, type SuggestDeps } from './PromptSuggest';
import { hideWidget } from './NodeWidgets';
import { compileBoxes, composeWithSource, compileChip, splitTop, parsePrompt, insertText, parseState, reconcileText, stateFromText, type BoxState } from './PromptBoxes';
import { getComfyApp } from './ComfyAppApi';
import { sourcePrompt, promptSourceImages, sourceMerge, type ImageSourceManifest } from './ImageSourceGeometry';
import { openPrefixManager } from './PrefixLibrary';

/** What the connected `source_text` provides: known at edit time for Gallery Image Source, otherwise after a run. */
export function sourcePromptInfo(node: any, inputName = 'source_text'): SourceInfo {
    const input = node.inputs?.find((item: any) => item.name === inputName);
    if (input?.link == null) return { connected: false };
    const graph = node.graph || getComfyApp()?.graph;
    const link = graph?.links?.get?.(input.link) || graph?.links?.[input.link];
    const source = graph?.getNodeById?.(link?.origin_id) || graph?._nodes?.find((value: any) => value.id === link?.origin_id);
    if ((source?.comfyClass || source?.type) === 'GalleryImageSource' && [4, 5].includes(link?.origin_slot)) {
        try {
            const manifest = readSourceManifest(source);
            const side = link.origin_slot === 4 ? 'positive' : 'negative';
            const usedImages = promptSourceImages;
            const images = usedImages(manifest);
            const refs = (image: typeof images[number]) => sourcePrefixRefs(image.metadata);
            const prefixes = new Map(images.flatMap(image => refs(image)
                .filter(ref => side === 'negative' || ref.positive_enabled !== false)
                .map(ref => [ref.id, { id: ref.id, name: ref.name || ref.id }] as const)));
            return {
                connected: true,
                negative: side === 'negative',
                text: sourcePrompt(manifest, side),
                merge:sourceMerge(manifest),
                segments: images.map(image => ({ key: image.input_name + ':' + side, name: image.title || image.input_name.split('/').pop() || image.input_name, text: image.prompt?.[side] || '' })),
                snapshotTargets: images.flatMap(image => {
                    const hash = /([a-f0-9]{64})/i.exec(image.input_name)?.[1]?.toLowerCase();
                    const key = hash ? 'sha256:' + hash : '';
                    return refs(image).filter(ref => ref.positive_enabled !== false || ref.snapshot_id).map(ref => ({
                        sourceKey: image.input_name + ':positive', prefixId: ref.id, snapshotId: ref.snapshot_id,
                        terms: sourcePrefixTerms(image, ref, 'positive'), negative_terms: sourcePrefixTerms(image, ref, 'negative'),
                        image_keys: key ? [key] : [],
                        image_refs: key ? { [key]: { hash, input_name: image.input_name, ...(image.metadata?.gallery_url ? { local_url: image.metadata.gallery_url } : {}) } } : {},
                    }));
                }),
                prefixes: [...prefixes.values()],
                append: async (id, text) => {
                    const current = readSourceManifest(source), active = usedImages(current);
                    const updated = current.images.map(image => {
                        if (!active.includes(image) || !refs(image).some(ref => ref.id === id)) return image;
                        const currentTerms = splitTop(image.prompt?.[side] || '', ',');
                        const terms = text.trim().startsWith('-')
                            ? currentTerms.flatMap(term => parsePrompt(term).map(chip => removeTagsFromChip(chip, [text.trim().slice(1)])).filter((chip): chip is NonNullable<typeof chip> => !!chip).map(compileChip))
                            : [...new Set([...currentTerms, text])];
                        return { ...image, prompt: { positive: '', negative: '', tags: [], ...image.prompt, [side]: terms.join(', ') } };
                    });
                    saveSourceManifest(source, { ...current, images: updated });
                },
            };
        }
        catch { return { connected: true, note: 'Source settings unavailable' }; }
    }
    const runtime=node.__galleryRuntimeSources?.[inputName] ?? (inputName==='source_text'?node.__galleryRuntimeSource:undefined);
    return typeof runtime === 'string' ? { connected: true, text: runtime } : { connected: true, note: 'Connected prompt will be shown after execution.' };
}

export function sourcePromptInfos(node:any):Record<string,SourceInfo>{
    return Object.fromEntries(SOURCE_INPUTS.map(input=>[input,sourcePromptInfo(node,input)]));
}
function ensureConnectedSources(state:BoxState,node:any):BoxState{
    for(const input of SOURCE_INPUTS)if(sourcePromptInfo(node,input).connected)state=addSourceBox(state,input);
    return state;
}

export function effectiveSourceText(node: any): string | undefined {
    const infos=Object.values(sourcePromptInfos(node)).filter(info=>info.connected);
    return infos.length?infos.map(info=>info.text??info.note??'').filter(Boolean).join(', '):undefined;
}

type Deps = SuggestDeps;


/**
 * Replace the encoder's two text boxes with the tag-box editor.
 *
 * The boxes live in `node.properties.prompt_boxes`. Every edit compiles them into the hidden `text`
 * widget (so ComfyUI still resolves {a|b|c} dynamic prompts when it queues the workflow) and switches
 * `source_mode` to "boxes", which makes the backend put the connected source text where the source box sits.
 */
export function installPromptBoxes(node: any, deps: Deps) {
    if ((node.comfyClass || node.type) !== 'GalleryPromptEncode' || node.__galleryPromptBoxes || !node.addDOMWidget || typeof document === 'undefined') return;
    if (!node.inputs?.some((input: any) => input.name === 'source_text')) node.addInput?.('source_text', 'STRING');
    if (!node.widgets?.some((widget: any) => widget.name === 'source_mode')) node.addWidget?.('combo', 'source_mode', 'after', () => undefined, { values: ['after', 'before', 'replace', 'boxes'] });
    const widget = (name: string) => node.widgets?.find((item: any) => item.name === name);
    const hasSource = () => Object.values(sourcePromptInfos(node)).some(info=>info.connected);
    repairEncoderValues(node);
    const saved = parseState(node.properties?.prompt_boxes);
    let state: BoxState = saved ?? stateFromText(String(widget('text')?.value ?? ''), String(widget('source_mode')?.value ?? 'after'), hasSource());

    if (!widget('hair_policy')) node.addWidget?.('text', 'hair_policy', '{}', () => undefined);
    const legacyHair=cleanHairPolicy(widget('hair_policy')?.value);
    state = { ...state, hairPolicy: state.hairPolicy===null?null:state.hairPolicy||(legacyHair.mode!=='specific'||legacyHair.singleColour?legacyHair:null) };
    if(!widget('source_image_exclusions'))node.addWidget?.('text','source_image_exclusions','{}',()=>undefined);
    if(!widget('prefix_snapshots'))node.addWidget?.('text','prefix_snapshots','[]',()=>undefined);
    if (!widget('rules_state')) node.addWidget?.('text','rules_state','[]',()=>undefined);
    orderEncoderWidgets(node);installEncoderSerialization(node);
    let rulesLibrary:RulesLibrary={version:1,definitions:[],globals:[],prefixes:{}};
    let inheritedRules:RuleBox[]=node.properties?.gallery_inherited_rules||[];
    let globals:RuleBox[]=node.properties?.gallery_global_rules ?? state.rulesets?.filter(box=>box.origin==='global') ?? [];
    let disabled=new Set<string>(node.properties?.gallery_disabled_rulesets||[]);
    let rulesNotice='';let alive=true;let rulesRequestId=0;let rulesPending:Promise<void>=Promise.resolve();
    const effectiveRules=()=>availableRules([...globals,...selectedInheritedRules(inheritedRules,state.excludedInheritedRules),...(state.rulesets||[]).filter(box=>box.origin!=='global')],disabled);
    const syncRules=()=>{const rules=widget('rules_state');if(rules)rules.value=JSON.stringify(effectiveRules());};
    const suggest = makeSuggest(deps);

    const host = document.createElement('div');
    host.style.cssText = 'pointer-events:auto;width:100%;height:100%;overflow:auto;box-sizing:border-box;background:var(--comfy-input-bg,#222);border-radius:6px';
    const root = createRoot(host);
    const sizing = encoderSizing(node, host);
    for (const type of ['pointerdown', 'mousedown', 'keydown', 'keyup', 'dragstart', 'dragover', 'drop']) {
        host.addEventListener(type, event => event.stopPropagation());
    }
    /** Compilation leaves exclusions and compatibility decisions to the rules program. */
    const together = () => undefined;
    const syncSource=()=>{
        const infos=sourcePromptInfos(node);
        state={...state,boxes:state.boxes.map(box=>box.kind==='source'?bindLegacySourceExclusions({version:1,boxes:[box]},infos[sourceInput(box)]?.segments).boxes[0]:box)};
        const edits:Record<string,unknown>={};
        for(const box of state.boxes)if(box.kind==='source'){
            const input=sourceInput(box),info=infos[input];
            if(!node.inputs?.some((pin:any)=>pin.name===input))node.addInput?.(input,'STRING');
            const pin=node.inputs?.find((pin:any)=>pin.name===input);if(pin)pin.label=box.name?box.name+' ('+input+')':input;
            if(info?.connected){const payload=sourceExclusionPayload(box,info.segments,info.merge);if(Object.keys(payload).length)edits[input]=payload;}
        }
        node.properties||={};node.properties.prompt_boxes=state;
        const hasExtra=state.boxes.some(box=>box.kind==='source'&&sourceInput(box)!=='source_text');
        widget('source_image_exclusions').value=JSON.stringify(hasExtra?{sources:edits}:edits.source_text||{});
    };
    widget('source_image_exclusions').serializeValue=()=>{syncSource();return widget('source_image_exclusions').value;};
    const compiledNow = () => {syncSource();return compileBoxes(state, together());};
    /** Keep the stored prompt in step with the boxes (the exclusive mode can change without an edit). */
    const sync = () => {
        syncRules();
        const hair = widget('hair_policy');
        if (hair) hair.value = JSON.stringify(cleanHairPolicy(state.hairPolicy));
        const compiled = compiledNow(), text = widget('text');
        if (text && text.value !== compiled) { text.value = compiled; if (text.inputEl) text.inputEl.value = compiled; text.callback?.(compiled); node.setDirtyCanvas?.(true, true); }
    };
    const render = () => {
        const sources=sourcePromptInfos(node),source=sources.source_text;
        const texts=Object.fromEntries(state.boxes.filter(box=>box.kind==='source').map(box=>{const info=sources[sourceInput(box)]||{connected:false};return [sourceInput(box),filteredSourceText(box,info.segments,info.connected?info.text:'',info.merge)||''];}));
        const rawPreview=composeWithSource(compiledNow(),undefined,texts),filtered=filterHairPrompt(rawPreview,cleanHairPolicy(state.hairPolicy));
        let reviewed:ReturnType<typeof applyRulePreview>;
        try{reviewed=applyRulePreview(filtered,effectiveRules());}catch(error){reviewed={text:filtered,errors:[String(error)],notes:[],protectedTags:[]};}
        root.render(<PromptBoxEditor sources={sources} snapshotReferences={node.properties?.gallery_prefix_snapshots||[]} onOpenSnapshot={row=>openPrefixManager({name:row.prefix_name,positive:row.terms,negative:row.negative_terms,snapshotId:row.snapshot_id||undefined})} ruleDefinitions={rulesLibrary.definitions} inheritedRules={availableRules(inheritedRules,disabled)} globalRules={globals} disabledRules={disabled} ruleErrors={reviewed.errors} ruleProtected={reviewed.protectedTags} rulesNotice={[rulesNotice,...reviewed.notes,hasUnresolvedChoices(reviewed.text)?'Matching repeated tags are removed after choices resolve.':''].filter(Boolean).join(' · ')} onReloadRules={()=>void loadRules()} state={state} source={source} unfilteredPreview={rawPreview} preview={deduplicatePromptPreview(reviewed.text)} suggest={suggest} onChange={commit} lastEncodedPrompt={node.__galleryEffectivePrompt} notice={notice} />);
    };
    function loadRules() {
        const requestId=++rulesRequestId;
        const task=(async()=>{try {
            const [result,prefixes]=await Promise.all([rulesRequest(),deps.loadLibrary().catch(()=>undefined)]);
            if(!alive||requestId!==rulesRequestId)return;rulesLibrary=result.library;
            globals=globalRuleBoxes(rulesLibrary);
            disabled=disabledRulesets(rulesLibrary);
            state={...state,rulesets:(state.rulesets||[]).filter(box=>box.origin!=='global')};
            node.properties ||= {};
            node.properties.gallery_global_rules=globals;
            node.properties.gallery_disabled_rulesets=[...disabled];
            if(!prefixes)throw new Error('Prefix library unavailable.');
            const infos=sourcePromptInfos(node);
            const inheritedSources=state.boxes.flatMap(box=>box.kind==='source'&&box.enabled&&box.inheritRules!==false&&infos[sourceInput(box)]?.connected&&!infos[sourceInput(box)]?.negative?[infos[sourceInput(box)]]:[]);
            const ids=new Set<string>([...inheritedSources.flatMap(info=>info.prefixes?.map(prefix=>prefix.id)||[]),...state.boxes.flatMap(box=>box.kind==='group'&&box.enabled&&box.inheritRules!==false?[...(box.prefixId?[box.prefixId]:[]),...(box.prefixIds||[])]:[])]);
            // Nested @prefix references contribute their attached rules without losing their origin.
            const visited=new Set<string>();
            const visit=(id:string)=>{if(visited.has(id)||visited.size>=100)return;const prefix=prefixes.prefixes.find(item=>item.id===id);if(!prefix?.tags.length)return;visited.add(id);for(const tagId of prefix?.tags||[]){const text=prefixes.tags.find(tag=>tag.id===tagId)?.text.trim();if(text?.startsWith('@')){const child=prefixes.prefixes.find(item=>item.name.toLowerCase()===text.slice(1).toLowerCase());if(child)visit(child.id);}}};
            ids.forEach(visit);
            inheritedRules=[...visited].flatMap(id=>privateRuleBoxes(rulesLibrary.prefixes[id]||[],rulesLibrary).map(box=>({...box,id:'prefix:'+id+':'+box.id,inheritanceKey:inheritedRuleKey(id,box),origin:'prefix' as const,label:'Prefix '+(prefixes.prefixes.find(item=>item.id===id)?.name||id)})));
            const snapshotIds=[...new Set([...state.boxes.flatMap(box=>box.kind==='group'&&box.enabled&&box.inheritRules!==false&&box.prefixSnapshotId?[box.prefixSnapshotId]:[]),...inheritedSources.flatMap(info=>(info.snapshotTargets||[]).flatMap(target=>target.snapshotId?[target.snapshotId]:[]))])];
            for(const id of snapshotIds){const snapshot=prefixes.snapshots?.[id];if(!snapshot)continue;inheritedRules.push(...snapshotRuleBoxes(snapshot,rulesLibrary).map(box=>({...box,id:'snapshot:'+id+':'+box.id,inheritanceKey:inheritedRuleKey(snapshot.prefix_id,box),origin:'snapshot' as const,label:'Snapshot '+id.slice(0,8)})));}
            node.properties ||= {};node.properties.gallery_inherited_rules=inheritedRules;node.properties.prompt_boxes=state;
            rulesNotice='';syncRules();render();sizing.request(false);
        } catch(error){if(alive&&requestId===rulesRequestId){rulesNotice='Using saved rules where the library is unavailable. '+String(error);syncRules();render();}}})();
        rulesPending=task;return task;
    }
    widget('rules_state').serializeValue=async()=>{let pending;do{pending=rulesPending;await pending;}while(pending!==rulesPending);if(state.rulesets===undefined)throw new Error('Rules library could not be loaded. Use Refresh rules before queuing this new encoder.');syncRules();return widget('rules_state').value;};
    widget('prefix_snapshots').serializeValue=async()=>{let pending;do{pending=rulesPending;await pending;}while(pending!==rulesPending);syncSource();const references=await preparePrefixSnapshots(node,state,{sources:sourcePromptInfos(node)},effectiveRules());widget('prefix_snapshots').value=JSON.stringify(references);render();return widget('prefix_snapshots').value;};
    const rulesChanged=()=>{void loadRules();};window.addEventListener(RULES_CHANGED,rulesChanged);window.addEventListener('gallery-prefix-library-changed',rulesChanged);
    /** Shown under the boxes after an edit, e.g. which tags "Exclusive tags" turned off. */
    let inheritedPrefixSignature:unknown[]=[];
    let notice = '';
    function commit(next: BoxState) {
        const groups = state.boxes.filter(box => box.kind === 'group');
        const tail = groups[groups.length-1];
        const removedTail = !!tail && !next.boxes.some(box=>box.id===tail.id);
        const removedRule = !!state.hairPolicy&&!next.hairPolicy || (state.rulesets||[]).some(box=>!(next.rulesets||[]).some(candidate=>candidate.id===box.id));
        notice = '';
        for(const box of state.boxes)if(box.kind==='source'&&!next.boxes.some(item=>item.id===box.id)){
            const index=node.inputs?.findIndex((pin:any)=>pin.name===sourceInput(box));
            if(index>=0){node.disconnectInput?.(index);node.inputs[index].label=sourceInput(box);}
        }
        state = next;syncRules();
        const hair = widget('hair_policy'); if (hair) hair.value = JSON.stringify(cleanHairPolicy(state.hairPolicy));
        node.properties ||= {}; node.properties.prompt_boxes = state;
        const compiled = compiledNow(), text = widget('text'), mode = widget('source_mode');
        if (text && text.value !== compiled) { text.value = compiled; if (text.inputEl) text.inputEl.value = compiled; text.callback?.(compiled); }
        if (mode && mode.value !== 'boxes') { mode.value = 'boxes'; mode.callback?.('boxes'); }
        node.setDirtyCanvas?.(true, true); node.graph?.change?.();
        render();
        sizing.request(removedTail||removedRule);
        if(JSON.stringify(next.boxes.flatMap(box=>box.kind==='group'?[box.prefixId,box.prefixIds,box.prefixSnapshotId,box.enabled,box.inheritRules]:[box.enabled,box.inheritRules]))!==JSON.stringify(inheritedPrefixSignature))void loadRules();
        inheritedPrefixSignature=next.boxes.flatMap(box=>box.kind==='group'?[box.prefixId,box.prefixIds,box.prefixSnapshotId,box.enabled,box.inheritRules]:[box.enabled,box.inheritRules]);
    }
    /** Re-read the stored text: if something else changed it (an API call, another extension) the boxes follow it. */
    const refresh = () => {
        const connected=ensureConnectedSources(state,node);if(connected!==state){commit(connected);return;}
        const text = widget('text');
        if (text && typeof text.value === 'string') {
            const next = reconcileText(state, text.value, String(widget('source_mode')?.value ?? 'boxes'), hasSource(), together());
            if (next !== state) { commit(next); return; }
        }
        sync(); render();
    };

    hideWidget(widget('text')); hideWidget(widget('source_mode')); hideWidget(widget('hair_policy')); hideWidget(widget('rules_state'));hideWidget(widget('prefix_snapshots'));hideWidget(widget('source_image_exclusions'));
    const policyWidget=widget('rules_policy');
    if(policyWidget){hideWidget(policyWidget);policyWidget.serialize=false;}
    const dom = node.addDOMWidget('prompt_boxes', 'prompt_boxes', host, sizing.options);
    if (dom) dom.serialize = false;
    sizing.calibrate();
    node.__galleryPromptBoxes = {
        /** Library and image-prompt appends arrive here as text and become their own box. Returns the compiled prompt. */
        insert(text: string, position: 'before' | 'after' | 'replace', name?: string, prefixId?:string|string[],snapshotId?:string) { let next=insertText(state,text,position,name);if(prefixId)next={...next,boxes:next.boxes.map(box=>box.kind==='group'&&!state.boxes.some(previous=>previous.id===box.id)?{...box,...(snapshotId?{prefixSnapshotId:snapshotId}:{}),...(Array.isArray(prefixId)?{prefixIds:prefixId}:{prefixId})}:box)};commit(next);void loadRules();return compiledNow(); },
    };

    for (const key of ['onConnectionsChange', 'onConfigure']) {
        const previous = node[key];
        node[key] = function (...args: any[]) {
            const result = previous?.apply(this, args);
            if(key==='onConnectionsChange'&&args[0]===1){
                const input=node.inputs?.[args[1]]?.name;
                if(SOURCE_INPUTS.includes(input)){
                    if(node.__galleryRuntimeSources)delete node.__galleryRuntimeSources[input];
                    if(input==='source_text')delete node.__galleryRuntimeSource;
                }
            }
            if (key === 'onConfigure') {
                repairEncoderValues(node);
                state=parseState(node.properties?.prompt_boxes)??state;
                inheritedRules=node.properties?.gallery_inherited_rules||[];
                globals=node.properties?.gallery_global_rules??state.rulesets?.filter(box=>box.origin==='global')??[];
                disabled=new Set(node.properties?.gallery_disabled_rulesets||[]);
                syncRules();
            }
            setTimeout(()=>{refresh();void loadRules();}, 0);
            return result;
        };
    }
    const executed = node.onExecuted;
    node.onExecuted = function (data: any) {
        const result = executed?.call(this, data);
        if (Array.isArray(data?.effective_prompt) && typeof data.effective_prompt[0] === 'string') node.__galleryEffectivePrompt = data.effective_prompt[0];
        if(data?.source_texts?.[0]&&typeof data.source_texts[0]==='object')node.__galleryRuntimeSources=data.source_texts[0];
        if (Array.isArray(data?.source_text) && typeof data.source_text[0] === 'string') node.__galleryRuntimeSource = data.source_text[0];
        render();
        return result;
    };
    const changed = () => {refresh();void loadRules();};
    window.addEventListener('gallery-source-changed', changed);
    const removed = node.onRemoved;
    node.onRemoved = function (...args: any[]) {
        window.removeEventListener('gallery-source-changed', changed);
        alive=false;window.removeEventListener(RULES_CHANGED,rulesChanged);window.removeEventListener('gallery-prefix-library-changed',rulesChanged);
        sizing.dispose();
        setTimeout(() => root.unmount(), 0);
        return removed?.apply(this, args);
    };

    node.setSize?.([Math.max(400, node.size?.[0] || 0), Math.max(node.size?.[1] || 0, node.computeSize?.()[1] || 0, 460)]);
    if (saved) refresh(); else commit(ensureConnectedSources(state,node));
    void loadRules();
}
