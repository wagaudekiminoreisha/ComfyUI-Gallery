import { useMemo } from 'react';
import { reviewGlobalTags, GLOBAL_TAG_PACK } from './GlobalTagRules';

export function GlobalTagReview({ text }: { text: string }) {
    const review = useMemo(() => reviewGlobalTags(text), [text]);
    if (!text.trim()) return null;
    const checks = review.findings.filter(item=>item.level === 'check');
    const other = review.findings.filter(item=>item.level !== 'check');
    return <details aria-label="Global tag review" style={{ fontSize: 12, padding: 6, border: '1px solid var(--border-color, #555)', borderRadius: 6 }}>
        <summary style={{ cursor: 'pointer' }}>Global rules · {checks.length ? `${checks.length} check${checks.length === 1 ? '' : 's'}` : `${review.recognized} mapped term${review.recognized === 1 ? '' : 's'}`}</summary>
        <p>Alternative branches are checked separately. Warnings assume tags describe the same subject, region or scene where stated. Tags stay enabled.</p>
        {checks.map(item=><div key={item.id} style={{ marginBottom: 8 }}>
            <strong>{item.tags.map(tag=>tag.replace(/_/g,' ')).join(' + ')}</strong>
            <div>{item.message}</div><div style={{ opacity: .75 }}>{item.rationale}</div>
        </div>)}
        {!!other.length && <details><summary>Compatible combinations and context ({other.length})</summary>
            {other.map(item=><p key={item.id}>{item.tags.map(tag=>tag.replace(/_/g,' ')).join(' + ')}: {item.message} {item.rationale}</p>)}
        </details>}
        {!!review.unknown.length && <p>{review.unknown.length} term(s) outside this rule pack: {review.unknown.slice(0,12).map(tag=>tag.replace(/_/g,' ')).join(', ')}{review.unknown.length>12?'…':''}. No compatibility assessment is implied.</p>}
        {review.incomplete && <p role="status">This prompt exceeds the review limit; the review is incomplete.</p>}
        <small>{GLOBAL_TAG_PACK.facets.length} facets · {GLOBAL_TAG_PACK.rules.length} candidate rules · {review.revision}. Advisory rules; the existing Exclusive tags setting remains separate.</small>
    </details>;
}
