# Tag coincidence dictionary — proposal, 2026-10-18

This is a design proposal, not a replacement for the live exclusive-tag list.
The bundled CSV contains 140,782 rows, including 30,782 general tags; the existing
exclusive dictionary contains 14 sets. A complete compatibility table over the
whole CSV would contain 9,909,715,371 unordered pairs. Most would say nothing useful.

## Meaning

Keep three separate questions:

1. Can these descriptions be true together, for the same subject/region/time/view?
2. How often are they tagged together in a specified corpus?
3. How reliably can this model/workflow generate them together?

Store semantic constraints, observed cooccurrence and model behaviour separately.
Rare is not impossible; common is not compatible on the same individual.
No relation means **unknown**, not incompatible or verified compatible.

Return: compatible, redundant, conditional, conflicting, or unknown, with scope,
reason, source and review status. A hard conflict is an action policy on a reviewed
rule with satisfied scope and assumptions, not a universal property of two strings.

## Scope comes first

Tag occurrences need optional subject, region, frame and view bindings. Examples:
person A / scalp / frame 1 / main view; person B / left eye / frame 1 / reflection.
Global tags such as a scene-wide count use scene scope instead.

Ordinary prompt boxes currently have no reliable subject bindings. Until that is
added, same-person rules should warn or apply only within a user-declared single-
subject group. Do not disable another person's tags merely because they conflict
on one person. Missing scope must remain unknown; do not infer one subject from
the fact that two chips share a box or prefix.

## Dictionary families

Use tag -> facet/value assignments, not one exclusive bucket per tag. A tag may
have several assignments; values can have broader/narrower relationships.

| Family | Facets to cover | Important limits |
|---|---|---|
| Subjects | exact counts, species, named identity, presentation | Several identities/species can occur in one scene. |
| Hair | presence, length, colour, colour distribution, arrangement, texture, bangs, side locks, accessories, motion | Colour and arrangement are multivalued; length depends on region/extensions. |
| Eyes | presence, left/right colour, iris/pupil traits, openness, gaze, eyewear | Heterochromia, mixed colours, winking and different subjects need distinct scopes. |
| Face | mouth state, expression, markings, facial hair | Smiling and crying can coexist; expression is not a single-choice enum. |
| Anatomy | region, count, proportions, modifications, condition | Fantasy anatomy and occlusion prevent many universal negative rules. |
| Clothing | garment, layer, body region, colour, material, pattern, coverage, state | Shirt/jacket layering and outfits assembled from multiple items are normal. |
| Accessories | item, attachment region, material, count, ownership | Scope to an item or body region, not the entire image. |
| Pose | primary body support, limb positions, torso orientation, head orientation | Sitting/standing is conditional on one person, one instant and one primary pose. |
| Actions | locomotion, manipulation, interaction, target | Many actions can occur together; running and holding an object are independent. |
| Relations | who holds/touches/looks at what; spatial arrangements | Relations require two or more entity arguments. |
| Framing | crop, shot scale, camera orientation, perspective, focus | Multiple panels, mirrors and multiple viewpoints are exceptions. |
| Environment | location, terrain, architecture, weather, season, time | Indoor/outdoor scenes can be connected by windows or open structures. |
| Lighting | source, direction, colour, intensity, effect | Multiple lights/directions/colours are allowed. |
| Objects | class, part, material, colour, state, count | Different states can belong to different objects. |
| Medium/style | illustration, photograph, rendering, line, palette, era, style cues | Mixed media and collage make most exclusions advisory. |
| Text/layout | text presence, language, panel layout, overlays | Absence claims require an explicit meaning and scope. |
| Prompt controls | quality labels, LoRAs, embeddings, model-specific cues | Do not treat these as image-semantic facts or invent tag implications. |

The draft facet JSON accompanies this document. Its members are validated against
the bundled vocabulary, but assignments are candidate classifications, not verified
semantic facts. It is a coverage scaffold, not a finished dictionary.

## Representative rules

| Combination | Proposed result and explanation |
|---|---|
| sidelocks + blonde hair | Compatible example on one person: detail plus colour. |
| short hair + long hair | Conditional tension for the same region; possible across people, regions, extensions or a short cut with long locks. |
| sitting + standing | Conflict only under one primary body-support state for one person at one instant; otherwise warn/unknown. |
| blonde hair + blue hair | Allowed with multiple colours/regions/people; do not put all hair colours in an exclusive clique. |
| blue eyes + brown eyes | May describe different eyes/people or mixed colour. Require per-eye scope before excluding. |
| long hair + very long hair | Candidate broader/narrower relation to review/import, not a default exclusion. |
| smiling + crying | Compatible possibility; facial affect is multivalued. |
| shirt + jacket | Compatible layering; the item/layer assignment matters. |
| bald + sidelocks | Conditional tension on the same scalp; regional baldness, fantasy definitions and other subjects must be considered. |
| day + night | Contextual at the same place/time/view; split panels and different depicted scenes can contain both. |

Rules may have exceptions and several prerequisites. They must not infer that
all different facets are compatible: baldness versus hair features is cross-facet.
Likewise, do not infer exclusion transitively or inherit it indiscriminately
through a taxonomy. Source implications, aliases and co-tagging are different data.

## Storage

Use SQLite in the ComfyUI server's local user directory, with foreign keys,
transactional migrations and FTS5 for vocabulary/rule search. The graph is logical
data stored in relational tables; it does not require a separate graph server.
Use PostgreSQL if this later becomes a centrally edited multi-user service.
Do not put a shared writable SQLite file on a network share for several servers.

`tag-coincidence-schema.sql` defines the proposed tables:

- tag, alias: canonical identities and spelling; keep display labels separate.
- facet, tag_facet: classification, scope and confidence/review status.
- relation: sparse direct facts such as is_a, implies, compatible and excludes.
- rule, rule_dependency: conditional/n-ary rules and their indexed tag dependencies.
- provenance, assessment: source revisions, rationale and human review.
- override: a user's preference takes precedence without editing an upstream pack.
- corpus, cooccurrence: marginal and joint counts from one versioned corpus.
- generation_observation: optional workflow/model evidence, separate from semantics.
- pack: bundled knowledge versioning and migration boundaries.

For conditions, use a validated JSON AST, never executable Python/SQL. Supported
operators should be a small allowlist: all, any, not, tag_present, facet_equals,
same_subject, same_region, same_frame, same_view, and count_at_most. A rule's
dependencies must be generated from its AST at import time, not hand-maintained.
Bind entity variables explicitly; a rule must not join unrelated subjects.

Keep reviewed packs as versioned text assets and import them into SQLite. Keep
user edits and observations outside the repository and across pack upgrades.
Imported/upstream/candidate rules default to advisory until reviewed. Retain the
source tag names and unresolved-alias queue; do not silently drop missing tags.

## Population and validation

1. Import every existing vocabulary entry and alias. Use general tags for the
   first semantic pass; character/artist/copyright tags remain searchable without
   automatically acquiring body/pose constraints.
2. Import existing tag groups as related-topic membership only. They are not
   automatically attribute facets, exclusions or compatibility claims.
3. Add the facet assignments and review high-impact rules first: posture, counts,
   hair, eyes, clothing layers and camera scope. Import verified aliases and
   implications with their exact source revisions.
4. Use templates and optionally model-assisted classification to propose further
   assignments. Keep suggestions visibly unreviewed, with coverage counts by
   facet, unknown tags and conflicting sources. Do not claim full coverage just
   because all names were imported.
5. Use corpus cooccurrence only to prioritise review and rank suggestions. Keep
   N, counts for each tag, joint counts, extraction version and scope quality.
   Use smoothed association scores plus minimum support; never turn a zero count
   or high PMI into a hard semantic rule.
6. Validate alias/implication cycles, dangling dependencies, contradictory rules,
   scope behaviour and reviewed counterexamples. Every enforced rule needs positive
   and negative examples and a short explanation the UI can show.

## Prompt evaluation

Normalize aliases, identify tag occurrences and scope, expand only approved
implications, retrieve relevant rules using rule_dependency, then evaluate guards
and user overrides. A contextual judgement must not be cached solely by tag pair:
include scopes, assumptions, enabled rules, pack and user-override revisions.

Apply constraints to the resolved/selected optional branches, or compile them as
Boolean constraints for sampling. Do not treat alternatives that cannot coexist
in one run as if all were simultaneously active.

Do not turn a whole connected conflict component into one alternatives chip.
If A excludes B and B excludes C, A and C may still coexist. A valid sampler must
retain that combination. Start with warnings; enable automatic disabling only
for reviewed rules whose scopes and assumptions are known. User locks win; show
an unsatisfiable explanation rather than silently dropping locked tags.

## Sources

- Current local implementation: exclusive_tags.py, web/src/TagConflicts.ts,
  data/exclusive-tags.json and data/danbooru-source.json.
- SQLite suitability: https://www.sqlite.org/whentouse.html
- SQLite full-text search: https://www.sqlite.org/fts5.html
- Existing tag-group source: https://danbooru.donmai.us/wiki_pages/tag_groups
  (membership is topic organisation, not a compatibility judgement).
