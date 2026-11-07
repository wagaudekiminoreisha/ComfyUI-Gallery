import type { ImageSourceImage } from './ImageSourceGeometry';
import type { PrefixLibrary } from './PrefixLibrary';
import { associationPrefixIds } from './PrefixAssociations';
import { splitTop } from './PromptBoxes';

type Side = 'positive' | 'negative';
export type SourcePrefix = {
    id: string;
    name?: string;
    snapshot_id?: string;
    positive: string[];
    negative: string[];
    positive_enabled?: boolean;
    negative_enabled?: boolean;
};

const key = (text: string) => text.trim().toLowerCase().replace(/_/g, ' ').replace(/\s+/g, ' ');
const terms = (values: string[] = []) => values.flatMap(text => text.split(/\n+/).flatMap(line => splitTop(line, ','))).map(text => text.trim()).filter(Boolean);

export function sourcePrefixRefs(metadata?: Record<string, any>): SourcePrefix[] {
    const rows = metadata?.gallery_prefixes ?? [metadata?.gallery_prefix];
    return Array.isArray(rows) ? rows.filter(row => typeof row?.id === 'string') : [];
}

export function sourcePrefixMetadata(refs: SourcePrefix[]) {
    return { gallery_prefix: refs.length === 1 ? refs[0] : undefined, gallery_prefixes: refs.length === 1 ? undefined : refs };
}

export function sourcePrefixRecipe(library: PrefixLibrary, id: string, snapshotId?: string): SourcePrefix | undefined {
    const prefix = library.prefixes.find(item => item.id === id);
    if (!prefix) return;
    const snapshot = snapshotId ? library.snapshots?.[snapshotId] : undefined;
    return {
        id, name: prefix.name, snapshot_id: snapshotId,
        positive: terms(snapshot?.terms ?? prefix.tags.map(tagId => library.tags.find(tag => tag.id === tagId)?.text || '')),
        negative: terms(snapshot?.negative_terms ?? prefix.negative_terms),
    };
}

export function sourcePrefixTerms(image: ImageSourceImage, ref: SourcePrefix, side: Side) {
    const current = terms([image.prompt?.[side] || '']);
    if (sourcePrefixRefs(image.metadata).length < 2) return current;
    if (ref[`${side}_enabled`] === false) return [];
    const recipe = new Set(terms(ref[side]).map(key));
    return current.filter(text => recipe.has(key(text)));
}

export function mergeSourcePrefixTerms(current: string[], previous: SourcePrefix[], next: SourcePrefix[], side: Side) {
    const enabled = (ref: SourcePrefix) => ref[`${side}_enabled`] !== false;
    const contributions = (ref: SourcePrefix) => enabled(ref) ? terms(ref[side]) : [];
    const known = new Map(current.map(text => [key(text), text]));
    const previousKeys = new Set(previous.flatMap(contributions).map(key));
    const nextTerms = next.flatMap(ref => {
        const old = previous.find(item => item.id === ref.id);
        const oldKeys = new Set(old ? contributions(old).map(key) : []);
        return contributions(ref).filter(text => !oldKeys.has(key(text)) || known.has(key(text)));
    });
    const nextKeys = new Set(nextTerms.map(key));
    const kept = current.filter(text => !previousKeys.has(key(text)) || nextKeys.has(key(text)));
    const additions = new Map(nextTerms.filter(text => !known.has(key(text))).map(text => [key(text), text]));
    return [...kept, ...additions.values()];
}

/** Refresh each selected recipe, keeping snapshots, disabled sides, and source-specific edits. */
export function refreshSourcePrefix(image: ImageSourceImage, library: PrefixLibrary, url?: string): ImageSourceImage {
    const previous = sourcePrefixRefs(image.metadata);
    let selected = previous;
    url ||= image.metadata?.gallery_url;
    if (!previous.length && !Array.isArray(image.metadata?.gallery_prefixes)) {
        const hash = /([a-f0-9]{64})/i.exec(image.input_name)?.[1]?.toLowerCase();
        const pairs = Object.entries(library.associations || {}).filter(([id, item]) =>
            (hash && (id === 'sha256:' + hash || item.image?.hash?.toLowerCase() === hash)) ||
            (url && id.startsWith('local:') && id.endsWith(':' + url)));
        selected = [...new Set(pairs.flatMap(([, item]) => associationPrefixIds(item)))].flatMap(id => {
            const recipe = sourcePrefixRecipe(library, id);
            return recipe ? [recipe] : [];
        });
        url ||= pairs.find(([, item]) => item.image?.local_url)?.[1].image?.local_url;
        if (!selected.length) return image;
    }
    if (!selected.length) return image;
    const next = selected.flatMap(old => {
        const recipe = sourcePrefixRecipe(library, old.id, old.snapshot_id);
        if (!recipe) return [];
        // Keep a workflow's frozen recipe even if its snapshot isn't available on this installation.
        const saved = old.snapshot_id && !library.snapshots?.[old.snapshot_id] ? old : recipe;
        return [{ ...old, ...saved }];
    });
    const surviving = previous.filter(old => next.some(ref => ref.id === old.id));
    const update = (side: Side) => {
        const value = image.prompt?.[side] || '';
        const current = terms([value]);
        const updated = mergeSourcePrefixTerms(current, surviving, next, side);
        return current.length === updated.length && current.every((text, index) => text === updated[index]) ? value : updated.join(', ');
    };
    return {
        ...image,
        metadata: { ...image.metadata, ...(url ? { gallery_url: url } : {}), ...sourcePrefixMetadata(next) },
        prompt: { positive: update('positive'), negative: update('negative'), tags: image.prompt?.tags || [] },
    };
}
