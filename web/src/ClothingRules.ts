import { parsePrompt } from './PromptBoxes';
import { clothingKey, garmentFor, needsLayeringContext, type Garment } from './ClothingDictionary';

type Conditions = Map<number, number>;
type Occurrence = { garment: Garment; conditions: Conditions };
type Layer = { outer: string; inner: string; conditions: Conditions };
export type ClothingFinding = { id: string; level: 'layered' | 'check'; garments: string[]; message: string; suggestion?: string };
export type ClothingReview = { findings: ClothingFinding[]; recognized: number; incomplete: boolean };

const compatible = (a: Conditions, b: Conditions) => [...a].every(([choice, branch]) => !b.has(choice) || b.get(choice) === branch);
const impliedBy = (condition: Conditions, active: Conditions) => [...condition].every(([choice, branch]) => active.get(choice) === branch);

/**
 * Advisory only. Each occurrence retains its enclosing OR decisions, so mutually exclusive
 * branches never create a pair. Layer declarations must be guaranteed in that same context;
 * an optional declaration cannot excuse an always-present pair. No branch enumeration.
 * Unbound text never establishes wearer identity and cannot justify destructive enforcement.
 */
export function reviewClothing(text: string): ClothingReview {
    const occurrences: Occurrence[] = [], layers: Layer[] = [];
    let choice = 0, nodes = 0, incomplete = false;
    const walk = (value: string, conditions: Conditions, depth = 0): void => {
        if (depth > 32 || ++nodes > 2048) { incomplete = true; return; }
        for (const chip of parsePrompt(value)) {
            if (++nodes > 2048) { incomplete = true; return; }
            if (chip.kind === 'or') {
                const id = choice++;
                chip.options.forEach((option, branch) => walk(option, new Map([...conditions, [id, branch]]), depth + 1));
            } else {
                // Strip emphasis/weights through the existing parser, retaining inner grouping.
                if (chip.weight !== undefined || chip.emphasis) { walk(chip.text, conditions, depth + 1); continue; }
                const key = clothingKey(chip.text);
                const garment = garmentFor(key);
                if (garment) { occurrences.push({ garment, conditions }); continue; }
                const match = /^(?:wearing )?(.+?) (over|underneath|under) (?:a |an )?(.+)$/.exec(key.replace(/^(?:a |an )/, ''));
                if (match) {
                    const left = garmentFor(match[1].replace(/^(?:a |an )/, '')), right = garmentFor(match[3]);
                    if (left && right && left.id !== right.id) {
                        occurrences.push({ garment: left, conditions }, { garment: right, conditions });
                        layers.push({ outer: match[2] === 'over' ? left.id : right.id, inner: match[2] === 'over' ? right.id : left.id, conditions });
                    }
                }
            }
        }
    };
    if (text.length > 32768) incomplete = true;
    // Don't cut text halfway through an OR and accidentally change its meaning.
    else walk(text, new Map());
    const pairs = new Map<string, { a: Garment; b: Garment; unresolved: boolean; direction?: Layer; contradictory: boolean }>();
    let comparisons = 0;
    outer: for (let i = 0; i < occurrences.length; i++) for (let j = i + 1; j < occurrences.length; j++) {
        if (++comparisons > 25000) { incomplete = true; break outer; }
        const left = occurrences[i], right = occurrences[j];
        if (!needsLayeringContext(left.garment, right.garment) || !compatible(left.conditions, right.conditions)) continue;
        const active = new Map([...left.conditions, ...right.conditions]);
        const declarations = layers.filter(layer => [layer.outer, layer.inner].sort().join('/') === [left.garment.id, right.garment.id].sort().join('/') && impliedBy(layer.conditions, active));
        const id = [left.garment.id, right.garment.id].sort().join('/');
        const previous = pairs.get(id);
        const contradictory = declarations.some(layer => declarations.some(other => layer.outer === other.inner && layer.inner === other.outer));
        pairs.set(id, { a: left.garment, b: right.garment, unresolved: !!previous?.unresolved || !declarations.length, direction: previous?.direction || declarations[0], contradictory: !!previous?.contradictory || contradictory });
    }
    const findings: ClothingFinding[] = [...pairs].slice(0, 40).map(([id, pair]) => {
        const { a, b, direction } = pair;
        const check = pair.unresolved || pair.contradictory;
        const names = [a.label, b.label];
        const outer = a.kind === 'skirt' || a.kind === 'dress' ? a : b;
        const inner = outer === a ? b : a;
        return {
            id, level: check ? 'check' : 'layered', garments: names,
            message: pair.contradictory ? `${names.join(' + ')}: opposite layer orders occur together. Check the intended outfit or wearer.`
                : pair.unresolved ? `${names.join(' + ')} can occur together. If these describe one wearer, clarify layering or make them alternatives.`
                    : `${names.join(' + ')}: explicit layering is present in each detected shared context.`,
            suggestion: pair.unresolved ? a.kind === 'ensemble' || b.kind === 'ensemble'
                ? 'For a tracksuit, specify the pieces: e.g. skirt over track pants, track jacket.'
                : `For layering, try “${outer.label} over ${inner.label}”. For separate looks, use {${a.label}|${b.label}}.`
                : direction ? `Layering phrases are retained in the prompt.` : undefined,
        };
    });
    if (pairs.size > 40) incomplete = true;
    return { findings, recognized: new Set(occurrences.map(item => item.garment.id)).size, incomplete };
}
