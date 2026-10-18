import {useId,useState} from 'react';
import {RuleOperation} from './RuleOperation';
import { HAIR_ATTRIBUTES, hairAttributeTags, cleanHairPolicy, hairWarnings, hairFilterSummary, type HairPolicy } from './HairPolicy';

export function HairReview({ text, policy, resolved = false }: { text: string; policy?: HairPolicy; resolved?: boolean }) {
    const warnings = hairWarnings(text, policy);
    return warnings.length ? <details aria-label={resolved ? "Last encoded hair review" : "Hair prompt review"} style={{ fontSize: 12, padding: 6 }}><summary>{resolved ? 'Last encoded hair' : 'Hair'} · {warnings.length} check(s)</summary>{warnings.map(message => <p key={message}>{message}</p>)}</details> : null;
}
export function HairControls({ value, onChange, onRemove, template = '' }: { value?: HairPolicy; onChange: (value: HairPolicy) => void; onRemove?:()=>void; template?: string }) {
    const policy = cleanHairPolicy(value), summary = hairFilterSummary(template, policy);
    const [collapsed,setCollapsed]=useState(false),bodyId=useId();
    return <fieldset aria-label="Hair prompting" className="cg-rule-controls cg-rule-box">
        <legend>Hair prompting</legend>
        <div className="cg-rule-toolbar"><button type="button" aria-label={collapsed?"Expand hair prompting":"Collapse hair prompting"} aria-expanded={!collapsed} aria-controls={bodyId} title={collapsed?"Expand":"Collapse"} onClick={()=>setCollapsed(!collapsed)}>{collapsed?"▸":"▾"}</button>{onRemove&&<button type="button" aria-label="Remove hair prompting" title="Remove hair prompting" onClick={onRemove}>×</button>}</div>
        <div id={bodyId} hidden={collapsed}>
        <label className="cg-rule-toolbar">Hair mode <select aria-label="Hair mode" value={policy.mode} onChange={event => onChange({ ...policy, mode: event.target.value as HairPolicy['mode'] })}>
            <option value="specific">Specific hairstyle · keep supplied tags</option><option value="natural">Natural variation · omit known hair tags</option><option value="minimal">Minimal direction · keep selected attributes</option>
        </select></label>
        {policy.mode==='minimal'&&<label className="cg-rule-toolbar">Attribute combination <select aria-label="Hair attribute combination" value={policy.attributeMode||'all'} onChange={event=>onChange({...policy,attributeMode:event.target.value==='one'?'one':undefined})}><option value="all">AND · keep every checked attribute</option><option value="one">EITHER · keep one checked attribute per run</option></select>{policy.attributeMode==='one'&&<small>Sampled once per queued prompt. Preview shows possible tags.</small>}</label>}
        {policy.mode === 'minimal' && <div>{HAIR_ATTRIBUTES.map(attribute => <div className="cg-rule-preference" key={attribute} aria-label={'Hair attribute '+attribute}>
            <label><input type="checkbox" aria-label={'Keep hair ' + attribute} checked={policy.attributes.includes(attribute)} onChange={event => onChange({ ...policy, attributes: event.target.checked ? [...policy.attributes, attribute] : policy.attributes.filter(key => key !== attribute) })} />{attribute}</label>
            <RuleOperation rule={{op:'exclude',tags:hairAttributeTags(attribute)}} template={template} keep={policy.attributes.includes(attribute)}/>
        </div>)}</div>}
        {policy.mode==='natural'&&<RuleOperation rule={{op:'exclude',tags:HAIR_ATTRIBUTES.flatMap(hairAttributeTags)}} template={template}/>}
        {policy.mode==='specific'&&<code className="cg-rule-operation">T′ = T</code>}
        {policy.mode !== 'specific' && <div aria-label="Hair filtering summary" role="status">
            {summary.omitted.length} recognised hair term(s) omitted from the prompt template; {summary.retained.length} retained. Box counts show saved tags and stay unchanged.
            <small style={{display:'block'}}>Optional choices are sampled when queued. Check “Last encoded prompt” after a run for the actual tags used.{summary.incomplete ? ' Summary is incomplete for this large or deeply nested prompt.' : ''}</small>
        </div>}
        <div className="cg-rule-preference"><label><input type="checkbox" aria-label="Single-colour hairstyle" checked={policy.singleColour === true} onChange={event => onChange({ ...policy, singleColour: event.target.checked })} /> Single-colour hairstyle (warn only)</label>
        {policy.singleColour&&<RuleOperation rule={{op:'exclusive',tags:hairAttributeTags('colour')}} template={template} warning/>}</div>
        </div>
    </fieldset>;
}
