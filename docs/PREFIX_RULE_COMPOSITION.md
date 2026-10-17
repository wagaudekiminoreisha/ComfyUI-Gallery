# Prefixes as scoped tag recipes — design exploration, 2026-10-18

Proposal only: this does not change saved prefixes, live rules or generated prompts.
It extends TAG_COINCIDENCE_DESIGN.md.

## Current implementation and the gap

The current library already gives reusable terms IDs, but a term's text can be a
whole expression such as `{blonde hair, short hair|blonde hair, long hair}`. It is
not necessarily one semantic tag. `chipTerms` flattens groups for conversions; that
is not a suitable representation for compatibility validation.

A rule-aware prefix needs a structured recipe whose leaves refer to canonical tag
IDs, and whose nodes preserve simultaneous versus alternative activation. Keep
discovery labels, prompt leaves and inferred semantic facts separate.

## Recommended hybrid

1. Global vocabulary facts: identity, aliases and reviewed implications.
2. Global conditional rules: defaults with subject/region/frame/view assumptions.
3. Prefix intent: e.g. one subject, two-colour hair, main scalp, two outfit variants.
4. Prefix constraints: requirements and allowed combinations for this particular look.
5. Explicit exceptions: narrow waivers of specifically overridable policies, with a
   reason and scope. They are never a blanket "ignore global rules" switch.

Prefer describing the context that makes a global default inapplicable over
overriding it. Hair colour should already allow multiple colours where appropriate.
A two-tone recipe can require two colour values; it need not rewrite the global
meaning of blonde_hair or brown_hair.

Prefix-specific aesthetic restrictions are preferences, not universal semantic
facts. A recipe saying "use silver accessories with the blue outfit" should not
establish that blue and gold are globally incompatible.

Combining prefixes normally conjoins their constraints. There is no silent
last-prefix-wins rule. Conflicting locked requirements produce an explanation;
the UI asks which requirement or context the user intends to change. A local
exception may waive an overridable guideline, but cannot silently make mutually
contradictory locked requirements both true.

## Recipe nodes

- tag: canonical ID, weight, channel, occurrence ID and subject/region binding.
- all: every enabled child is active together.
- choose_one: select exactly one child; children may themselves be all nodes.
- optional: include its child as a whole, or omit it.
- optional_each: independently activate children, subject to declared constraints.
- prefix_ref: another prefix at a pinned revision, with explicit slot bindings.

Round/square emphasis brackets and weights are annotations, not OR operators.
Optional group and optional-each must remain different nodes. A negative-prompt
channel is not a Boolean NOT operator: it is model conditioning and should not be
used as logical proof that a tag is absent.

An occurrence is the unit of scope. The same canonical tag may appear in two
subjects or branches without those occurrences being merged or deduplicated.

## Branch example

Desired expression:

    (blonde_hair AND short_hair) OR (blonde_hair AND long_hair)

Current text syntax:

    {blonde hair, short hair|blonde hair, long hair}

Tree:

    choose_one
      all: blonde_hair@personA, short_hair@personA.scalp
      all: blonde_hair@personA, long_hair@personA.scalp

The two length tags cannot be active together. The global length rule is unchanged
and never needs an exception for this recipe. When context is identical, factoring
this as `blonde hair, {short hair|long hair}` is equivalent. Do not factor across
different subject bindings, occurrence weights, channels or local contexts.

## Production scenarios and expected decisions

| Scenario | Expected behaviour |
|---|---|
| Blonde + brown two-tone look | Require both colours for one intended hair region, declare mixed-colour intent, optionally include an explicit two-tone tag chosen by the user. This is a prompt recipe, not a guarantee about rendered colour placement. |
| Blonde short OR blonde long | Two valid branches; never report a length contradiction just because both names occur in the recipe. |
| Short AND long on the same uniform-length scalp | Warn/reject under that declared policy; allow a user to refine the region or describe mixed lengths. |
| Short overall cut with long sidelocks/extensions | Bind the long feature to side locks/extensions, not the uniform main scalp. If bindings are absent, report ambiguity rather than inventing them. |
| Person A blonde/standing; person B brown/sitting | Valid separate subject scopes. Never disable the other person's pose/colour. |
| Two prefixes assign standing and sitting to the same primary pose slot | Composition conflict; show the two originating prefixes and rules. Individually valid prefixes are not necessarily valid together. |
| A selected source-image prefix contains short hair; a new recipe chooses short or long | The combined long branch is inconsistent under the uniform-length policy. Offer keep-source, explicitly replace the length slot, or relax that policy. Do not silently discard the new branch and pretend it was sampled. |
| Optional-each standing and sitting | In unconstrained mode four outcomes are possible. Under an at-most-one primary-pose rule only none/standing/sitting remain valid. The UI must show that this changes independent 50/50 sampling. |
| Optional group containing standing AND sitting | Its enabled branch is invalid under the primary-pose policy. Merely sampling the group off forever is not a useful successful recipe; flag the unreachable enabled group. |
| Outfit variants: blue dress + silver accessory OR red dress + gold accessory | Choose whole outfits. Independent OR groups would allow cross-combinations; that may violate the recipe's intent without being globally incongruent. |
| Front view and back view in a reflection or split panel | Bind to distinct views/panels. A single-camera warning must not apply across them. |
| Explicit long-hair positive and short-hair negative | Aesthetic/model-conditioning preference, not a logical contradiction. Exact same positive/negative text merits an advisory rather than automatic deletion. |
| Nested prefix requires short hair; parent requires long hair on the same slot | Report the originating child/parent constraints. Parent attachment must not silently disable the child rule. |
| Local two-colour permission plus a third colour from another prefix | Do not exempt all hair-colour occurrences. Match the declared region, colour count and contributing occurrences; show the new combined context. |
| Weighted hair colours | Preserve weights. Weight is conditioning strength, not a probability of selecting the tag or a logical conflict-resolution priority. |
| A batch of ten images from one conditioning prompt | One branch selection supplies that conditioning batch. Per-image recipe variants require separate conditioning evaluations/queued runs. |

No production image generation was performed for this proposal. These are intended
logical/UI behaviours; rendered appearances require workflow-specific evaluation.

## Evaluation pipeline

Resolve pinned prefix references -> normalize aliases -> bind slots -> preserve the
recipe tree -> retrieve relevant rules -> identify simultaneously reachable tag
occurrences -> select a valid branch/optional assignment -> serialize plain prompts.

Check both the prefix and its surrounding prompt. Preview three distinct states:
always valid, valid only for some choices, or no valid choices. Identify a dead
branch/group separately, even when the whole recipe can fall back to something else.

Do not enumerate a Cartesian product of a megalist in production. Independent
optional leaves may yield exponentially many assignments. Use a Boolean constraint
representation (SAT/BDD or an equivalent symbolic engine) for reachability and
unsatisfiable explanations. Choose a documented weighted-sampling strategy; a
generic SAT solver is not automatically a uniform or probability-preserving sampler.

Offer policies: warn without changing choices; explicitly filter invalid choices;
or stop when any requested/locked branch is impossible. Never silently renormalize
the distribution. Log requested weights and the actual chosen branch/policy.

ComfyUI's existing browser-side dynamic prompt expansion can erase the structure
before the Python node receives it. The future rule-aware path must serialize its
AST as a dedicated node input and resolve it once server-side, rather than letting
the browser independently randomize the same expression. Keep a legacy text path.

## Prefix application operations

Support explicit operations: append, fill an empty slot, and replace a named slot.
Replacing `personA.scalp.hair_length` must not erase person B's length, bangs,
colours, negative prompts or the original source-image metadata. If old prompt
text has no reliable bindings, require a user decision instead of guessing scope.

## Storage additions

Extend the coincidence schema rather than inventing another independent rule DB:

- prefix_definition(id, name) and prefix_revision(prefix_id, revision, recipe_json,
  context_json, dictionary_pack_revision): immutable revisioned recipes.
- prefix_label(prefix_id, tag_id): discovery/index labels, not emitted prompt tags.
- prefix_rule(prefix_id, revision, rule_id, bindings_json): reuse rule definitions;
  scope them to this recipe instance and its variables.
- prefix_exception(prefix_id, revision, rule_id, guard_json, reason): explicit
  guarded waivers. Reject waivers of non-overridable rules.
- prefix_dependency(prefix_id, revision, child_id, child_revision): cycle detection
  and pinned-reference resolution; do not silently follow a renamed/current child.
- prefix_tag_index(prefix_id, revision, tag_id, occurrence_id, branch_path,
  subject_slot, region_slot): generated index for search/dependency queries, never
  the authoritative flattened recipe.

The AST itself stays JSON because order and nested operators are natural tree
data. Canonical tags/rules remain relational; derived indexes are transactional
and rebuildable. Validate node kinds, IDs, bindings, depth, references, cycle
limits and migrations at import time. JSON syntax validity alone is insufficient.

Execution metadata records resolved tag occurrences, prefix/pack/rule revisions,
subject bindings, chosen branches, applied exceptions, warnings, and sampling seed.
That makes a saved image explainable even after prefixes or global rules change.

## Suggested UI

Each prefix has: Recipe, Context & slots, Rules, and Preview. Ordinary users can
keep editing chips; the AST is an implementation detail. A preview shows concrete
variants, their active tags and why a particular variant conflicts. Local changes
show "this prefix only"; global dictionary editing is a distinct explicit action.

Start with same-subject contexts declared by the user, branch-aware warnings and
explanations. Add constrained sampling after its distributions and scope semantics
are tested. Migrate existing text recipes without guessing local exceptions.
