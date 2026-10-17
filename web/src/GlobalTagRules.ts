import rawPack from '../../data/global-tag-rules.json';
import { compatibleBranches, guaranteedIn, promptRuleOccurrences, sharedScope, ruleKey, type RuleOccurrence, type RuleScope } from './PromptRuleContext';

export type GlobalFacet = { id: string; label: string; scope: string[]; mode: string; rationale: string; members: { tag: string; value: string }[] };
export type GlobalRule = { id: string; label: string; kind: string; facets: string[]; values?: string[][]; scope: string[]; exceptions: string[]; exception_values?: Record<string,string[]>; policy: string; status: string; rationale: string };
export const GLOBAL_TAG_PACK = rawPack as { version: number; id: string; revision: string; facets: GlobalFacet[]; rules: GlobalRule[]; aliases: Record<string,string> };
const aliases = new Map(Object.entries(GLOBAL_TAG_PACK.aliases));
const canonicalTag = (tag: string) => aliases.get(ruleKey(tag)) || ruleKey(tag);
const facets = new Map(GLOBAL_TAG_PACK.facets.map(facet => [facet.id, facet]));
const facetMembers = new Map(GLOBAL_TAG_PACK.facets.map(facet => [facet.id, new Map(facet.members.map(member => [member.tag, member.value]))]));
const knownTags = new Set(GLOBAL_TAG_PACK.facets.flatMap(facet => facet.members.map(member => member.tag)));

export type GlobalFinding = { id: string; ruleId: string; level: 'check' | 'context' | 'compatible'; tags: string[]; paths: string[]; scope: 'unknown' | 'known'; message: string; rationale: string };
export type GlobalReview = { findings: GlobalFinding[]; recognized: number; unknown: string[]; incomplete: boolean; revision: string };

/** Evaluates only candidate advisory rules; this path never rewrites prompts or changes generation probabilities. */
export function assessTagOccurrences(occurrences: RuleOccurrence[]): GlobalReview {
    occurrences = occurrences.map(item=>({...item, tag: canonicalTag(item.tag)}));
    const findings = new Map<string, GlobalFinding>();
    const byTag = new Map<string, RuleOccurrence[]>();
    for (const item of occurrences) byTag.set(item.tag, [...(byTag.get(item.tag) || []), item]);
    let work = 0, incomplete = false;
    const members = (id: string, values: string[] = []) => occurrences.filter(item => {
        const value = facetMembers.get(id)?.get(item.tag);
        return value !== undefined && (!values.length || values.includes(value));
    });
    const check = (rule: GlobalRule, items: RuleOccurrence[]) => {
        if (++work > 25000) { incomplete = true; return; }
        if (items.some((a, i) => items.slice(i+1).some(b => !compatibleBranches(a.conditions,b.conditions)))) return;
        const scope = sharedScope(items, rule.scope);
        if (scope === 'different') return;
        const active = new Map(items.flatMap(item => [...item.conditions]));
        // A context tag must be guaranteed in this branch AND have the relevant binding.
        // A contextual hint cannot override explicit bindings to an identical instance/region/frame.
        const exempt = scope === 'unknown' && rule.exceptions.some(tag => {
            const allowed = rule.exception_values?.[tag];
            if (allowed && items.some(item=>!allowed.includes(facetMembers.get(rule.facets[0])?.get(item.tag) || ''))) return false;
            return (byTag.get(tag) || []).some(context => guaranteedIn(context.conditions, active)
                && sharedScope([...items, context], rule.scope) !== 'different');
        });
        const tags = [...new Set(items.map(item => item.tag))].sort();
        const id = rule.id+':'+tags.join('/');
        const level = exempt ? 'context' : rule.policy === 'inform' ? 'compatible' : 'check';
        // Do not let one locally-exempt branch hide another branch still requiring a check.
        const previous = findings.get(id);
        if (previous?.level === 'check' && level !== 'check') return;
        if (!previous && findings.size >= 100) { incomplete = true; return; }
        findings.set(id, { id, ruleId: rule.id, level, tags, paths: items.map(item => item.path), scope,
            message: exempt ? `${rule.label}: an explicit context tag qualifies this combination.`
                : level === 'compatible' ? `${rule.label}: multiple values can coexist; clarify their distribution if needed.`
                    : `${rule.label}: check these tags${scope === 'unknown' ? ' if they describe the same '+rule.scope.join(', ') : ' in this bound scope'}.`,
            rationale: rule.rationale });
    };
    outer: for (const rule of GLOBAL_TAG_PACK.rules) {
        if (rule.kind === 'compatible_facets') continue; // Queryable knowledge, not UI noise.
        const left = members(rule.facets[0], rule.values?.[0]);
        if (rule.kind === 'solo_total') {
            const solo = left.filter(item => item.tag === 'solo');
            for (const anchor of solo) for (let a=1;a<rule.facets.length;a++) for (let b=a+1;b<rule.facets.length;b++) {
                for (const first of members(rule.facets[a])) for (const second of members(rule.facets[b])) {
                    check(rule,[anchor,first,second]);if (incomplete) break outer;
                }
            }
        } else if (rule.kind === 'cross_values') {
            for (const a of left) for (const b of members(rule.facets[1],rule.values?.[1])) { check(rule,[a,b]);if (incomplete) break outer; }
        } else if (rule.kind === 'distinct_values' || rule.kind === 'compatible_values') {
            const values = facetMembers.get(rule.facets[0])!;
            for (let i=0;i<left.length;i++) for (let j=i+1;j<left.length;j++) {
                if (values.get(left[i].tag) !== values.get(left[j].tag)) check(rule,[left[i],left[j]]);
                else if (++work > 25000) incomplete = true;
                if (incomplete) break outer;
            }
        }
    }
    return { findings: [...findings.values()], recognized: occurrences.filter(item => knownTags.has(item.tag)).length,
        unknown: [...new Set(occurrences.filter(item => !knownTags.has(item.tag)).map(item => item.tag))], incomplete, revision: GLOBAL_TAG_PACK.revision };
}

export function reviewGlobalTags(text: string, bindings: Record<string, RuleScope> = {}): GlobalReview {
    const parsed = promptRuleOccurrences(text, bindings);
    const result = assessTagOccurrences(parsed.occurrences);
    return { ...result, incomplete: parsed.incomplete || result.incomplete };
}

/** Absence of a dictionary edge is unknown, never an implicit ban or guarantee. */
export function globalTagKnowledge(a: string, b: string): string[] {
    a = canonicalTag(a); b = canonicalTag(b);
    const idsA = new Set([...facetMembers].filter(([,members])=>members.has(a)).map(([id])=>id));
    const idsB = new Set([...facetMembers].filter(([,members])=>members.has(b)).map(([id])=>id));
    return GLOBAL_TAG_PACK.rules.filter(rule => rule.kind === 'compatible_facets' &&
        (idsA.has(rule.facets[0]) && idsB.has(rule.facets[1]) || idsB.has(rule.facets[0]) && idsA.has(rule.facets[1])))
        .map(rule => rule.rationale);
}

export const globalFacetLabel = (id: string) => facets.get(id)?.label || id;
