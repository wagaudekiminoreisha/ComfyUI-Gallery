import type { RuleBox, RulesLibrary, RulesetMode } from './RuleEngine';

export function rulesetMode(library: RulesLibrary, id: string): RulesetMode {
    return library.availability?.[id] ?? (library.globals.some(box => box.definition.id === id) ? 'global' : 'on-demand');
}

export function globalRuleBoxes(library: RulesLibrary): RuleBox[] {
    return library.globals.filter(box => rulesetMode(library, box.definition.id) === 'global')
        .map(box => ({ ...box, origin: 'global' }));
}

export function availableRules<T extends RuleBox>(boxes: T[], disabled: ReadonlySet<string>): T[] {
    return boxes.filter(box => !disabled.has(box.definition.id));
}

export function disabledRulesets(library: RulesLibrary): Set<string> {
    return new Set(Object.entries(library.availability ?? {}).filter(([, mode]) => mode === 'disabled').map(([id]) => id));
}
