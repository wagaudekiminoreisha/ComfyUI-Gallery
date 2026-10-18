import { HAIR_ATTRIBUTES, cleanHairPolicy, hairWarnings, hairFilterSummary, type HairPolicy } from './HairPolicy';

export function HairReview({ text, policy, resolved = false }: { text: string; policy?: HairPolicy; resolved?: boolean }) {
    const warnings = hairWarnings(text, policy);
    return warnings.length ? <details aria-label={resolved ? "Last encoded hair review" : "Hair prompt review"} style={{ fontSize: 12, padding: 6 }}><summary>{resolved ? 'Last encoded hair' : 'Hair'} · {warnings.length} check(s)</summary>{warnings.map(message => <p key={message}>{message}</p>)}</details> : null;
}
export function HairControls({ value, onChange, template = '' }: { value?: HairPolicy; onChange: (value: HairPolicy) => void; template?: string }) {
    const policy = cleanHairPolicy(value);
    const summary = hairFilterSummary(template, policy);
    return <details aria-label="Hair prompting" style={{ fontSize: 12, padding: 6, border: '1px solid var(--border-color, #555)', borderRadius: 6 }}>
        <summary>Hair prompting · {policy.mode === 'specific' ? 'Specific hairstyle' : policy.mode === 'natural' ? 'Natural variation' : 'Minimal direction'}</summary>
        <label>Hair mode <select aria-label="Hair mode" value={policy.mode} onChange={event => onChange({ ...policy, mode: event.target.value as HairPolicy['mode'] })}>
            <option value="specific">Specific hairstyle · keep supplied tags</option><option value="natural">Natural variation · omit known hair tags</option><option value="minimal">Minimal direction · keep selected attributes</option>
        </select></label>
        {policy.mode === 'minimal' && <div>{HAIR_ATTRIBUTES.map(attribute => <label key={attribute} style={{ display: 'inline-block', margin: 4 }}><input type="checkbox" aria-label={'Keep hair ' + attribute} checked={policy.attributes.includes(attribute)} onChange={event => onChange({ ...policy, attributes: event.target.checked ? [...policy.attributes, attribute] : policy.attributes.filter(key => key !== attribute) })} />{attribute}</label>)}</div>}
        <p>{policy.mode === 'specific' ? 'Only supplied tags are used; missing attributes stay unspecified.' : 'Filters known scalp-hair tags from these boxes and the connected source. Original tags stay saved; accessories, body hair and unknown terms stay unchanged.'}</p>
        {policy.mode !== 'specific' && <div aria-label="Hair filtering summary" role="status">
            {summary.omitted.length} recognised hair term(s) omitted from the prompt template; {summary.retained.length} retained. Box counts show saved tags and stay unchanged.
            <small style={{display:'block'}}>Optional choices are sampled when queued. Check “Last encoded prompt” after a run for the actual tags used.{summary.incomplete ? ' Summary is incomplete for this large or deeply nested prompt.' : ''}</small>
            {!!summary.omitted.length && <details><summary>Omitted hair terms</summary>{summary.omitted.map(tag=>tag.replace(/_/g,' ')).join(', ')}</details>}
        </div>}
        <label><input type="checkbox" aria-label="Single-colour hairstyle" checked={policy.singleColour === true} onChange={event => onChange({ ...policy, singleColour: event.target.checked })} /> Single-colour hairstyle (warn only)</label>
    </details>;
}
