import {rulesRequest,RULES_CHANGED} from './RulesLibrary';
import {applyRulePreview,type RuleBox,type RulesLibrary} from './RuleEngine';
import { cleanHairPolicy, filterHairPrompt } from './HairPolicy';
import { removeTagsFromChip } from './BatchTagBlacklist';
import { createRoot } from 'react-dom/client';
import { encoderSizing } from './EncoderSizing';
import { PromptBoxEditor, type SourceInfo } from './PromptBoxEditor';
import { makeSuggest, type SuggestDeps } from './PromptSuggest';
import { hideWidget } from './NodeWidgets';
import { alwaysTogether, chipTerms, compileBoxes, composeWithSource, compileChip, parsePrompt, disableConflicts, insertText, neverTogether, parseState, reconcileText, stateFromText, type BoxState } from './PromptBoxes';
import { conflicts, EXCLUSIVE_MODE_EVENT, exclusiveMode } from './TagConflicts';
import { getComfyApp } from './ComfyAppApi';
import { sourcePrompt, type ImageSourceManifest } from './ImageSourceGeometry';
import { expandPrefix, loadPrefixes, savePrefix, type SharedLibrary } from './PrefixLibrary';

/** What the connected `source_text` provides: known at edit time for Gallery Image Source, otherwise after a run. */
export function sourcePromptInfo(node: any): SourceInfo {
    const input = node.inputs?.find((item: any) => item.name === 'source_text');
    if (input?.link == null) return { connected: false };
    const graph = node.graph || getComfyApp()?.graph;
    const link = graph?.links?.get?.(input.link) || graph?.links?.[input.link];
    const source = graph?.getNodeById?.(link?.origin_id) || graph?._nodes?.find((value: any) => value.id === link?.origin_id);
    if ((source?.comfyClass || source?.type) === 'GalleryImageSource' && [4, 5].includes(link?.origin_slot)) {
        try {
            const manifest: ImageSourceManifest = JSON.parse(source.widgets.find((value: any) => value.name === 'sources').value);
            const side = link.origin_slot === 4 ? 'positive' : 'negative';
            const images = manifest.layout === 'single' ? manifest.images.slice(manifest.active_index || 0, (manifest.active_index || 0) + 1) : manifest.images;
            const ids = [...new Set(images.map(image => image.metadata?.gallery_prefix?.id).filter((id): id is string => typeof id === 'string'))];
            return { connected: true, negative:side==='negative', text: sourcePrompt(manifest, side), prefixes: ids.map(id => ({ id, name: images.find(image => image.metadata?.gallery_prefix?.id === id)?.metadata?.gallery_prefix?.name || id })),
                append: async (id, text) => {
                    const library = await loadPrefixes();
                    const prefix = library.prefixes.find(item => item.id === id);
                    if (!prefix) throw new Error('The paired prefix no longer exists.');
                    const positive = expandPrefix(library, '@' + prefix.name), negative = prefix.negative_terms || [];
                    const current = side === 'positive' ? positive : negative;
                    const terms = text.trim().startsWith('-') ? current.flatMap(term => parsePrompt(term).map(chip => removeTagsFromChip(chip, [text.trim().slice(1)])).filter((chip): chip is NonNullable<typeof chip> => !!chip).map(compileChip)) : [...new Set([...current, text])];
                    await savePrefix(prefix.name, side === 'positive' ? terms : positive, library.revision, undefined, side === 'negative' ? terms : negative);
                } };
        }
        catch { return { connected: true, note: 'Source settings unavailable' }; }
    }
    return typeof node.__galleryRuntimeSource === 'string' ? { connected: true, text: node.__galleryRuntimeSource } : { connected: true, note: 'Connected prompt will be shown after execution.' };
}

export function effectiveSourceText(node: any): string | undefined {
    const info = sourcePromptInfo(node);
    return info.connected ? info.text ?? info.note : undefined;
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
    const hasSource = () => sourcePromptInfo(node).connected;
    const saved = parseState(node.properties?.prompt_boxes);
    let state: BoxState = saved ?? stateFromText(String(widget('text')?.value ?? ''), String(widget('source_mode')?.value ?? 'after'), hasSource());

    if (!widget('hair_policy')) node.addWidget?.('text', 'hair_policy', '{}', () => undefined);
    const legacyHair=cleanHairPolicy(widget('hair_policy')?.value);
    state = { ...state, hairPolicy: state.hairPolicy===null?null:state.hairPolicy||(legacyHair.mode!=='specific'||legacyHair.singleColour?legacyHair:null) };
    if (!widget('rules_state')) node.addWidget?.('text','rules_state','[]',()=>undefined);
    let rulesLibrary:RulesLibrary={version:1,definitions:[],globals:[],prefixes:{}};
    let inheritedRules:RuleBox[]=node.properties?.gallery_inherited_rules||[];
    let rulesNotice='';let alive=true;let rulesRequestId=0;let rulesPending:Promise<void>=Promise.resolve();
    const effectiveRules=()=>[...inheritedRules,...(state.rulesets||[])];
    const syncRules=()=>{const rules=widget('rules_state');if(rules)rules.value=JSON.stringify(effectiveRules());};
    const suggest = makeSuggest(deps);

    const host = document.createElement('div');
    host.style.cssText = 'pointer-events:auto;width:100%;height:100%;overflow:auto;box-sizing:border-box;background:var(--comfy-input-bg,#222);border-radius:6px';
    const root = createRoot(host);
    const sizing = encoderSizing(node, host);
    for (const type of ['pointerdown', 'mousedown', 'keydown', 'keyup', 'dragstart', 'dragover', 'drop']) {
        host.addEventListener(type, event => event.stopPropagation());
    }
    /** Exclusive tags in "never together" mode change how the boxes compile (see neverTogether). */
    const together = () => exclusiveMode() === 'together' ? conflicts : undefined;
    const compiledNow = () => compileBoxes(state, together());
    /** Keep the stored prompt in step with the boxes (the exclusive mode can change without an edit). */
    const sync = () => {
        syncRules();
        const hair = widget('hair_policy');
        if (hair) hair.value = JSON.stringify(cleanHairPolicy(state.hairPolicy));
        const compiled = compiledNow(), text = widget('text');
        if (text && text.value !== compiled) { text.value = compiled; if (text.inputEl) text.inputEl.value = compiled; text.callback?.(compiled); node.setDirtyCanvas?.(true, true); }
    };
    const render = () => {
        const source = sourcePromptInfo(node);
        const mode = exclusiveMode(), names = (ids: string[]) => ids.map(id => state.boxes.flatMap(box => box.kind === 'group' ? box.chips : []).find(chip => chip.id === id)).map(chip => chip && chipTerms(chip)[0]).join(' / ');
        const notes = [notice,
            ...(mode === 'together' ? neverTogether(state, conflicts).map(ids => 'Never together: ' + names(ids)) : []),
            ...(mode !== 'off' ? alwaysTogether(state, conflicts).map(([a, b]) => `${a} and ${b} are both always used (make one optional)`) : [])].filter(Boolean);
        const rawPreview=composeWithSource(compiledNow(),source.text),filtered=filterHairPrompt(rawPreview,cleanHairPolicy(state.hairPolicy));
        let reviewed:ReturnType<typeof applyRulePreview>;
        try{reviewed=applyRulePreview(filtered,effectiveRules());}catch(error){reviewed={text:filtered,errors:[String(error)],notes:[],protectedTags:[]};}
        root.render(<PromptBoxEditor ruleDefinitions={rulesLibrary.definitions} inheritedRules={inheritedRules} ruleErrors={reviewed.errors} ruleProtected={reviewed.protectedTags} rulesNotice={[rulesNotice,...reviewed.notes].filter(Boolean).join(' · ')} onReloadRules={()=>void loadRules(true)} state={state} source={source} unfilteredPreview={rawPreview} preview={reviewed.text} suggest={suggest} onChange={commit} lastEncodedPrompt={node.__galleryEffectivePrompt} notice={notes.join(' · ')} />);
    };
    function loadRules(resetGlobals=false) {
        const requestId=++rulesRequestId;
        const task=(async()=>{try {
            const [result,prefixes]=await Promise.all([rulesRequest(),deps.loadLibrary()]);
            if(!alive||requestId!==rulesRequestId)return;rulesLibrary=result.library;
            if(resetGlobals||state.rulesets===undefined){state={...state,rulesets:[...rulesLibrary.globals.map(box=>({...box,origin:'global' as const})),...(resetGlobals?(state.rulesets||[]).filter(box=>box.origin!=='global'):[])]};}
            const source=sourcePromptInfo(node);
            const sourceEnabled=state.boxes.some(box=>box.kind==='source'&&box.enabled);
            const ids=new Set<string>([...(sourceEnabled&&!source.negative?source.prefixes?.map(prefix=>prefix.id)||[]:[]),...state.boxes.flatMap(box=>box.kind==='group'&&box.enabled?[...(box.prefixId?[box.prefixId]:[]),...(box.prefixIds||[])]:[])]);
            // Nested @prefix references contribute their attached rules without losing their origin.
            const visited=new Set<string>();
            const visit=(id:string)=>{if(visited.has(id)||visited.size>=100)return;const prefix=prefixes.prefixes.find(item=>item.id===id);if(!prefix?.tags.length)return;visited.add(id);for(const tagId of prefix?.tags||[]){const text=prefixes.tags.find(tag=>tag.id===tagId)?.text.trim();if(text?.startsWith('@')){const child=prefixes.prefixes.find(item=>item.name.toLowerCase()===text.slice(1).toLowerCase());if(child)visit(child.id);}}};
            ids.forEach(visit);
            inheritedRules=[...visited].flatMap(id=>(rulesLibrary.prefixes[id]||[]).map(box=>({...box,id:'prefix:'+id+':'+box.id,origin:'prefix' as const,label:'Prefix '+(prefixes.prefixes.find(item=>item.id===id)?.name||id)})));
            node.properties ||= {};node.properties.gallery_inherited_rules=inheritedRules;node.properties.prompt_boxes=state;
            rulesNotice='';syncRules();render();sizing.request(false);
        } catch(error){if(alive&&requestId===rulesRequestId){rulesNotice='Rules library unavailable; saved snapshots remain active. '+String(error);render();}}})();
        rulesPending=task;return task;
    }
    widget('rules_state').serializeValue=async()=>{let pending;do{pending=rulesPending;await pending;}while(pending!==rulesPending);if(state.rulesets===undefined)throw new Error('Rules library could not be loaded. Retry Reload global defaults before queuing this new encoder.');syncRules();return widget('rules_state').value;};
    const rulesChanged=(event:Event)=>{void loadRules(!!(event as CustomEvent).detail?.resetGlobals);};window.addEventListener(RULES_CHANGED,rulesChanged);window.addEventListener('gallery-prefix-library-changed',rulesChanged);
    const exclusiveChanged = () => { sync(); render(); };
    window.addEventListener(EXCLUSIVE_MODE_EVENT, exclusiveChanged);
    /** Shown under the boxes after an edit, e.g. which tags "Exclusive tags" turned off. */
    let inheritedPrefixSignature:unknown[]=[];
    let notice = '';
    function commit(next: BoxState) {
        const groups = state.boxes.filter(box => box.kind === 'group');
        const tail = groups[groups.length-1];
        const removedTail = !!tail && !next.boxes.some(box=>box.id===tail.id);
        const removedRule = !!state.hairPolicy&&!next.hairPolicy || (state.rulesets||[]).some(box=>!(next.rulesets||[]).some(candidate=>candidate.id===box.id));
        notice = '';
        if (exclusiveMode() === 'disable') {
            const result = disableConflicts(state, next, conflicts);
            next = result.state;
            if (result.disabled.length) notice = 'Exclusive tags turned off: ' + result.disabled.join(', ');
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
        if(JSON.stringify(next.boxes.flatMap(box=>box.kind==='group'?[box.prefixId,box.prefixIds,box.enabled]:[box.enabled]))!==JSON.stringify(inheritedPrefixSignature))void loadRules();
        inheritedPrefixSignature=next.boxes.flatMap(box=>box.kind==='group'?[box.prefixId,box.prefixIds,box.enabled]:[box.enabled]);
    }
    /** Re-read the stored text: if something else changed it (an API call, another extension) the boxes follow it. */
    const refresh = () => {
        const text = widget('text');
        if (text && typeof text.value === 'string') {
            const next = reconcileText(state, text.value, String(widget('source_mode')?.value ?? 'boxes'), hasSource(), together());
            if (next !== state) { commit(next); return; }
        }
        sync(); render();
    };

    hideWidget(widget('text')); hideWidget(widget('source_mode')); hideWidget(widget('hair_policy')); hideWidget(widget('rules_state'));
    const dom = node.addDOMWidget('prompt_boxes', 'prompt_boxes', host, sizing.options);
    if (dom) dom.serialize = false;
    sizing.calibrate();
    node.__galleryPromptBoxes = {
        /** Library and image-prompt appends arrive here as text and become their own box. Returns the compiled prompt. */
        insert(text: string, position: 'before' | 'after' | 'replace', name?: string, prefixId?:string|string[]) { let next=insertText(state,text,position,name);if(prefixId)next={...next,boxes:next.boxes.map(box=>box.kind==='group'&&!state.boxes.some(previous=>previous.id===box.id)?{...box,...(Array.isArray(prefixId)?{prefixIds:prefixId}:{prefixId})}:box)};commit(next);void loadRules();return compiledNow(); },
    };

    for (const key of ['onConnectionsChange', 'onConfigure']) {
        const previous = node[key];
        node[key] = function (...args: any[]) {
            const result = previous?.apply(this, args);
            if (key === 'onConfigure') {state = parseState(node.properties?.prompt_boxes) ?? state;inheritedRules=node.properties?.gallery_inherited_rules||[];syncRules();}
            setTimeout(()=>{refresh();void loadRules();}, 0);
            return result;
        };
    }
    const executed = node.onExecuted;
    node.onExecuted = function (data: any) {
        const result = executed?.call(this, data);
        if (Array.isArray(data?.effective_prompt) && typeof data.effective_prompt[0] === 'string') node.__galleryEffectivePrompt = data.effective_prompt[0];
        if (Array.isArray(data?.source_text) && typeof data.source_text[0] === 'string') node.__galleryRuntimeSource = data.source_text[0];
        render();
        return result;
    };
    const changed = () => {refresh();void loadRules();};
    window.addEventListener('gallery-source-changed', changed);
    const removed = node.onRemoved;
    node.onRemoved = function (...args: any[]) {
        window.removeEventListener('gallery-source-changed', changed);
        window.removeEventListener(EXCLUSIVE_MODE_EVENT, exclusiveChanged);
        alive=false;window.removeEventListener(RULES_CHANGED,rulesChanged);window.removeEventListener('gallery-prefix-library-changed',rulesChanged);
        sizing.dispose();
        setTimeout(() => root.unmount(), 0);
        return removed?.apply(this, args);
    };

    node.setSize?.([Math.max(400, node.size?.[0] || 0), Math.max(node.size?.[1] || 0, node.computeSize?.()[1] || 0, 460)]);
    if (saved) refresh(); else commit(state);
    void loadRules();
}
