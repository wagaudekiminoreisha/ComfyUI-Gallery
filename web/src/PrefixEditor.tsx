import {promptLeaves} from './RuleImpact';
import {SnapshotRail} from './SnapshotRail';
import {PrefixRulesEditor} from './PrefixRulesEditor';
import {capturePrefixSnapshot} from './PrefixLibrary';
import {rulesRequest} from './RulesLibrary';
import {openRules} from './RulesLibrary';
import { DeletePrefixButton } from './DeletePrefixButton';
import type { PrefixDraft } from './UnsavedPrefix';
import { useEffect,useState, type Dispatch, type SetStateAction } from 'react';
import { Button, Input, Select, Space, Tabs, Typography, message } from 'antd';
import { TermsEditor } from './PromptBoxEditor';
import { makeSuggest } from './PromptSuggest';
import { PrefixImageGrid, PrefixImages, seedImages } from './PrefixImages';
import { expandPrefix, loadPrefixes, matchesPolarity, POLARITY_OPTIONS, sidesLabel, type PrefixImage, type PrefixPolarity, type PrefixSeed, type SharedLibrary } from './PrefixLibrary';

/**
 * One place to pick, create, edit and save a prefix. Positive and negative terms get their own tab,
 * clearing is per side, and the image the prefix is being made from stays visible beside the terms.
 * Spelling (spaces vs underscores) is a gallery setting applied on save, not a checkbox here.
 */
/** Suggestions for the term editors: saved prefixes, library tags and the Danbooru dictionary. */
const suggest = makeSuggest({ loadLibrary: loadPrefixes, expandPrefix });

export function PrefixEditor({ onLoad, shared, seed, active, name, setName, positive, setPositive, negative, setNegative, saving, onSave, onDelete, onAppendToNode, onOpenLibrarySearch, onOpenPrompts, onUnpair }: {
    onLoad: (draft: PrefixDraft) => void;
    shared: SharedLibrary; seed: PrefixSeed; active: boolean;
    name: string; setName: (value: string) => void;
    positive: string[]; setPositive: Dispatch<SetStateAction<string[]>>;
    negative: string[]; setNegative: Dispatch<SetStateAction<string[]>>;
    saving: boolean; onSave: () => void; onDelete: (id: string) => Promise<void>;
    onAppendToNode?: (id: string) => void; onOpenLibrarySearch: () => void;
    onOpenPrompts?: () => void; onUnpair?: (image: PrefixImage) => void;
}) {
    const [snapshot,setSnapshot]=useState<string|undefined>(seed.snapshotId);
    const existing = shared.prefixes.find(prefix => prefix.name.toLowerCase() === name.trim().toLowerCase());
    const [polarity, setPolarity] = useState<PrefixPolarity>('all');
    useEffect(()=>{setSnapshot(seed.snapshotId);if(seed.snapshotId){const row=shared.snapshots?.[seed.snapshotId];if(row){const positive=seed.positive||row.terms,negative=seed.negative||row.negative_terms;onLoad({name:seed.name||name,positive,negative});setPositive(positive);setNegative(negative);}}},[seed]);
    const sources = seedImages(seed.imageRefs);
    const load = (id?: string) => {
        const prefix = shared.prefixes.find(value => value.id === id);
        if (!prefix) return;
        setSnapshot(undefined);onLoad({ name: prefix.name, positive: expandPrefix(shared, '@' + prefix.name), negative: prefix.negative_terms || [] });
        setName(prefix.name); setPositive(expandPrefix(shared, '@' + prefix.name)); setNegative(prefix.negative_terms || []);
    };
    const add = (side: 'positive' | 'negative' | 'hydrus') => (side === 'negative' ? setNegative : setPositive)(old => Array.from(new Set([...old, ...(seed[side] || [])])));
    return <div className="cg-prefix-editor" style={{ border: '1px solid #8884', borderRadius: 8, padding: 10 }}>
        <SnapshotRail prefixId={existing?.id} selected={snapshot} onSelect={row=>{const positive=row?.terms||expandPrefix(shared,'@'+existing!.name),negative=row?.negative_terms||existing!.negative_terms||[];onLoad({name,positive,negative});setSnapshot(row?.id);setPositive(positive);setNegative(negative);}}/>
        <Typography.Text strong>Prefix editor{snapshot?' · snapshot '+snapshot.slice(0,8):''}</Typography.Text>
        <Button disabled={!existing} onClick={()=>openRules(snapshot?'snapshot:'+snapshot:existing?.id)}>Prefix rules…</Button>
        {!!seed.imageKeys?.length && <Typography.Paragraph style={{ margin: '4px 0 0' }}>Saving pairs this prefix with the selected image(s). Its terms will be enabled when you append them to a workflow.</Typography.Paragraph>}
        <Space wrap style={{ marginTop: 8, width: '100%' }}>
            <Select aria-label="Prefix polarity filter" value={polarity} onChange={setPolarity} options={POLARITY_OPTIONS} style={{ width: 190 }} />
            <Select showSearch optionFilterProp="label" aria-label="Existing prefix" placeholder="Load an existing prefix…" value={existing?.id} onChange={load} style={{ minWidth: 240 }}
                options={shared.prefixes.filter(prefix => matchesPolarity(prefix, polarity)).map(prefix => ({ value: prefix.id, label: prefix.name + ' · ' + sidesLabel(prefix) }))} notFoundContent={shared.prefixes.length ? 'No prefix matches this filter' : 'No saved prefixes yet'} />
            <Button onClick={() => { onLoad({ name: '', positive: [], negative: [] }); setSnapshot(undefined);setName(''); setPositive([]); setNegative([]); }}>New prefix</Button>
            <Input disabled={!!snapshot} aria-label="Prefix name" placeholder="Prefix name (an existing name updates it)" value={name} onChange={event => setName(event.target.value)} style={{ width: 280 }} />
            <Button type="primary" loading={saving} disabled={!name.trim() || (!positive.length && !negative.length)} onClick={()=>{if(!snapshot){onSave();return;}void (async()=>{try{const rules=(await rulesRequest()).library.prefixes['snapshot:'+snapshot]||shared.snapshots?.[snapshot]?.rules||[];const id=await capturePrefixSnapshot({prefix_id:existing!.id,terms:positive,negative_terms:negative,rules,hair_policy:shared.snapshots?.[snapshot]?.hair_policy,image_keys:[...new Set([...Object.keys(shared.snapshots?.[snapshot]?.members||{}),...(seed.imageKeys||[])])],image_refs:{...shared.snapshots?.[snapshot]?.members,...seed.imageRefs}});setSnapshot(id||undefined);onLoad({name,positive,negative});message.success('Snapshot saved; parent prefix unchanged.');}catch(error){message.error(String(error));}})();}}>{snapshot?'Save snapshot':'Save prefix'}</Button>
            {existing && onAppendToNode && <Button onClick={() => {if(snapshot&&seed.node?.__galleryPromptBoxes){seed.node.__galleryPromptBoxes.insert(positive.join(', '),'after',existing.name,existing.id,snapshot);}else onAppendToNode(existing.id);}}>Append to node</Button>}
            {existing&&!snapshot && <DeletePrefixButton id={existing.id} name={existing.name} onDelete={onDelete} />}
            <Button type="link" onClick={onOpenLibrarySearch}>Library search…</Button>
            {onOpenPrompts && <Button type="link" onClick={onOpenPrompts}>Prompts & palette…</Button>}
        </Space>
        <Typography.Text type="secondary" style={{ display: 'block', margin: '4px 0 8px' }}>{snapshot?'Saving creates or reuses a snapshot; the parent prefix stays unchanged.':existing ? 'Saving updates “' + existing.name + '”.' : name.trim() ? 'Saving creates a new prefix.' : 'Name the prefix to save it.'} Tag spelling follows Settings.</Typography.Text>
        <PrefixRulesEditor bindingId={snapshot?'snapshot:'+snapshot:existing?.id} name={snapshot?'snapshot '+snapshot.slice(0,8):name} fallback={snapshot?shared.snapshots?.[snapshot]?.rules:undefined} template={positive.join(', ')}/>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div style={{ flex: '1 1 420px', minWidth: 0 }}>
                <Tabs size="small" items={[
                    { key: 'positive', label: 'Positive terms (' + promptLeaves(positive.join(', ')).length + ')', children: <Space direction="vertical" style={{ width: '100%' }}>
                        {(!!seed.positive || !!seed.hydrus) && <Space wrap>{(['positive', 'hydrus'] as const).map(side => <Button key={side} disabled={!seed[side]?.length} onClick={() => add(side)}>Add image {side} ({seed[side]?.length || 0})</Button>)}</Space>}
                        <TermsEditor clothingReview value={positive} onChange={terms => setPositive(terms)} suggest={suggest} placeholder="Terms: tags, {a|} or a OPT, a OR b, (tag:0.5), @prefix" />
                        <Button size="small" disabled={!positive.length} onClick={() => setPositive([])}>Clear positive terms</Button>
                    </Space> },
                    { key: 'negative', label: 'Negative terms (' + promptLeaves(negative.join(', ')).length + ')', children: <Space direction="vertical" style={{ width: '100%' }}>
                        {!!seed.negative && <Button disabled={!seed.negative.length} onClick={() => add('negative')}>Add image negative ({seed.negative.length})</Button>}
                        <TermsEditor value={negative} onChange={terms => setNegative(terms)} suggest={suggest} placeholder="Negative terms (kept separate from the positive ones)" />
                        <Button size="small" disabled={!negative.length} onClick={() => setNegative([])}>Clear negative terms</Button>
                    </Space> },
                ]} />
            </div>
            <div style={{ flex: '0 0 250px', minWidth: 0 }}>
                <Typography.Text strong>{sources.length ? 'Source image' + (sources.length > 1 ? 's' : '') : 'Source image'}</Typography.Text>
                {sources.length ? <PrefixImageGrid images={sources} /> : <Typography.Text type="secondary" style={{ display: 'block' }}>None attached. Open this editor from an image in the viewer to pair the image with the prefix.</Typography.Text>}
                {existing&&snapshot&&<PrefixImageGrid images={Object.values(shared.snapshots?.[snapshot]?.members||{})}/>}
                {existing&&!snapshot && <PrefixImages library={shared} prefixId={existing.id} defaultOpen onRemove={onUnpair} />}
            </div>
        </div>
    </div>;
}
