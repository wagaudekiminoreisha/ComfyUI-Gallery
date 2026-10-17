# Clothing review: first implementation

The positive prefix editors and Gallery Prompt Encode preview now show a
collapsible **Clothing review** when the starter dictionary detects an ambiguous
combination or explicit layering. Existing prompts, saved prefixes and exclusive
tag settings are not migrated or rewritten.

Try these positive prefix terms:

| Terms | Review |
| --- | --- |
| `skirt, tracksuit` | Clarify the outfit; suggests naming track pants and jacket separately. |
| `{skirt\|tracksuit}` | No co-occurrence warning: these are alternative outfits. |
| `skirt over track pants` | Explicit layered outfit. |
| `track pants underneath skirt` | Same layer order. |
| `{skirt over pants\|skirt, pants}` | The second branch still needs clarification. |
| `skirt, pants, {skirt over pants\|}` | Optional explanation cannot settle the always-present combination. |
| `skirt over pants, pants over skirt` | Check opposite layer orders used together. |

Layering phrases are ordinary saved prefix terms and remain in the emitted
prompt. The review does not guarantee the model will render the intended layers.

`ClothingDictionary.ts` holds the versioned seed (`clothing-1`), using broad
garment families for this review only. Its aliases are not universal tag identity
or implication assertions. Unknown vocabulary remains unassessed. Upper garments,
outerwear and tights are recognised without warning about everyday layering.

`ClothingRules.ts` retains enclosing OR decisions on each occurrence. Only
occurrences with compatible decisions are paired. Explicit layering must be
guaranteed in the pair's context, rather than appearing somewhere in another or
optional branch. This is conservative: it does not prove arbitrary combinations
of separate conditional declarations. Work is bounded, with an incomplete notice
instead of an assertion that oversized prompts are clear.

There are no wearer/region bindings yet. Every warning is conditional on garments
describing the same wearer; this review never disables tags, filters branches or
changes sampling. Negative prefix terms are not interpreted as an outfit. The
legacy exclusive-tag setting still operates separately, including any custom
clothing exclusions the user previously supplied.

This is the first executable slice of `PREFIX_RULE_COMPOSITION.md`. Persistent
structured recipe bindings, editable rule packs and SQLite storage are subsequent
steps, not features claimed by this implementation.

Verification: `node --test tests/clothing_rules.test.cjs`, the existing prompt-box
and batch-blacklist tests, `npm run build` in `web`, and
`tests/browser_clothing_review.cjs` against the isolated Gallery browser fixture.
