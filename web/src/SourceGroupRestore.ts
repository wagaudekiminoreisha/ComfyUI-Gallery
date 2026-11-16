import { chipItems, compileChip, parsePrompt, sourceKey, withItems, type Chip, type OrChip } from './PromptBoxes';

export type OmittedSourceGroup = { key: string; text: string; replacement: string };
const single = (text: string) => { const chips = parsePrompt(text); return chips.length === 1 ? chips[0] : undefined; };
const spelling = (text: string) => sourceKey(parsePrompt(text).map(compileChip).join(', '));
function leaves(text: string, depth = 0): Set<string> {
    if (depth > 20) return new Set();
    return new Set(parsePrompt(text).flatMap(chip => chip.kind === 'tag' ? [sourceKey(chip.text)] : chipItems(chip).flatMap(item => [...leaves(item, depth + 1)])));
}

/** Reconstruct omitted source groups from the original recipe and its local edit.
 * Restore one branch at a time, retaining the edited siblings and parent settings.
 * No separate history is needed: replacements already survive workflow reloads.
 */
export function omittedSourceGroups(original: string, edited: string): OmittedSourceGroup[] {
    const before = single(original), current = single(edited);
    if (!before || !current || before.kind !== 'or') return [];
    return compare(before, current, [], 0);
}

function compare(before: OrChip, current: Chip, path: number[], depth: number): OmittedSourceGroup[] {
    if (depth > 20) return [];
    const previous = chipItems(before);
    // Required one-option groups compile to their only child. Recover that
    // wrapper when restoring, rather than mistaking the child's options for it.
    const unweighted = before.weight !== undefined ? { ...current, weight: undefined } : current;
    const collapsedText = compileChip(unweighted);
    const collapsed = current.kind !== 'or' || previous.some(item => spelling(item) === spelling(collapsedText));
    const reducedOptional = current.kind === 'or' && current.optional && current.options.length === 1 && before.options.length > 1;
    const parent: OrChip = collapsed ? { ...before, weight: before.weight !== undefined ? current.weight : before.weight }
        : reducedOptional ? { ...before, weight: current.weight, optional: current.optional } : current as OrChip;
    const present = collapsed ? [collapsedText] : chipItems(current);
    const slots = new Map<number, number>(), used = new Set<number>();
    previous.forEach((item, index) => {
        const at = present.findIndex((value, position) => !used.has(position) && spelling(value) === spelling(item));
        if (at >= 0) { slots.set(index, at); used.add(at); }
    });
    // A group that still has some of its original members is an edited group,
    // not an omitted one. Descend into it to find omissions further down.
    previous.forEach((item, index) => {
        if (slots.has(index) || single(item)?.kind !== 'or') return;
        const tags = leaves(item);
        const at = present.findIndex((value, position) => !used.has(position) && [...leaves(value)].some(tag => tags.has(tag)));
        if (at >= 0) { slots.set(index, at); used.add(at); }
    });
    const result: OmittedSourceGroup[] = [];
    previous.forEach((item, index) => {
        const group = single(item);
        if (group?.kind !== 'or') return;
        const at = slots.get(index);
        if (at !== undefined) {
            if (spelling(item) === spelling(present[at])) return;
            const child = single(present[at]);
            if (!child) return;
            for (const omitted of compare(group, child, [...path, index], depth + 1)) {
                const items = [...present]; items[at] = omitted.replacement;
                result.push({ ...omitted, replacement: compileChip(withItems(parent, items)!) });
            }
        } else {
            const ordered = [...slots].sort(([a], [b]) => a - b);
            const next = ordered.find(([position]) => position > index)?.[1];
            const earlierSlots = ordered.filter(([position]) => position < index);
            const earlier = earlierSlots[earlierSlots.length - 1]?.[1];
            const position = next ?? (earlier !== undefined ? earlier + 1 : 0);
            const items = [...present]; items.splice(position, 0, item);
            result.push({ key: JSON.stringify([...path, index]), text: item, replacement: compileChip(withItems(parent, items)!) });
        }
    });
    return result;
}

export function restoreAllSourceGroups(original: string, edited: string): string {
    for (let index = 0; index < 500; index++) {
        const first = omittedSourceGroups(original, edited)[0];
        if (!first || first.replacement === edited) break;
        edited = first.replacement;
    }
    return edited;
}
