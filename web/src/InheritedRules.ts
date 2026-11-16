import {effectiveRuleBoxes,type RuleBox,type RulesLibrary} from './RuleEngine';

/** Global rules are evaluated separately, never promoted into source-owned cards. */
export function privateRuleBoxes(boxes: RuleBox[], library: RulesLibrary): RuleBox[] {
    const globals = library.globals.map(box => box.id);
    return boxes.filter(box => box.origin !== 'global' && !(box.origin !== 'encoder' &&
        globals.some(id => box.id === id || box.id.endsWith(':' + id))));
}

/** An explicitly saved empty attachment list means cleared, not missing. */
export function snapshotRuleBoxes(snapshot: { id: string; rules: RuleBox[] }, library: RulesLibrary): RuleBox[] {
    const key = 'snapshot:' + snapshot.id;
    const boxes = Object.prototype.hasOwnProperty.call(library.prefixes, key) ? library.prefixes[key] : snapshot.rules;
    return effectiveRuleBoxes(privateRuleBoxes(boxes, library));
}

/** Stable across prefix/snapshot copies and new snapshots of the same ruleset. */
export function inheritedRuleKey(prefixId: string, box: RuleBox): string {
    return JSON.stringify([prefixId, box.definition.id, box.scope]);
}
export const inheritedRuleIdentity = (box: RuleBox) => box.inheritanceKey || box.id;
export const isInheritedRuleIgnored = (box: RuleBox, ignored: string[] = []) => ignored.includes(inheritedRuleIdentity(box)) || ignored.includes(box.id);
export function selectedInheritedRules(boxes: RuleBox[], ignored?: string[]): RuleBox[] {
    return boxes.filter(box => box.origin !== 'global' && !isInheritedRuleIgnored(box, ignored));
}
