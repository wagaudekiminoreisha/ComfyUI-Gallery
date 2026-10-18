import {loadPrefixes,type SharedLibrary} from './PrefixLibrary';
import {findLineage,imagePrefixIds,pairedHashIndex} from './PrefixLineage';
import {fetchLocalHashes} from './TagSearchPanel';
import { useViewState } from './ViewState';
import { HydrusTagSelect } from './HydrusTagSelect';
import { useGalleryContext } from './GalleryContext';
import { indexPrompts } from './LocalPromptLibrary';
import type { LocalSearchField } from './LocalImageSearch';
import { useEffect, useMemo, useRef, useState } from 'react';
import { UnifiedGallery } from './UnifiedGallery';
import { Alert, Button, Checkbox, Modal, Select, Space, Spin, Tabs, Tag, Tree } from 'antd';
import { hydrusRequest } from './HydrusApi';
import { HydrusSearchPanel } from './HydrusSearchPanel';
import { useHydrus } from './HydrusContext';
import { appendToImageSource } from './ImageSourceBridge';

export type RemoteImage = { hash: string; file_id: number; mime: string; width: number; height: number; tags?: Record<string, any>; [key: string]: any };
type Page = { page_key: string; name: string; is_media_page: boolean; selected?: boolean; pages?: Page[] };
type Results = { items: RemoteImage[]; total: number; offset?: number;limit?:number;search_id?:string;next_offset?:number|null;page_name?: string; page_state?: number };
type InputCopy = { name: string; subfolder: string; type: string; input_name: string; url: string; hash: string; metadata?: Record<string, any> };

export function HydrusBrowser({ open, source = 'hydrus', searchMode, viewRevision, onSourceChange }: { onSourceChange: (source: string) => void; source?: string; open: boolean; searchMode: string; viewRevision: number }) {
    const gallery = useGalleryContext();
    const hybrid = searchMode === 'both';
    const { settings, setSettingsOpen, reloadMemory } = useHydrus();
    const scope = `${settings?.url}|${settings?.profile}`;
    const viewKey = scope + ':' + searchMode;
    const [shareTags, setShareTags] = useViewState(viewKey, true);
    const [sortRequest, setSortRequest] = useViewState<{ type: number; ascending: boolean; revision: number } | undefined>(viewKey, undefined);
    const [localBranch, setLocalBranch] = useViewState<string[]>(viewKey, []);
    const [fieldJoin, setFieldJoin] = useViewState<'all' | 'any'>(viewKey, 'any');
    const [localField, setLocalField] = useViewState<LocalSearchField>(viewKey, 'positive');
    const [localQuery, setLocalQuery] = useViewState(viewKey, '');
    const [localEditor, setLocalEditor] = useViewState(viewKey, false);
    const localSuggestions = useMemo(() => Array.from(new Set(indexPrompts(gallery.data?.folders || {}).map(item => item.value).concat(Object.values(gallery.localHydrusTags).flat()))), [gallery.data, gallery.localHydrusTags]);
    const [tab, setTab] = useViewState(viewKey, 'search');
    const [tags, setTags] = useViewState<string[]>(viewKey, []);
    const [prefixScope,setPrefixScope]=useState<{library:SharedLibrary;ids:string[];hashes:Map<string,Set<string>>}>();
    const prefixNames=tags.filter(tag=>tag.startsWith('@'));
    const searchTags=tags.filter(tag=>!tag.startsWith('@'));
    useEffect(()=>{let live=true;const run=async()=>{if(!prefixNames.length){if(prefixScope)gallery.setLocalScope(null);setPrefixScope(undefined);return;}const library=await loadPrefixes(),ids=prefixNames.map(name=>library.prefixes.find(prefix=>prefix.name.toLowerCase()===name.slice(1).toLowerCase())?.id||'__unknown__');const hashes=await pairedHashIndex(library,fetchLocalHashes);const files=Object.values(gallery.data?.folders||{}).flatMap(folder=>Object.values(folder));const results=await Promise.all(ids.map(id=>findLineage(files,library,id,fetchLocalHashes)));if(!live)return;const sets=results.map(result=>new Set([...result.paired.map(file=>file.url),...result.generated.map(item=>item.file.url)]));setPrefixScope({library,ids,hashes});gallery.setLocalScope({label:prefixNames.join(' AND '),urls:new Set([...(sets[0]||[])].filter(url=>sets.every(set=>set.has(url))))});};void run().catch(reason=>setError(String(reason)));return()=>{live=false;};},[prefixNames.join('|'),gallery.data]);
    const [match, setMatch] = useViewState<'all' | 'any'>(viewKey, 'all');
    const [limit, setLimit] = useViewState(viewKey, 100);
    const [orGroups, setOrGroups] = useViewState<string[][]>(viewKey, []);
    const [sortType, setSortType] = useViewState(viewKey, 2);
    const [ascending, setAscending] = useViewState(viewKey, false);
    const [pages, setPages] = useViewState<Page[]>(viewKey, []);
    const [pageKey, setPageKey] = useViewState(viewKey, '');
    const [result, setResult] = useViewState<Results | undefined>(viewKey, undefined);
    const [selected, setSelected] = useViewState<string[]>(viewKey, []);
    const [copies, setCopies] = useViewState<Record<string, InputCopy>>(viewKey, {});
    const [busy, setBusy] = useState(false);
    const [copying, setCopying] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [notice, setNotice] = useViewState(viewKey, '');
    const [error, setError] = useViewState(viewKey, '');
    const [progress, setProgress] = useState('');
    const [loadingMore,setLoadingMore]=useState(false);
    const activeRequest=useRef<{kind:'search'|'page';payload:Record<string,unknown>;version:number}|undefined>(undefined);
    const moreInFlight=useRef(false),moreFailed=useRef(false);
    const requestVersion = useRef(0);
    const lastSampling = useRef<Record<string, string>>({});
    const cancelCopies = useRef(false);
    const cancelDownloads = useRef(false);
    const actionBusy = useRef(false);
    const searchRef = useRef<any>(null);
    const working = copying || downloading;
    useEffect(() => {
        requestVersion.current++; setResult(undefined); setSelected([]); setPages([]); setPageKey(''); setCopies({}); setBusy(false);
    }, [scope]);
    useEffect(() => { if (!open) { requestVersion.current++; cancelCopies.current = true; cancelDownloads.current = true; setBusy(false); } }, [open]);

    useEffect(() => { requestVersion.current++; setBusy(false); }, [viewRevision]);
    const localCount = gallery.imagesDetailsList.filter(file => !['divider', 'empty-space'].includes(file.type)).length;


    const read = async (kind: 'search' | 'pages' | 'page', key = pageKey, offset = 0) => {
        const version = ++requestVersion.current;moreFailed.current=false;setLoadingMore(false);activeRequest.current=undefined;
        setBusy(true); setError(''); setNotice('');
        if (kind !== 'pages') { setResult(undefined); setSelected([]); }
        if (kind === 'search') {
            gallery.setLibrarySearch(hybrid ? { tags:searchTags, match, orGroups, share: shareTags, localTerms: localBranch, localField, fieldJoin } : null);
            gallery.setSearchFileName(''); gallery.setLocalTerms([]);
            onSourceChange(hybrid ? 'both' : 'hydrus');
        }
        try {
            if (kind === 'pages') {
                const data = await hydrusRequest<{ pages: Page }>('pages', {});
                if (version !== requestVersion.current) return;
                setPages(data.pages?.pages || (data.pages?.is_media_page ? [data.pages] : []));
            } else {
                const payload=kind === 'search' ? { tags:searchTags, match, limit, metadata_terms: localBranch, metadata_field: localField, field_join: fieldJoin, or_groups: orGroups, file_sort_type: sortType, file_sort_asc: ascending, expand_danbooru_aliases: gallery.settings.hydrusSearchAliases !== false } : { page_key: key, offset, limit };
                activeRequest.current={kind:kind as 'search'|'page',payload,version};
                const data = !settings?.has_access_key && kind==='search'?{items:[],total:0}:await hydrusRequest<Results>(kind,payload);
                if (version !== requestVersion.current) return;
                setResult(data); reloadMemory();
                if (kind === 'search') {
                    const sampling = `${sortType}:${ascending}`;
                    if (sampling !== (lastSampling.current[viewKey] || '2:false') || sortType === 4) setSortRequest({ type: sortType, ascending, revision: version });
                    lastSampling.current[viewKey] = sampling;
                }
                else { onSourceChange(searchMode); }
            }
        } catch (reason) { if (version === requestVersion.current) setError(reason instanceof Error ? reason.message : String(reason)); }
        finally { if (version === requestVersion.current) setBusy(false); }
    };
    const nextOffset=result?.next_offset!==undefined?result.next_offset:result&&(result.offset||0)+(result.limit||limit)<result.total?(result.offset||0)+(result.limit||limit):null;
    const loadMore=async(force=false)=>{
        const request=activeRequest.current;if(!open||busy||moreInFlight.current||nextOffset===null||!request||request.version!==requestVersion.current||moreFailed.current&&!force)return;
        moreInFlight.current=true;moreFailed.current=false;setLoadingMore(true);setError('');
        try{
            const page=await hydrusRequest<Results>(request.kind,{...request.payload,offset:nextOffset,...(result?.search_id?{search_id:result.search_id}:{})});
            if(request.version!==requestVersion.current)return;
            setResult(previous=>previous?{...page,items:[...new Map([...previous.items,...page.items].map(item=>[item.hash,item])).values()]}:page);reloadMemory();
        }catch(error){if(request.version===requestVersion.current){moreFailed.current=true;setError(String(error));}}
        finally{moreInFlight.current=false;setLoadingMore(false);}
    };
    const changeTab = (value: string) => {
        requestVersion.current++; setBusy(false); setTab(value); setResult(undefined); setSelected([]); setError('');
        if (value === 'pages') void read('pages');
    };
    const copy = async (hashes: string[], useWorkflow = false) => {
        if (actionBusy.current) return;
        if (useWorkflow && hashes.length > 32) { setError('Select at most 32 images to append to a node.'); return; }
        actionBusy.current = true;
        setCopying(true); setError(''); setNotice(''); cancelCopies.current = false;
        let completed = 0;
        const inputs: InputCopy[] = [];
        const failures: string[] = [];
        try {
            for (const hash of hashes) {
                if (cancelCopies.current) break;
                setProgress(`Copying ${completed + failures.length + 1} of ${hashes.length}`);
                try {
                    const input = copies[hash] || await hydrusRequest<InputCopy>('import', { hash });
                    setCopies(previous => ({ ...previous, [hash]: input }));
                    completed++;
                    if (useWorkflow) inputs.push(input);
                } catch (reason) { failures.push(`${hash.slice(0, 10)}: ${reason instanceof Error ? reason.message : String(reason)}`); }
            }
            if (useWorkflow && inputs.length) {
                try { setNotice(await appendToImageSource(inputs.map(input => ({ input_name: input.input_name, title: `Hydrus ${input.hash.slice(0, 12)}`, metadata: input.metadata })))); }
                catch (reason) { failures.push(reason instanceof Error ? reason.message : String(reason)); }
            }
            if (!useWorkflow) setNotice(`${completed} image(s) copied into ComfyUI input/hydrus. Use their names in Load Image nodes.`);
            if (failures.length) setError(failures.join('\n'));
        } finally { setCopying(false); setProgress(''); actionBusy.current = false; }
    };
    const download = async (hashes: string[],folder='downloads') => {
        if (!hashes.length || actionBusy.current) return;
        actionBusy.current = true; cancelDownloads.current = false;
        setDownloading(true); setError(''); setNotice('');
        try {
            let completed = 0;
            const failures: string[] = [];
            for (const hash of hashes) {
                if (cancelDownloads.current) break;
                setProgress(`Saving ${completed + 1} of ${hashes.length} to output/${folder}`);
                try { const result = await hydrusRequest<{ warning?: string }>('save_output', { hash, target: scope,folder }); completed++; if (result.warning) failures.push(result.warning); }
                catch (reason) { failures.push(String(reason)); }
            }
            setNotice(`${completed} file(s) saved to ComfyUI output/${folder}.`);
            if (failures.length) setError(failures.join('\n'));
            reloadMemory();void gallery.runAsync().catch(reason=>setError(String(reason)));
        } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
        finally { setDownloading(false); setProgress(''); actionBusy.current = false; }
    };
    const treeData = (list: Page[]): any[] => list.map(page => ({ key: page.page_key,
        title: `${page.name}${page.selected ? ' · active' : ''}`, selectable: page.is_media_page,
        children: page.pages ? treeData(page.pages) : undefined }));
    const items = (result?.items || []).filter(item=>!prefixNames.length||(prefixScope&&prefixScope.ids.every(id=>imagePrefixIds(prefixScope.library,['sha256:'+item.hash],{hydrus:item},prefixScope.hashes).includes(id))));
    return <section className="cg-browser" aria-label="Gallery results">
        <div className="cg-hydrus-search" style={{ display: searchMode === 'local' ? 'none' : undefined }}>
            {!settings?.has_access_key && <Alert type="warning" message="Configure your Hydrus connection first." action={<Button onClick={() => setSettingsOpen(true)}>Open settings</Button>} />}
            <Tabs activeKey={tab} onChange={changeTab} items={[{ key: 'search', label: hybrid ? 'Search both libraries' : 'Search Hydrus', disabled: working }, { key: 'pages', label: 'Open client pages', disabled: working }]} />
            {tab === 'search' ? <>{<Space wrap style={{ marginBottom: 8 }}>{hybrid && <Checkbox checked={shareTags} onChange={event => setShareTags(event.target.checked)}>Match these Hydrus tags against local prompts and cached tags too</Checkbox>}<Button onClick={() => setLocalEditor(true)}>Metadata group{localBranch.length ? ' (' + localBranch.length + ')' : ''}</Button>{!!localBranch.length && <Tag closable onClose={() => setLocalBranch([])} title={localBranch.join(' AND ')}>{localField}: {localBranch.join(' AND ').slice(0, 90)}</Tag>}</Space>}<HydrusSearchPanel localSuggestions={hybrid ? localSuggestions : []} tags={tags} setTags={setTags} match={match} setMatch={setMatch} limit={limit} setLimit={setLimit}
                orGroups={orGroups} setOrGroups={setOrGroups} sortType={sortType} setSortType={setSortType} ascending={ascending} setAscending={setAscending}
                busy={busy} disabled={working} configured={hybrid || !!settings?.has_access_key} scope={scope} onSearch={() => read('search')} inputRef={searchRef} /></> : <>
                <Space wrap><Button loading={busy} disabled={working} onClick={() => read('pages')}>Reload open pages</Button><Button disabled={!pageKey || busy || working} onClick={() => read('page')}>Reload page images</Button><span>Requires Manage Pages permission.</span></Space>
                <Tree style={{ maxHeight: 180, overflow: 'auto' }} key={JSON.stringify(pages)} defaultExpandAll treeData={treeData(pages)} selectedKeys={[pageKey]} disabled={working}
                    onSelect={keys => { if (keys.length) { const key = String(keys[0]); setPageKey(key); void read('page', key); } }} />
            </>}
        </div>
        {result&&<small>{result.items.length} of {result.total} files loaded</small>}
        <Modal title="Metadata search group" open={localEditor} onCancel={() => setLocalEditor(false)} onOk={() => setLocalEditor(false)} okText="Use metadata group" zIndex={3030}>
            <p>Search available prompts, cached Hydrus tags or identifiers. Terms in this group are ANDed. Combine this group with the tag query using AND or OR.</p>
            <Select aria-label="Combine search groups" value={fieldJoin} onChange={setFieldJoin} options={[{value:"any",label:"Tag query OR metadata group"},{value:"all",label:"Tag query AND metadata group"}]} style={{width:"100%",marginBottom:8}} /><Select aria-label="Local group category" value={localField} onChange={setLocalField} options={['all', 'positive', 'negative', 'hydrus', 'name'].map(value => ({ value, label: value === 'hydrus' ? 'Hydrus tag (cached)' : value }))} style={{ width: '100%', marginBottom: 8 }} />
            <HydrusTagSelect label="Local group terms" value={localBranch} onChange={setLocalBranch} localSuggestions={localSuggestions} placeholder="Add a prompt, identifier, or @prefix" />
        </Modal>
        {hybrid && gallery.librarySearch && <Space wrap style={{ marginBottom: 8 }}><small>{localCount} local · {items.length} Hydrus · all loaded folders</small><Button size="small" onClick={() => gallery.setLibrarySearch(null)}>Clear local query</Button></Space>}
        {result && (result as any).metadata_scanned !== undefined && <Alert type="info" message={`Prompt search used ${(result as any).metadata_scanned} indexed Hydrus files. ${(result as any).sampling_fallback ? "This sampling option is unavailable in the cache; import date was used." : ""} ${(result as any).index_status?.last_complete ? "Background index available; results reflect the last refresh." : "Initial indexing is still incomplete; check Hydrus sync and search again as it progresses."}`} />}
        {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 12, whiteSpace: 'pre-wrap' }} />}
        {notice && <Alert type="success" showIcon message={notice} style={{ marginBottom: 12 }} />}
        {(busy || working) && <Space><Spin size="small" /><span aria-live="polite">{progress || 'Searching Hydrus…'}</span>{working && <Button onClick={() => { cancelCopies.current = true; cancelDownloads.current = true; }}>Cancel remaining</Button>}</Space>}
        <UnifiedGallery onNearEnd={()=>void loadMore()} hasMore={nextOffset!==null} loadingMore={loadingMore} onLoadMore={()=>void loadMore(true)} viewKey={viewKey} sortRequest={sortRequest} onTrashed={hashes => setResult(old => old ? { ...old, items: old.items.filter(item => !hashes.includes(item.hash)), total: Math.max(0, old.total - hashes.length) } : old)} source={source} remote={items} selectedRemote={selected} setSelectedRemote={setSelected} copy={copy} download={download} working={working} scope={scope} active={open} />
    </section>;
}
