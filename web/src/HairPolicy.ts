import pack from '../../data/global-tag-rules.json';
import vocabulary from '../../data/hair-prompt-tags.json';
import { compileChip, parsePrompt } from './PromptBoxes';
import { compatibleBranches, promptRuleOccurrences } from './PromptRuleContext';

export const HAIR_ATTRIBUTES = ['length', 'colour', 'distribution', 'presence', 'arrangement', 'texture', 'details', 'alteration', 'bangs-length', 'material'] as const;
export type HairAttribute = typeof HAIR_ATTRIBUTES[number];
export type HairPolicy = { mode: 'specific' | 'natural' | 'minimal'; attributes: HairAttribute[]; singleColour?: boolean };
export const DEFAULT_HAIR_POLICY: HairPolicy = { mode: 'specific', attributes: ['length'] };
export function cleanHairPolicy(value: unknown): HairPolicy {
    if (typeof value === 'string') { try { value = JSON.parse(value); } catch { value = null; } }
    const raw = value as Partial<HairPolicy> | null;
    return { mode: raw?.mode === 'natural' || raw?.mode === 'minimal' ? raw.mode : 'specific', attributes: Array.isArray(raw?.attributes) ? HAIR_ATTRIBUTES.filter(key => raw.attributes!.includes(key)) : ['length'], singleColour: raw?.singleColour === true };
}
const key = (text: string) => text.trim().toLowerCase().replace(/\s+/g, '_');
const facets = new Map(Object.entries(vocabulary.tags)) as Map<string, HairAttribute>;
const canonical = (text: string) => (pack.aliases as Record<string, string>)[key(text)] || key(text);
export const hairAttributeTags = (attribute: HairAttribute) => [...facets].filter(([,facet])=>facet===attribute).map(([tag])=>tag);
export const hairAttribute = (text: string) => facets.get(canonical(text));

/** Exact known scalp-hair tags only: accessories, body hair and prose stay untouched. */
export function filterHairPrompt(text: string, policy: HairPolicy, depth = 0): string {
    if (policy.mode === 'specific' || depth > 32) return text;
    return parsePrompt(text).flatMap(chip => {
        if (chip.kind === 'or') {
            const options = chip.options.map(option => filterHairPrompt(option, policy, depth + 1));
            const kept = [...new Set(options.filter(Boolean))];
            return kept.length ? [compileChip({ ...chip, options: kept, optional: chip.optional || options.some(option => !option) })] : [];
        }
        if (chip.text !== text && /[,{}()[\]]/.test(chip.text)) {
            const inner = filterHairPrompt(chip.text, policy, depth + 1);
            return inner ? [compileChip({ ...chip, text: inner })] : [];
        }
        const facet = hairAttribute(chip.text);
        return facet && (policy.mode === 'natural' || !policy.attributes.includes(facet)) ? [] : [compileChip(chip)];
    }).join(', ');
}

export function hairWarnings(text: string, policy = DEFAULT_HAIR_POLICY): string[] {
    const items = promptRuleOccurrences(text).occurrences;
    const colours = items.filter(item => hairAttribute(item.tag) === 'colour');
    const distributions = items.filter(item => hairAttribute(item.tag) === 'distribution');
    const family = (tag: string) => canonical(tag).replace(/^(?:light_|dark_)/, '');
    const together = (list: typeof items, qualifies = (_a: typeof items[number], _b: typeof items[number]) => true) => list.some((a, i) => list.slice(i + 1).some(b => family(a.tag) !== family(b.tag) && compatibleBranches(a.conditions, b.conditions) && qualifies(a, b)));
    const warnings: string[] = [];
    if (policy.singleColour && together(colours)) warnings.push('Single-colour look: more than one hair colour can be active in a branch. Choose alternatives or separate subjects; tags stay enabled.');
    if (together(distributions)) warnings.push('Several hair-colour distribution instructions can be active together. Check whether streaks, gradients or split colours are all intended.');
    if (together(colours, (a, b) => items.some(item => /^(?:[2-9]|[1-9]\d+)(?:girls|boys|others)$|^multiple_(?:girls|boys|others)$/.test(item.tag) && compatibleBranches(a.conditions, item.conditions) && compatibleBranches(b.conditions, item.conditions)))) warnings.push('Multiple subjects share flat conditioning: hair colours may transfer between people. Separate boxes alone do not enforce ownership; use regional conditioning for spatial control.');
    if (items.some(item => ['highlights', 'fur', 'fluffy', 'fuzzy', 'hair'].includes(item.tag))) warnings.push('Ambiguous appearance term: specify whether hair, body covering, clothing or lighting is intended. No automatic replacement is applied.');
    if (items.some(item => hairAttribute(item.tag) === 'material')) warnings.push('Hair material/effect tag: fiery hair, glowing hair and non-hair materials deliberately request effects or unusual surfaces. Omit them unless intended; this is not a checkpoint-specific diagnosis.');
    return warnings;
}

/** Counts potential recognised terms in the template, not sampled tags or saved chips. */
export function hairFilterSummary(text: string, value: unknown) {
    const policy = cleanHairPolicy(value), parsed = promptRuleOccurrences(text);
    const omitted = new Set<string>(), retained = new Set<string>();
    for (const occurrence of parsed.occurrences) {
        const attribute = hairAttribute(occurrence.tag);
        if (!attribute) continue;
        (policy.mode === 'natural' || policy.mode === 'minimal' && !policy.attributes.includes(attribute) ? omitted : retained).add(canonical(occurrence.tag));
    }
    return { omitted: [...omitted], retained: [...retained], incomplete: parsed.incomplete };
}
