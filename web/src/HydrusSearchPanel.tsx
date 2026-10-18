import { useState } from 'react';
import { Button, InputNumber, Select, Space, Typography, Modal, Tag } from 'antd';
import { HydrusTagSelect } from './HydrusTagSelect';
import { BASE_Z_INDEX } from './ComfyAppApi';

export function HydrusSearchPanel({ localSuggestions, tags, setTags, match, setMatch, limit, setLimit, busy, disabled, configured, scope, onSearch, inputRef, orGroups, setOrGroups, sortType, setSortType, ascending, setAscending }: {
    localSuggestions?: string[];
    tags: string[]; setTags: (tags: string[]) => void; match: 'all' | 'any'; setMatch: (match: 'all' | 'any') => void;
    limit: number; setLimit: (limit: number) => void; busy: boolean; disabled: boolean; configured: boolean; scope: string;
    orGroups: string[][]; setOrGroups: (groups: string[][]) => void; sortType: number; setSortType: (value: number) => void; ascending: boolean; setAscending: (value: boolean) => void;
    onSearch: () => void; inputRef: React.RefObject<any>;
}) {
    const [editing, setEditing] = useState<number | null>(null);
    const [draft, setDraft] = useState<string[]>([]);
    const commitGroup = () => {
        if (!draft.length || editing === null) return;
        setOrGroups(editing === orGroups.length ? [...orGroups, draft] : orGroups.map((old, i) => i === editing ? draft : old));
        setEditing(null);
    };
    return <div data-image-search-drop title="Drop an image here to search by provenance">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
            <HydrusTagSelect preservePrefixes localSuggestions={localSuggestions} inputRef={inputRef} label="Hydrus search tags" value={tags} onChange={setTags} disabled={busy || disabled} onSubmit={onSearch} onChooseAll={() => setMatch('any')} style={{ flex: '1 1 340px', minWidth: 180 }} />
            {orGroups.map((group, index) => <Tag key={index} closable onClose={() => setOrGroups(orGroups.filter((_, i) => i !== index))} style={{ maxWidth: 230, cursor: 'pointer', padding: '6px 8px' }} title={group.join(' OR ')}>
                <span role="button" tabIndex={0} aria-label={'Edit OR group ' + (index + 1)} onClick={() => { setDraft(group); setEditing(index); }} onKeyDown={event => { if (event.key === 'Enter') { setDraft(group); setEditing(index); } }} style={{ display: 'inline-block', maxWidth: 185, overflow: 'hidden', textOverflow: 'ellipsis', verticalAlign: 'bottom' }}>AND ({group.join(' OR ')})</span>
            </Tag>)}
            <Button disabled={busy || disabled || orGroups.length >= 20} onClick={() => { setDraft([]); setEditing(orGroups.length); }}>Add OR group</Button>
            <Select aria-label="Tag match mode" value={match} onChange={setMatch} disabled={busy || disabled} style={{ width: 145 }} options={[{ value: 'all', label: 'All tags (AND)' }, { value: 'any', label: 'Any tag (OR)' }]} />
            <InputNumber aria-label="Search page size" min={1} max={200} value={limit} onChange={value => setLimit(value || 100)} disabled={busy || disabled} />
            <Button aria-label="Search" type="primary" disabled={!configured || disabled} loading={busy} onClick={onSearch}>Search</Button>
        </div>
        <Typography.Paragraph type="secondary">Enter adds a tag; Enter on an empty input searches. Counts are from your Hydrus database's local-file domain. Click an OR chip to edit its alternatives.</Typography.Paragraph>
        <Modal title="OR tag group" open={editing !== null} onCancel={() => setEditing(null)} onOk={commitGroup} okText="Apply OR group" okButtonProps={{ disabled: !draft.length }} zIndex={BASE_Z_INDEX + 30} width={600}>
            <Typography.Paragraph>Any tag in this group can match. This group is ANDed with the other search chips.</Typography.Paragraph>
            <HydrusTagSelect preservePrefixes localSuggestions={localSuggestions} label="OR group tags" value={draft} onChange={setDraft} active={editing !== null} onSubmit={commitGroup} />
        </Modal>

    </div>;
}
