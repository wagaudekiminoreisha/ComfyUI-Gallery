import { parsePrompt } from './PromptBoxes';

export type RuleScope = Partial<Record<'subject' | 'region' | 'garment' | 'scene' | 'frame' | 'view' | 'image' | 'target', string>>;
export type RuleOccurrence = { tag: string; path: string; conditions: Map<number, number>; scope: RuleScope };
export const ruleKey = (text: string) => text.trim().toLowerCase().replace(/\s+/g, '_');
export const compatibleBranches = (a: Map<number, number>, b: Map<number, number>) => [...a].every(([choice, branch]) => !b.has(choice) || b.get(choice) === branch);
export const guaranteedIn = (condition: Map<number, number>, active: Map<number, number>) => [...condition].every(([choice, branch]) => active.get(choice) === branch);

/** Stable occurrence paths permit future recipe bindings without deduplicating tags across OR branches. */
export function promptRuleOccurrences(text: string, bindings: Record<string, RuleScope> = {}) {
    const occurrences: RuleOccurrence[] = [];
    let choice = 0, nodes = 0, incomplete = false;
    const walk = (value: string, conditions: Map<number, number>, path: string, depth: number) => {
        if (depth > 32 || ++nodes > 2048) { incomplete = true; return; }
        for (const [index, chip] of parsePrompt(value).entries()) {
            if (++nodes > 2048) { incomplete = true; return; }
            const at = path+'/'+index;
            if (chip.kind === 'or') {
                const id = choice++;
                for (const [branch, option] of chip.options.entries()) walk(option, new Map([...conditions, [id, branch]]), at+'/or/'+branch, depth+1);
            } else if (chip.weight !== undefined || chip.emphasis) walk(chip.text, conditions, at+'/emphasis', depth+1);
            else occurrences.push({ tag: ruleKey(chip.text), path: at, conditions, scope: bindings[at] || {} });
        }
    };
    // Never truncate inside an expression and then analyse a different expression.
    if (text.length > 32768) incomplete = true;
    else walk(text, new Map(), 'root', 0);
    return { occurrences, incomplete };
}

/** Mismatched known bindings separate instances. Missing bindings yield conditional advice only. */
export function sharedScope(occurrences: RuleOccurrence[], keys: string[]): 'different' | 'unknown' | 'known' {
    let unknown = false;
    for (const key of keys) {
        const values = occurrences.map(item => item.scope[key as keyof RuleScope]);
        if (new Set(values.filter(Boolean)).size > 1) return 'different';
        if (values.some(value => !value)) unknown = true;
    }
    return unknown ? 'unknown' : 'known';
}
