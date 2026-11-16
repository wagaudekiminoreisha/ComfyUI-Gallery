import {partitionSourceAppend,reuseAppendConfiguration,reusablePrefixIds,configurationFromSource,type AppendConfiguration} from './SourceAppendPolicy';
import {TermsEditor} from './PromptBoxEditor';
import {promptLeaves} from './RuleImpact';
import {makeSuggest} from './PromptSuggest';
import {expandPrefix} from './PrefixLibrary';
import {imageSnapshotIds,imagePrefixIds} from './PrefixLineage';
import { associationPrefixIds } from './PrefixAssociations';
import { mergeSourcePrefixTerms, sourcePrefixMetadata, sourcePrefixRecipe, sourcePrefixRefs, type SourcePrefix } from './SourcePrefixes';
import {loadLocalMetadata} from './LocalMetadata';
import { promptTerms } from './PromptTags';
import { FloatingPanel } from './FloatingPanel';
import { PromptPalette } from './PromptPalette';
import { useGalleryContext } from './GalleryContext';
import { usePromptSpelling, formatPromptTerms, prepareInsertion } from './PromptSpelling';
import { openPrefixManager, loadPrefixes, imagePrefixKeys, imagePrefixRefs,type SharedLibrary } from './PrefixLibrary';
import { ImageSourceTarget } from './ImageSourceHost';
import { useEffect, useState } from 'react';
import { Alert, Button, Checkbox, Collapse, Modal, Select, Space, Tag, Typography, message } from 'antd';
import { appendToImageSource, getAppendTarget, getPromptTargets } from './ImageSourceBridge';
import { extractHydrusTags, extractLocalPrompts } from './LocalImageSearch';
import { HydrusTagSelect } from './HydrusTagSelect';
import { hydrusRequest } from './HydrusApi';
import { useHydrus } from './HydrusContext';
import type { GalleryEntry } from './GalleryOrder';
import type { ImageSourceImage, PromptApply } from './ImageSourceGeometry';

type Row = { entry: GalleryEntry; metadata: any; positive: string[]; negative: string[]; usePositive: boolean; useNegative: boolean; useTags: boolean; tags: string[]; sync: boolean; prefixes: SourcePrefix[]; associatedIds: string[] };

function selectPrefixes(row: Row, prefixes: SourcePrefix[]): Row {
    const positive = mergeSourcePrefixTerms(row.usePositive ? row.positive : [], row.prefixes, prefixes, 'positive');
    const negative = mergeSourcePrefixTerms(row.useNegative ? row.negative : [], row.prefixes, prefixes, 'negative');
    return { ...row, prefixes,
        positive: !row.usePositive && !positive.length ? row.positive : positive,
        negative: !row.useNegative && !negative.length ? row.negative : negative,
        usePositive: !!positive.length, useNegative: !!negative.length };
}
async function localContentHashes(entries:GalleryEntry[]):Promise<Record<string,string>>{
    const urls=entries.flatMap(entry=>entry.local?[entry.local.url]:[]);
    if(!urls.length)return {};
    try{const response=await fetch('/Gallery/source/hashes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({urls})});return response.ok?(await response.json()).hashes||{}:{};}catch{return {};}
}
export function AppendImagesModal({ entries, onClose,snapshotId }: { entries: GalleryEntry[]; onClose: () => void;snapshotId?:string }) {
    const hydrus = useHydrus();
    const gallery = useGalleryContext();
    const suggest=makeSuggest({loadLibrary:loadPrefixes,expandPrefix});
    const [library,setLibrary]=useState<SharedLibrary>({version:2,tags:[],prefixes:[]});
    const [paletteOpen,setPaletteOpen]=useState(false);
    const [paletteImage, setPaletteImage] = useState(0);
    const [paletteSide, setPaletteSide] = useState<'positive' | 'negative' | 'tags'>('positive');
    const [spaces, setSpaces] = usePromptSpelling();
    const [rows, setRows] = useState<Row[]>([]);
    const [appendTarget,setAppendTarget]=useState<Awaited<ReturnType<typeof getAppendTarget>>>({images:[]});
    const [targets, setTargets] = useState<{ value: string; label: string }[]>([]);
    const [apply, setApply] = useState<PromptApply>({ mode: 'after' });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    useEffect(()=>{
        if(!entries.length)return;
        let live=true,busy=false;
        const refresh=async()=>{if(busy)return;busy=true;try{const value=await getAppendTarget();if(live)setAppendTarget(old=>JSON.stringify(old)===JSON.stringify(value)?old:value);}catch{if(live)setAppendTarget({images:[]});}finally{busy=false;}};
        void refresh();const timer=window.setInterval(refresh,2000);
        return()=>{live=false;window.clearInterval(timer);};
    },[entries]);
    useEffect(() => {
        if (!entries.length) return;
        let live = true;
        setError(''); setNotice(''); setPaletteImage(0);
        const initial: Row[] = entries.map(entry => {
            const metadata = entry.local ? { ...entry.local.metadata, hydrus: hydrus.items[entry.local.url]?.metadata || (entry.local.metadata as any)?.hydrus } : { hydrus: entry.remote };
            const prompts = extractLocalPrompts(metadata,true);
            return { entry, metadata, positive: promptTerms(prompts.positive), negative: promptTerms(prompts.negative), usePositive: false, useNegative: false, useTags: false, tags: extractHydrusTags(metadata), sync: false, prefixes: [], associatedIds: [] };
        });
        setRows([]);
        void Promise.all([loadPrefixes(),localContentHashes(entries)]).then(([library,hashes]) => { if (live){setLibrary(library); setRows(initial.map(original => {
            const ownHash=(original.entry.local?hashes[original.entry.local.url]:undefined)||original.entry.hash;
            const row={...original,metadata:{...original.metadata,gallery_content_hash:ownHash},entry:{...original.entry,hash:ownHash}};
            const keys = imagePrefixKeys(row.entry, gallery.settings.relativePath);
            const direct = [...new Set(keys.flatMap(key => associationPrefixIds(library.associations?.[key])))];
            const variantId = snapshotId || sourcePrefixRefs(row.metadata).find(ref => ref.snapshot_id)?.snapshot_id || imageSnapshotIds(library, keys, row.metadata)[0];
            const variant = variantId ? library.snapshots?.[variantId] : undefined;
            const selected = [...new Set([...direct, ...(variant ? [variant.prefix_id] : [])])];
            const associatedIds = [...new Set([...selected, ...imagePrefixIds(library, keys, row.metadata)])];
            const prefixes = selected.flatMap(id => {
                const recipe = sourcePrefixRecipe(library, id, variant?.prefix_id === id ? variant.id : undefined);
                return recipe ? [recipe] : [];
            });
            return prefixes.length ? selectPrefixes({ ...row, associatedIds }, prefixes) : { ...row, associatedIds };
        }));} }).catch(reason => { if (live) { setRows(initial); setError('Could not load image-prefix associations: ' + String(reason)); } });
        void getPromptTargets().then(setTargets).catch(reason => setError(String(reason)));
        return () => { live = false; };
    }, [entries]);
    const update = (index: number, values: Partial<Row>) => setRows(old => old.map((row, i) => i === index ? { ...row, ...values } : row));
    const changePrefixes = (index: number, change: (row: Row) => SourcePrefix[]) =>
        setRows(old => old.map((row, at) => at === index ? selectPrefixes(row, change(row)) : row));
    const candidate=(row:Row):ImageSourceImage=>({input_name:'',metadata:{...row.metadata,
        gallery_content_hash:row.entry.hash,gallery_url:row.entry.local?.url,gallery_root:gallery.settings.relativePath,
        gallery_revision:row.entry.local?.revision||String(row.entry.local?.timestamp||'')}});
    const candidates=rows.map(candidate),partition=partitionSourceAppend(appendTarget.images,candidates);
    const duplicates=new Set(partition.duplicates.map(item=>candidates.indexOf(item.image)));
    const reuse=(index:number,configuration:AppendConfiguration)=>setRows(old=>old.map((row,at)=>at===index?reuseAppendConfiguration(configuration,row):row));
    const share=(index:number)=>{
        setRows(old=>old.map((row,at)=>{
            if(at===index||duplicates.has(at))return row;
            const next=reuseAppendConfiguration(old[index],row);
            return next;
        }));
        // Report eligibility, not an asynchronous React updater's eventual result.
        const count=rows.filter((row,at)=>at!==index&&!duplicates.has(at)&&reusablePrefixIds(rows[index],row).size).length;
        message.info(`Applied compatible prefix/snapshot choices to ${count} image(s). Per-image edits and unrelated prefixes are kept.`);
    };
    const enableSides=(index:number,sides:('positive'|'negative')[])=>setRows(old=>old.map((row,at)=>{
        if(at!==index)return row;
        let next=row;
        for(const side of sides){
            const prefixes=next.prefixes.map(ref=>({...ref,[side+'_enabled']:true}));
            const values=mergeSourcePrefixTerms(next[side],next.prefixes,prefixes,side);
            next={...next,prefixes,[side]:values,...(side==='positive'?{usePositive:true}:{useNegative:true})};
        }
        return next;
    }));
    const togglePrefix=(index:number,id:string,side:'positive'|'negative',enabled:boolean)=>setRows(old=>old.map((row,at)=>{
        if(at!==index)return row;
        const base={...row,...(enabled?(side==='positive'?{usePositive:true}:{useNegative:true}):{})};
        return selectPrefixes(base,row.prefixes.map(ref=>ref.id===id?{...ref,[side+'_enabled']:enabled}:ref));
    }));
    const append = async () => {
        setBusy(true); setError(''); setNotice('');
        try {
            const fresh=await getAppendTarget();
            if(fresh.requiresSelection)throw new Error('Choose an Image Source target before appending images.');
            const hashes=await localContentHashes(rows.map(row=>row.entry));
            const current=rows.map(row=>candidate({...row,entry:{...row.entry,hash:(row.entry.local?hashes[row.entry.local.url]:undefined)||row.entry.hash}}));
            const pending=partitionSourceAppend(fresh.images,current).accepted;
            const activeRows=rows.filter((_,index)=>pending.includes(current[index]));
            if(!activeRows.length){message.info('All selected images are already in the target source.');onClose();return;}
            const images: ImageSourceImage[] = [];
            for (const row of activeRows) {
                let copied: any;
                const prefixMetadata = sourcePrefixMetadata(row.prefixes.map(ref => ({
                    ...ref, positive_enabled: row.usePositive&&ref.positive_enabled!==false, negative_enabled: row.useNegative&&ref.negative_enabled!==false,
                })));
                if (row.entry.local) {
                    const originalMetadata=await loadLocalMetadata(row.entry.local,gallery.settings.relativePath);
                    const response = await fetch('/Gallery/source/local', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: row.entry.local.url, metadata: { ...originalMetadata, hydrus: row.metadata.hydrus, ...prefixMetadata } }) });
                    copied = await response.json();
                    if (!response.ok) throw new Error(copied.error || 'Local image copy failed');
                } else copied = await hydrusRequest('import', { hash: row.entry.hash });
                if (copied.warning) throw new Error(copied.warning + ' Retry after checking Hydrus permissions; workflow was not changed.');
                const metadata = { ...row.metadata, ...copied.metadata, ...prefixMetadata, gallery_url:row.entry.local?.url, gallery_root:gallery.settings.relativePath, gallery_revision:row.entry.local?.revision||String(row.entry.local?.timestamp||''), gallery_content_hash:copied.hash||row.entry.hash, hydrus: copied.metadata?.hydrus || row.metadata.hydrus };
                images.push({ input_name: copied.input_name, title: row.entry.name, metadata, prompt: { positive: (await formatPromptTerms(Array.from(new Set([...(row.usePositive ? row.positive : []), ...(row.useTags ? row.tags : [])])), spaces)).join(', '), negative: row.useNegative ? (await formatPromptTerms(row.negative, spaces)).join(', ') : '', tags: row.tags } });
            }
            // Append first so a missing workflow target cannot silently become a copy-only action.
            const result = await appendToImageSource(images, apply, activeRows.map(row => row.entry.local?.url),fresh.selected??null);
            message.success(result);
            if(activeRows.length<rows.length)message.info(`Skipped ${rows.length-activeRows.length} image(s) already in the target source or repeated in this append.`);
            const failures: string[] = [];
            for (const row of activeRows.filter(row => row.sync)) {
                const hash = row.entry.hash || hydrus.items[row.entry.local?.url || '']?.hash;
                if (!hash) { failures.push(row.entry.name + ': no known Hydrus correspondence'); continue; }
                try { await hydrusRequest('tag_sync', { hash, tags: row.tags, target: `${hydrus.settings?.url}|${hydrus.settings?.profile}` }); }
                catch (reason) { failures.push(row.entry.name + ': ' + String(reason)); }
            }
            if (activeRows.some(row => row.sync) && !failures.length) message.info("Hydrus tag changes saved to the background sync queue.");
            hydrus.reloadMemory();
            if (failures.length) { setNotice(result); setError('Images were appended. Tag sync failed: ' + failures.join('; ')); }
            else onClose();
        } catch (reason) { setError(String(reason)); }
        finally { setBusy(false); }
    };
    return <FloatingPanel panelKey="append-images" title="Append images and prompts" open={entries.length > 0} onCancel={() => { if (!busy) onClose(); }} width={1050} styles={{ body: { maxHeight: '78vh', overflowY: 'auto' } }} zIndex={3045} footer={<Space><Button disabled={busy} onClick={onClose}>Cancel</Button><Button type="primary" loading={busy} disabled={!!notice || !rows.length || duplicates.size===rows.length || rows.length > 32} onClick={() => void append()}>Append to workflow</Button></Space>}>
        <Typography.Paragraph>Each image retains its metadata. Enable only the prompt terms you want this reference to contribute. Saved prefixes expand into editable tags; removing a term here does not remove it from the original image.</Typography.Paragraph>
        <Checkbox checked={spaces} onChange={event => { setSpaces(event.target.checked); }}>Prefer spaces for recognized Danbooru prompt tags (off preserves canonical underscores)</Checkbox>
        <ImageSourceTarget disabled={busy} onTargetChange={()=>{void getAppendTarget().then(setAppendTarget).catch(()=>setAppendTarget({images:[]}));}} /><Space wrap>
            <Select aria-label="Prompt write mode" value={apply.mode} onChange={mode => setApply(old => ({ ...old, mode }))} options={[{ value: 'replace', label: 'Replace target prompt' }, { value: 'before', label: 'Add before target prompt' }, { value: 'after', label: 'Add after target prompt' }]} style={{ width: 225 }} />
            <Select aria-label="Positive prompt target" allowClear placeholder="Positive target (optional)" value={apply.positive} options={targets} onChange={positive => setApply(old => ({ ...old, positive }))} style={{ width: 270 }} />
            <Select aria-label="Negative prompt target" allowClear placeholder="Negative target (optional)" value={apply.negative} options={targets} onChange={negative => setApply(old => ({ ...old, negative }))} style={{ width: 270 }} />
        </Space>
        <Typography.Paragraph type="secondary">Without targets, enabled prompts remain on the source node's positive/negative STRING outputs. Connect its IMAGE output to your VAE Encode or ControlNet image input.</Typography.Paragraph>
        <Button onClick={()=>setPaletteOpen(true)}>All tags…</Button>
        <FloatingPanel panelKey="append-vocabulary" title="All tags" open={paletteOpen} onCancel={()=>setPaletteOpen(false)} width={850} zIndex={3060}>
        <Space wrap align="center" style={{display:"flex"}}><Select style={{minWidth:240}} aria-label="Vocabulary image" value={paletteImage} onChange={setPaletteImage} options={rows.map((row, value) => ({ value, label: row.entry.name }))} /><Select aria-label="Vocabulary destination" value={paletteSide} onChange={setPaletteSide} options={[{value:'positive',label:'Positive prompt'},{value:'negative',label:'Negative prompt'},{value:'tags',label:'Hydrus tags'}]} /></Space>
        <PromptPalette onAppend={async (groups, options) => {
            if (!rows[paletteImage]) throw new Error('Choose an image first.');
            const terms = promptTerms(await prepareInsertion(groups, options));
            setRows(old => old.map((row, index) => index !== paletteImage ? row : {
                ...row, [paletteSide]: options.position === 'before' ? [...terms, ...row[paletteSide]] : [...row[paletteSide], ...terms],
                ...(paletteSide === 'positive' ? { usePositive: true } : paletteSide === 'negative' ? { useNegative: true } : {}),
            }));
        }} onChoose={(terms, prefixId, negatives) => {
            const row = rows[paletteImage];
            if (!row) return;
            if (paletteSide === 'positive' && prefixId) {
                changePrefixes(paletteImage, current => current.prefixes.some(ref => ref.id === prefixId) ? current.prefixes :
                    [...current.prefixes, { id: prefixId, positive: terms, negative: negatives || [] }]);
                return;
            }
            update(paletteImage, { [paletteSide]: [...new Set([...row[paletteSide], ...terms])],
                ...(paletteSide === 'positive' ? { usePositive: true } : paletteSide === 'negative' ? { useNegative: true } : {}) });
        }} />
        </FloatingPanel>
        <Typography.Paragraph aria-label="Append contribution summary" style={{marginTop:12,marginBottom:4}}>{rows.length-duplicates.size} new image{rows.length-duplicates.size===1?'':'s'} · {rows.filter((row,index)=>!duplicates.has(index)&&(row.usePositive||row.useNegative||row.useTags)).length} with prompt contributions</Typography.Paragraph>
        {!!duplicates.size&&<Alert type="info" message={`${duplicates.size} duplicate image(s) will be skipped; existing target crops, connections and recipes stay intact.`}/>}
        <Typography.Text type="secondary">Reuse prefix/snapshot choices only across shared prefixes or image provenance. Image-specific terms and Hydrus tags are kept.</Typography.Text>
        <Collapse defaultActiveKey={['0']} items={rows.map((row, index) => ({ key: String(index), label: <Space wrap>
            <img alt="" width={36} height={36} style={{objectFit:'cover',borderRadius:4}} src={row.entry.local?`/Gallery/thumbnail?url=${encodeURIComponent(row.entry.local.url)}&root=${encodeURIComponent(gallery.settings.relativePath)}&v=${encodeURIComponent(row.entry.local.revision||String(row.entry.local.timestamp))}`:`/Gallery/hydrus/thumbnail?hash=${row.entry.hash}&target=${encodeURIComponent(`${hydrus.settings?.url}|${hydrus.settings?.profile}`)}`}/>
            <span>{row.entry.name}</span>{duplicates.has(index)&&<Tag color="gold">Already present · skipped</Tag>}
            {!row.usePositive&&!row.useNegative&&!row.useTags&&<Tag>Image only</Tag>}
            {row.usePositive&&<Tag color="green">Positive · {promptLeaves(row.positive.join(', ')).length}</Tag>}
            {row.useNegative&&<Tag color="orange">Negative · {promptLeaves(row.negative.join(', ')).length}</Tag>}
            {row.useTags&&<Tag color="blue">Hydrus · {row.tags.length}</Tag>}
            {row.prefixes.map(ref=><Tag key={ref.id} color="purple">@{library.prefixes.find(prefix=>prefix.id===ref.id)?.name||ref.name||ref.id}</Tag>)}
        </Space>, children: <Space data-append-row={index} direction="vertical" align="start" style={{ width: '100%' }}>
            <Space wrap>
                <Button size="small" disabled={duplicates.has(index)||!rows.some((other,at)=>at!==index&&!duplicates.has(at)&&reusablePrefixIds(row,other).size)} onClick={()=>share(index)}>Apply choices to related images</Button>
                <Select<number> aria-label={'Reuse target configuration '+index} placeholder="Use configuration from target…" value={undefined} disabled={duplicates.has(index)||!appendTarget.images.some(image=>{const config=configurationFromSource(image);return config.prefixes.length&&reusablePrefixIds(config,row).size;})} style={{minWidth:260,maxWidth:'100%'}}
                    options={appendTarget.images.flatMap((image,at)=>{
                        const config=configurationFromSource(image);
                        return config.prefixes.length&&reusablePrefixIds(config,row).size?[{value:at,label:(image.title||image.input_name)+' · '+config.prefixes.map(ref=>'@'+(ref.name||ref.id)+(ref.snapshot_id?' / '+ref.snapshot_id.slice(0,8):'')).join(', ')}]:[];
                    })}
                    onChange={at=>reuse(index,configurationFromSource(appendTarget.images[at]))}/>
            </Space>
            <Button onClick={() => {
                const first = row.prefixes[0];
                openPrefixManager({ name: first?.name, snapshotId: first?.snapshot_id,
                    positive: row.prefixes.length > 1 ? first.positive : row.positive,
                    negative: row.prefixes.length > 1 ? first.negative : row.negative,
                    hydrus: row.tags, imageKeys: imagePrefixKeys(row.entry, gallery.settings.relativePath),
                    imageRefs: imagePrefixRefs(row.entry, gallery.settings.relativePath),
                    onSaved: (positive, id, negative) => {
                        const recipe = { id, positive, negative };
                        changePrefixes(index, current => current.prefixes.some(ref => ref.id === id)
                            ? current.prefixes.map(ref => ref.id === id ? recipe : ref) : [...current.prefixes, recipe]);
                        void loadPrefixes().then(setLibrary).catch(reason => setError(String(reason)));
                    },
                });
            }}>Prefix associations…</Button>
            {!!(row.associatedIds.length || row.prefixes.length) && <Select mode="multiple" aria-label={'Associated prefix '+index}
                placeholder="Choose associated prefixes" value={row.prefixes.map(ref => ref.id)} style={{ minWidth: 280 }}
                options={[...new Set([...row.associatedIds, ...row.prefixes.map(ref => ref.id)])].map(id => ({ value: id, label: '@' + (library.prefixes.find(prefix => prefix.id === id)?.name || id) }))}
                onChange={ids => changePrefixes(index, current => ids.flatMap(id => {
                    const recipe = current.prefixes.find(ref => ref.id === id) || sourcePrefixRecipe(library, id);
                    return recipe ? [recipe] : [];
                }))} />}
            {row.prefixes.map((ref, refIndex) => <Space key={ref.id} wrap>
                <Typography.Text type="success">@{library.prefixes.find(prefix => prefix.id === ref.id)?.name || ref.name || ref.id}</Typography.Text>
                <Select aria-label={'Reference snapshot ' + index + (refIndex ? ' · ' + ref.id : '')} style={{ minWidth: 230 }} value={ref.snapshot_id || ''}
                    options={[{ value: '', label: 'Parent prefix tags' }, ...Object.values(library.snapshots || {}).filter(variant => variant.prefix_id === ref.id)
                        .map(variant => ({ value: variant.id, label: (variant.name || 'Snapshot') + ' · ' + variant.id.slice(0, 8) }))]}
                    onChange={id => changePrefixes(index, current => current.prefixes.map(item => item.id === ref.id ? {...(sourcePrefixRecipe(library, ref.id, id || undefined)||item),positive_enabled:item.positive_enabled,negative_enabled:item.negative_enabled} : item))} />
                <Checkbox aria-label={'Use prefix positive '+index+' '+ref.id} checked={row.usePositive&&ref.positive_enabled!==false} onChange={event=>togglePrefix(index,ref.id,'positive',event.target.checked)}>Positive</Checkbox>
                <Checkbox aria-label={'Use prefix negative '+index+' '+ref.id} checked={row.useNegative&&ref.negative_enabled!==false} onChange={event=>togglePrefix(index,ref.id,'negative',event.target.checked)}>Negative</Checkbox>
            </Space>)}
            <Button size="small" onClick={()=>enableSides(index,['positive','negative'])}>Load both prompts</Button>
            <Space><Checkbox checked={row.usePositive} onChange={event => event.target.checked?enableSides(index,['positive']):update(index,{usePositive:false})}>Load positive prompt</Checkbox><Tag color={row.usePositive?'green':undefined}>{row.usePositive?'Included':'Not used'}</Tag></Space>
            <div data-contribution="positive" data-included={row.usePositive} style={{opacity:row.usePositive?1:.55,width:'100%'}}><TermsEditor value={row.positive} onChange={positive=>update(index,{positive})} suggest={suggest} placeholder={'Positive terms '+index}/></div>
            <Space><Checkbox checked={row.useNegative} onChange={event => event.target.checked?enableSides(index,['negative']):update(index,{useNegative:false})}>Load negative prompt</Checkbox><Tag color={row.useNegative?'orange':undefined}>{row.useNegative?'Included':'Not used'}</Tag></Space>
            <div data-contribution="negative" data-included={row.useNegative} style={{opacity:row.useNegative?1:.55,width:'100%'}}><TermsEditor value={row.negative} onChange={negative=>update(index,{negative})} suggest={suggest} placeholder={'Negative terms '+index}/></div>
            <Typography.Text>Hydrus tags: keep all, remove individual terms, or type @prefix to use the shared tag manager.</Typography.Text>
            <Space><Checkbox checked={row.useTags} onChange={event => update(index, { useTags: event.target.checked })}>Load selected Hydrus tags into the positive prompt</Checkbox><Tag color={row.useTags?'blue':undefined}>{row.useTags?'Included':'Not used'}</Tag></Space>
            <div data-contribution="hydrus" data-included={row.useTags} style={{opacity:row.useTags?1:.55,width:'100%'}}><HydrusTagSelect label={'Image Hydrus tags ' + index} value={row.tags} onChange={tags => update(index, { tags })} /></div>
            <Checkbox checked={row.sync} onChange={event => update(index, { sync: event.target.checked })}>Add these tags to the corresponding Hydrus file</Checkbox>
            <Typography.Text type="secondary">Sync adds tags to your configured service; omitted tags are not deleted remotely.</Typography.Text>
        </Space> }))} style={{ marginTop: 12 }} />
        {notice && <Alert type="success" message={notice} />}{error && <Alert type="error" message={error} />}
    </FloatingPanel>;
}
