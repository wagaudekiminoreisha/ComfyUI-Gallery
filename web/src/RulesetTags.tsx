import { useState } from 'react';
import { ruleTag, type Rule, type Ruleset } from './RuleEngine';
import { LogicBadge } from './LogicBadge';

const actions = {
    exclude: { name: 'EXCLUDE', applied: 'Blocked', exempt: 'Allowed', apply: 'Block', skip: 'Allow' },
    require: { name: 'ADD', applied: 'Required', exempt: 'Optional', apply: 'Require', skip: 'Make optional' },
    select: { name: 'PICK ONE', applied: 'In selection', exempt: 'Exempt', apply: 'Include', skip: 'Exempt' },
    exclusive: { name: 'AT MOST ONE', applied: 'Checked', exempt: 'Ignored', apply: 'Check', skip: 'Ignore' },
    protect: { name: 'PROTECT', applied: 'Protected', exempt: 'Editable', apply: 'Protect', skip: 'Unprotect' },
};

function TagChoices({ rule, onChange }: { rule: Rule; onChange?: (rule: Rule) => void }) {
    const [query, setQuery] = useState('');
    const [limit, setLimit] = useState(80);
    const [newTag, setNewTag] = useState('');
    const [error, setError] = useState('');
    const action = actions[rule.op];
    const tags = [...new Map(rule.tags.map(tag => [ruleTag(tag), tag])).values()];
    const exceptions = new Set(rule.except_tags?.map(ruleTag));
    const exemptCount = tags.filter(tag => exceptions.has(ruleTag(tag))).length;
    const filtered = tags.filter(tag => ruleTag(tag).includes(ruleTag(query)));
    const toggle = (tag: string) => {
        const key = ruleTag(tag);
        const except_tags = exceptions.has(key)
            ? (rule.except_tags || []).filter(value => ruleTag(value) !== key)
            : [...rule.except_tags || [], tag];
        onChange?.({ ...rule, except_tags });
    };
    const add = () => {
        const tag = newTag.trim();
        if (!tag) return;
        if (tag.length > 300 || /[,{}\[\]<>|\n\r]/.test(tag) || tag.startsWith('(')) {
            setError('Enter one literal tag.');
            return;
        }
        if (!tags.some(value => ruleTag(value) === ruleTag(tag)) && rule.tags.length >= 1000) {
            setError('This rule already contains 1,000 tags.');
            return;
        }
        onChange?.({ ...rule,
            tags: tags.some(value => ruleTag(value) === ruleTag(tag)) ? rule.tags : [...rule.tags, tag],
            except_tags: (rule.except_tags || []).filter(value => ruleTag(value) !== ruleTag(tag)),
        });
        setNewTag('');
        setError('');
    };
    return <div className="cg-rule-tag-editor">
        <div className="cg-rule-toolbar"><LogicBadge name={action.name} />
            <small>{action.applied} · {tags.length - exemptCount}　{action.exempt} · {exemptCount}</small>
            {!!onChange && !!exemptCount && <button type="button" onClick={() => onChange({ ...rule, except_tags: [] })}>Reset exceptions</button>}
        </div>
        {rule.op === 'select' && rule.value && exceptions.has(ruleTag(rule.value)) &&
            <small>The fixed value is exempt. This selection step is inactive.</small>}
        <input type="search" aria-label="Search ruleset tags" placeholder="Search tags…" value={query}
            onChange={event => { setQuery(event.target.value); setLimit(80); }} />
        <div className="cg-rule-tag-choices">
            {filtered.slice(0, limit).map(tag => {
                const exempt = exceptions.has(ruleTag(tag));
                const label = tag.replace(/_/g, ' ');
                return <button type="button" key={ruleTag(tag)} disabled={!onChange} aria-pressed={!exempt}
                    aria-label={(exempt ? action.apply : action.skip) + ' ' + label}
                    title={(exempt ? action.exempt : action.applied) + ' · ' + label}
                    onClick={() => toggle(tag)}>
                    <span aria-hidden="true">{exempt ? '○' : '●'}</span> {label}
                    {rule.op === 'select' && rule.value && ruleTag(rule.value) === ruleTag(tag) && <small> · fixed</small>}
                </button>;
            })}
        </div>
        {!filtered.length && <small>No matching tags.</small>}
        {filtered.length > limit && <button type="button" onClick={() => setLimit(limit + 80)}>Show more · {filtered.length - limit}</button>}
        {!!onChange && <div className="cg-rule-toolbar">
            <input aria-label={action.apply + ' another tag'} placeholder={action.apply + ' another tag…'} value={newTag}
                onChange={event => setNewTag(event.target.value)}
                onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); add(); } }} />
            <button type="button" disabled={!newTag.trim()} onClick={add}>{action.apply}</button>
        </div>}
        {error && <small role="alert">{error}</small>}
    </div>;
}

export function RulesetTags({ value, preferences = {}, context, onChange }: {
    value: Ruleset; preferences?: Record<string, string>; context?: string; onChange?: (value: Ruleset) => void;
}) {
    const [open, setOpen] = useState(false);
    const [selected, setSelected] = useState('');
    const entries = [
        ...value.rules.map((rule, index) => ({
            key: JSON.stringify([index]), label: 'Base · ' + (index + 1) + ' · ' + actions[rule.op].name, rule, active: true,
            update: (next: Rule) => ({ ...value, rules: value.rules.map((item, at) => at === index ? next : item) }),
        })),
        ...value.choices.flatMap(choice => choice.options.flatMap(option => option.rules.map((rule, index) => ({
            key: JSON.stringify([choice.id, option.id, index]),
            label: choice.label + ' · ' + option.label + ' · ' + (index + 1) + ' · ' + actions[rule.op].name, rule,
            active: option.id === (preferences[choice.id] ?? choice.default),
            update: (next: Rule) => ({ ...value, choices: value.choices.map(item => item.id === choice.id
                ? { ...item, options: item.options.map(row => row.id === option.id
                    ? { ...row, rules: row.rules.map((step, at) => at === index ? next : step) } : row) } : item) }),
        })))),
    ];
    const active = entries.find(entry => entry.key === selected) || entries.find(entry => entry.active) || entries[0];
    const tags = new Set(entries.flatMap(entry => entry.rule.tags.map(ruleTag)));
    const exceptions = new Set(entries.flatMap(entry => entry.rule.except_tags?.map(ruleTag).filter(tag => tags.has(tag)) || []));
    if (!active) return null;
    return <details className="cg-ruleset-tags" aria-label="Ruleset tag coverage"
        onToggle={event => setOpen(event.currentTarget.open)}>
        <summary>Tags · {tags.size}{exceptions.size ? ' · ' + exceptions.size + ' exceptions' : ''}{context ? ' · ' + context : ''}</summary>
        {open && <>
            <label>Rule <select aria-label="Rule tag group" value={active.key} onChange={event => setSelected(event.target.value)}>
                {entries.map(entry => <option key={entry.key} value={entry.key}>{entry.label}</option>)}
            </select></label>
            {!active.active && <small>This preference option is currently inactive.</small>}
            <TagChoices key={active.key} rule={active.rule} onChange={onChange ? rule => onChange(active.update(rule)) : undefined} />
        </>}
    </details>;
}
