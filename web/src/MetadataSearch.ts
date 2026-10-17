export type MetadataMatch = { path: string; text: string };

/** Search keys and values across generation metadata, JSON notes and Hydrus snapshots. */
export function findMetadataMatches(metadata: unknown, query: string, limit = 200): { matches: MetadataMatch[]; total: number } {
    const needle = query.trim().toLowerCase(), matches: MetadataMatch[] = [];
    let total = 0;
    if (!needle) return { matches, total };
    const seen = new WeakSet<object>();
    const visit = (value: unknown, path: string, depth: number) => {
        if (depth > 64) return;
        if (typeof value === 'string' && /^[\s]*[\[{]/.test(value)) {
            try { const parsed = JSON.parse(value); if (parsed && typeof parsed === 'object') { visit(parsed, path, depth + 1); return; } } catch { /* Search plain text as written. */ }
        }
        if (value && typeof value === 'object') {
            if (seen.has(value)) return;
            seen.add(value);
            const entries = Object.entries(value);
            if (entries.length) {
                for (const [key, child] of entries) visit(child, Array.isArray(value) ? `${path}[${key}]` : path ? path + '.' + key : key, depth + 1);
                seen.delete(value);
                return;
            }
            seen.delete(value);
        }
        const text = value === undefined ? 'undefined' : typeof value === 'string' ? value : JSON.stringify(value);
        if (path.toLowerCase().includes(needle) || text.toLowerCase().includes(needle)) {
            total++;
            if (matches.length < limit) matches.push({ path: path || '(root)', text });
        }
    };
    visit(metadata, '', 0);
    return { matches, total };
}
