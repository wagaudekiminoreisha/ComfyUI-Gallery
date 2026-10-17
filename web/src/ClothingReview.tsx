import { useMemo } from 'react';
import { reviewClothing } from './ClothingRules';

/** Shared by positive prefix editing and encoder preview; never rewrites the user's prompt. */
export function ClothingReview({ text }: { text: string }) {
    const review = useMemo(() => reviewClothing(text), [text]);
    if (!review.findings.length && !review.incomplete) return null;
    const checks = review.findings.filter(item => item.level === 'check').length;
    return <details aria-label="Clothing review" style={{ fontSize: 12, padding: 6, border: '1px solid var(--border-color, #555)', borderRadius: 6 }}>
        <summary style={{ cursor: 'pointer' }}>Clothing review · {checks ? `${checks} combination${checks === 1 ? '' : 's'} to clarify` : review.findings.length ? 'layered outfit' : 'incomplete'}</summary>
        <p>Checks apply only if garments describe the same wearer. Alternative branches are checked separately. Tags stay enabled.</p>
        {review.findings.map(item => <div key={item.id} style={{ marginBottom: 8 }}>
            <div>{item.message}</div>
            {item.suggestion && <div style={{ opacity: .75 }}>{item.suggestion}</div>}
        </div>)}
        {review.incomplete && <p role="status">This prompt exceeds the clothing review limit; the review is incomplete.</p>}
        <small>Starter clothing dictionary. Unrecognised tags and relationships have not been assessed.</small>
    </details>;
}
