# Global tag rules

Generated from `tools/build_tag_rules.py`; edit that source, then rebuild the pack.

Revision **2026-10-18.1**: **79 semantic facets**, **49 candidate rules**, **643 distinct mapped tags**.

This is a broad first global pack, not an exhaustive or human-reviewed ontology. All rules are advisory. Unknown relationships remain unknown; tag-group membership never implies exclusion.

## Where it runs

Reload ComfyUI and expand **Global rules** beneath positive prefix terms or in the Gallery Prompt Encode preview. Negative prefix terms are separate. The clothing layering review remains alongside it. Existing Exclusive tags settings and saved custom exclusions are unchanged.

Only tags reachable together in one alternative branch are compared. Weights and emphasis do not change compatibility. An optional group is checked when enabled; independent optional tags can occur together. No tags are disabled, no OR branches are removed, and sampling probabilities are unchanged.

Rules bind to subject, garment, region, scene, frame or view. Known different bindings separate instances. Legacy text lacks these bindings, so its warnings are conditional. The evaluator accepts occurrence-path bindings for future structured recipes; there is not yet a UI for assigning them.

Context exceptions must be guaranteed in the matching branch and scope. A context tag in a different alternative or an optional context tag cannot globally waive a rule. They qualify unresolved scope only; explicit identical bindings still receive the check. Seiza qualifies sitting/kneeling, not arbitrary standing/lying combinations. These context heuristics are not proofs of physical impossibility.

## What the policies mean

- `one`: competing values for the same bound attribute; warn conditionally. Hierarchical names can share one value (long and very long hair).
- `mix`: multiple colours can coexist; distribution advice, not exclusion.
- `many`: independent or coexisting attributes. Membership itself generates no warning or compatibility guarantee.
- `layer`: garments can overlap intentionally. The separate clothing review handles explicit layer phrases.
- `solo_total`: a multi-tag rule for solo plus positive counts in different character categories.
- `compatible_facets`: explicit dictionary knowledge such as hair colour plus length; queryable without flooding the UI.

## Semantic facets

| Facet | Scope | Policy | Mapped names |
| --- | --- | --- | --- |
| hair.length — Hair length | subject, region, frame | one | 6 |
| hair.colour — Hair colour | subject, region, frame | mix | 14 |
| hair.distribution — Hair colour distribution | subject, region, frame | many | 6 |
| hair.presence — Scalp hair presence | subject, region, frame | many | 2 |
| hair.arrangement — Hair arrangement | subject, region, frame | many | 17 |
| hair.texture — Hair texture | subject, region, frame | many | 5 |
| hair.details — Hair details | subject, region, frame | many | 10 |
| hair.alteration — Hair additions and regional differences | subject, region, frame | many | 4 |
| hair.bangs-length — Bangs length | subject, region, frame | one | 2 |
| eyes.colour — Eye colour | subject, region, frame | mix | 12 |
| eyes.aperture — Eye openness | subject, region, frame | one | 2 |
| eyes.details — Eye details | subject, region, frame | many | 11 |
| mouth.openness — Mouth openness | subject, region, frame | one | 2 |
| expression.emotion — Expression and emotion | subject, region, frame | many | 20 |
| skin.colour — Skin colour | subject, region, frame | mix | 11 |
| skin.details — Skin details | subject, region, frame | many | 11 |
| body.build — Body build | subject, frame | many | 10 |
| body.features — Body features | subject, region, frame | many | 14 |
| body.handedness — Handedness | subject, frame | many | 1 |
| body.visibility — Visible body regions | subject, view, frame | many | 3 |
| pose.support — Primary body support | subject, frame | one | 5 |
| pose.lying-direction — Lying direction | subject, frame | one | 3 |
| pose.gait — Movement | subject, frame | many | 6 |
| pose.arms — Arm pose | subject, region, frame | many | 7 |
| pose.legs — Leg pose | subject, region, frame | many | 5 |
| pose.hand — Hand gestures | subject, region, frame | many | 11 |
| gaze.direction — Gaze direction | subject, region, view, frame | many | 5 |
| interaction.action — Interactions | subject, target, frame | many | 9 |
| clothes.upper-colour — Upper garment colour | subject, garment, region, frame | mix | 13 |
| clothes.skirt-colour — Skirt colour | subject, garment, region, frame | mix | 14 |
| clothes.dress-colour — Dress colour | subject, garment, region, frame | mix | 15 |
| clothes.pants-colour — Trouser colour | subject, garment, region, frame | mix | 13 |
| clothes.outer-colour — Outerwear colour | subject, garment, region, frame | mix | 14 |
| clothes.shoe-colour — Footwear colour | subject, garment, region, frame | mix | 15 |
| clothes.legwear-colour — Legwear colour | subject, garment, region, frame | mix | 1 |
| clothes.headwear-colour — Headwear colour | subject, garment, region, frame | mix | 1 |
| accessory.ribbon-colour — Ribbon colour | subject, garment, region, frame | mix | 14 |
| clothes.upper — Upper garments | subject, garment, frame | many | 15 |
| clothes.lower — Lower garments | subject, garment, frame | layer | 14 |
| clothes.dress — Dresses and one-piece garments | subject, garment, frame | many | 11 |
| clothes.ensemble — Ensembles | subject, garment, frame | many | 12 |
| clothes.outer — Outer layers | subject, garment, frame | many | 15 |
| clothes.legwear — Legwear | subject, garment, region, frame | many | 7 |
| clothes.footwear — Footwear | subject, garment, region, frame | many | 13 |
| clothes.headwear — Headwear | subject, garment, region, frame | many | 15 |
| clothes.handwear — Handwear | subject, garment, region, frame | many | 6 |
| clothes.material — Clothing material | subject, garment, region, frame | many | 8 |
| clothes.pattern — Clothing patterns | subject, garment, region, frame | many | 6 |
| clothes.sleeve-length — Sleeve length | subject, garment, region, frame | one | 3 |
| clothes.skirt-length — Skirt length | subject, garment, region, frame | one | 3 |
| clothes.fit — Clothing fit | subject, garment, region, frame | one | 4 |
| clothes.fastening — Garment fastening | subject, garment, region, frame | one | 3 |
| clothes.condition — Clothing condition | subject, garment, region, frame | many | 6 |
| accessory.items — Accessories | subject, garment, region, frame | many | 20 |
| count.girls — Female character count | scene, frame | one | 5 |
| count.boys — Male character count | scene, frame | one | 5 |
| count.others — Other character count | scene, frame | one | 5 |
| count.composition — Subject count composition | scene, frame | many | 2 |
| count.more — Open-ended counts | scene, frame | many | 6 |
| composition.crop — Framing | subject, view, frame | one | 4 |
| composition.azimuth — Subject view | subject, view, frame | one | 2 |
| composition.elevation — Camera elevation | subject, view, frame | one | 2 |
| composition.angle — Camera treatment | view, frame | many | 7 |
| composition.layout — Image layout | scene, view, frame | many | 6 |
| composition.focus — Subject focus | subject, view, frame | many | 7 |
| scene.location — Scene enclosure | scene, region, frame | one | 2 |
| scene.place — Scene locations | scene, region, frame | many | 26 |
| scene.time — Time of day | scene, frame | one | 7 |
| scene.season — Season | scene, region, frame | one | 3 |
| scene.weather — Weather | scene, region, frame | many | 11 |
| scene.background — Background treatment | scene, region, view, frame | many | 6 |
| light.source — Light sources | scene, region, frame | many | 7 |
| light.direction — Light direction | subject, region, view, frame | many | 3 |
| light.quality — Light quality | scene, region, view, frame | many | 3 |
| art.medium — Art medium | image, region | many | 6 |
| art.palette — Palette | image, region | many | 8 |
| art.technique — Art technique | image, region | many | 5 |
| text.content — Text and symbols | image, region | many | 9 |
| objects.presence — Objects | scene, region, frame | many | 25 |

## Rules and exceptions

| Rule | Kind | Policy | Exceptions | Rationale |
| --- | --- | --- | --- | --- |
| hair.length.values | distinct_values | warn | short_hair_with_long_locks, hair_extensions, asymmetrical_hair | Primary lengths compete only for the same hair region; longer subtypes are not mutually exclusive with long hair. |
| hair.colour.values | compatible_values | inform | multicolored_hair, two-tone_hair, gradient_hair, streaked_hair, colored_inner_hair, split-color_hair | Multiple colours can describe dyed sections, gradients or different subjects. Colour is not globally exclusive. |
| hair.bangs-length.values | distinct_values | warn | asymmetrical_bangs | Different values may need separate instances, regions or views; scope must be established before enforcement. |
| eyes.colour.values | compatible_values | inform | heterochromia, multicolored_eyes | Different eyes and multicoloured irises permit multiple colours. |
| eyes.aperture.values | distinct_values | warn | one_eye_closed | Different eyes can differ; warnings assume the same eye and instant. |
| mouth.openness.values | distinct_values | warn | — | Different values may need separate instances, regions or views; scope must be established before enforcement. |
| skin.colour.values | compatible_values | inform | multicolored_skin | Different values may need separate instances, regions or views; scope must be established before enforcement. |
| pose.support.values | distinct_values | warn | multiple_views, seiza, on_one_knee | Primary support differs only for one body at one instant; transitional poses and kneeling seats require context. |
| pose.lying-direction.values | distinct_values | warn | multiple_views | Different values may need separate instances, regions or views; scope must be established before enforcement. |
| clothes.upper-colour.values | compatible_values | inform | — | Colours may occupy separate panels, layers or accessories, including one patterned garment. |
| clothes.skirt-colour.values | compatible_values | inform | — | Colours may occupy separate panels, layers or accessories, including one patterned garment. |
| clothes.dress-colour.values | compatible_values | inform | — | Colours may occupy separate panels, layers or accessories, including one patterned garment. |
| clothes.pants-colour.values | compatible_values | inform | — | Colours may occupy separate panels, layers or accessories, including one patterned garment. |
| clothes.outer-colour.values | compatible_values | inform | — | Colours may occupy separate panels, layers or accessories, including one patterned garment. |
| clothes.shoe-colour.values | compatible_values | inform | — | Colours may occupy separate panels, layers or accessories, including one patterned garment. |
| accessory.ribbon-colour.values | compatible_values | inform | — | Colours may occupy separate panels, layers or accessories, including one patterned garment. |
| clothes.sleeve-length.values | distinct_values | warn | asymmetrical_clothes, single_sleeve, detached_sleeves | Only the same sleeve of the same garment competes. An inner long sleeve and outer sleeveless garment are valid. |
| clothes.skirt-length.values | distinct_values | warn | asymmetrical_clothes, layered_skirt | Different skirts and asymmetrical hems are exceptions; ordinary skirt is a compatible superclass. |
| clothes.fit.values | distinct_values | warn | asymmetrical_clothes | Fit is local to a garment and body region; tight inner and loose outer layers can coexist. |
| count.girls.values | distinct_values | warn | multiple_views | Exact counts compete within the same scene; counts of different categories are independent. |
| count.boys.values | distinct_values | warn | multiple_views | Exact counts compete within the same scene; counts of different categories are independent. |
| count.others.values | distinct_values | warn | multiple_views | Exact counts compete within the same scene; counts of different categories are independent. |
| composition.crop.values | distinct_values | warn | multiple_views, comic, collage | Framing differs by subject and panel; detailed insets do not contradict a full-body view. |
| composition.azimuth.values | distinct_values | warn | multiple_views, mirror, reflection | Only the same depicted surface in the same view competes; reflection and turned heads require context. |
| composition.elevation.values | distinct_values | warn | multiple_views, comic, reflection | Above and below can describe different cameras, panels or subjects. |
| scene.location.values | distinct_values | warn | window, doorway, balcony, open_door, split_screen, multiple_views | A scene can cross a threshold or show outdoors through a window. Do not impose image-wide exclusion. |
| scene.time.values | distinct_values | warn | split_screen, multiple_views | Time labels may span transitions, separate panels or hemispheres; warn only for one scene instant. |
| scene.season.values | distinct_values | warn | split_screen, multiple_views | Seasons are local to one place and time; mixed seasonal motifs are not necessarily a contradiction. |
| hair.absent-length | cross_values | warn | wig, hair_extensions | Bald scalp and scalp hair length need region or wig context. |
| count.solo-girls | cross_values | warn | multiple_views | Solo can coexist with multiple views of one character; otherwise clarify scene count. |
| count.solo-boys | cross_values | warn | multiple_views | Solo versus multiple characters needs scene identity. |
| count.solo-others | cross_values | warn | multiple_views | Solo versus multiple characters needs scene identity. |
| count.solo-open | cross_values | warn | multiple_views | An open-ended multiple count and solo need clarification for the same scene. |
| count.solo-mixed | solo_total | warn | multiple_views | Solo plus positive counts in different categories implies more than one character in the same scene. This is a multi-tag rule, not pairwise exclusion. |
| hair.colour+hair.length | compatible_facets | inform | — | Colour and length are independent attributes. |
| hair.colour+hair.details | compatible_facets | inform | — | Sidelocks and bangs coexist with hair colours. |
| hair.length+hair.arrangement | compatible_facets | inform | — | Length and styling are distinct; a bun does not require short hair. |
| expression.emotion+eyes.aperture | compatible_facets | inform | — | Emotion does not determine eye openness. |
| clothes.lower+clothes.dress | compatible_facets | inform | — | Dresses and skirts may be worn over trousers or shorts. |
| clothes.upper+clothes.outer | compatible_facets | inform | — | Shirts, sweaters and jackets can layer. |
| clothes.legwear+clothes.footwear | compatible_facets | inform | — | Legwear and footwear coexist. |
| clothes.ensemble+clothes.lower | compatible_facets | inform | — | Ensembles can be remixed with other garments. |
| clothes.material+clothes.pattern | compatible_facets | inform | — | Material and pattern are independent. |
| clothes.sleeve-length+clothes.upper-colour | compatible_facets | inform | — | Sleeve length does not constrain colour. |
| pose.support+pose.arms | compatible_facets | inform | — | Body support and arm pose are independent. |
| composition.crop+composition.elevation | compatible_facets | inform | — | Crop and camera elevation are independent. |
| scene.time+scene.weather | compatible_facets | inform | — | Weather does not determine time of day. |
| scene.location+light.source | compatible_facets | inform | — | Indoor scenes can receive sunlight and outdoor scenes artificial light. |
| art.medium+art.palette | compatible_facets | inform | — | Palette is independent of medium. |

## Database and provenance

`data/global-tag-rules.json` is the authoritative runtime pack. `tag_rules.py` validates it and builds an offline SQLite projection at `data/global-tag-rules.sqlite3` with `data/tag-rules-schema.sql`. The generated database is ignored by Git; regenerate it with `python tag_rules.py` (`--replace` explicitly rebuilds an existing generated catalog). It is not a migration of the Hydrus memory database.

The catalog includes all general names and aliases from the pinned vocabulary, facet memberships, rule dependencies, exception references, FTS5 search and the existing 91 topic groups. Topics support discovery only. The frontend consumes the same JSON pack without downloading rules or sending prompts anywhere. SQLite is not yet a server-side generation constraint engine.

Semantic statements are Gallery-authored candidates. The vocabulary and topic provenance are recorded separately; these are not claims that Danbooru has endorsed the rules. Frequency is not a compatibility probability. There is no fabricated co-occurrence dataset.

The earlier `tag-coincidence-schema.sql` is a larger design proposal. `data/tag-rules-schema.sql` is the implemented read-only candidate catalog; prefix overrides and observation tables from the proposal are not silently claimed as implemented.

## Coverage gaps

Unmapped vocabulary remains searchable in the SQLite catalog but is not semantically assessed. Free prose, escaped syntax, prompt schedules, model-specific syntax, explicit garment instances and subject bindings need structured recipe support. No semantic inference is made from gender, species, job, identity or cultural clothing categories being listed together.

175 proposed names were absent from the pinned general vocabulary and were excluded rather than invented:

`3d_render`, `6boys`, `6girls`, `6others`, `acrylic_painting`, `ambidextrous`, `aqua_headwear`, `aqua_legwear`, `arm`, `arms`, `artificial_light`, `asymmetrical_composition`, `back_view`, `bangs`, `bare_hands`, `beige_dress`, `beige_footwear`, `beige_headwear`, `beige_jacket`, `beige_legwear`, `beige_pants`, `beige_ribbon`, `beige_shirt`, `beige_skirt`, `black_headwear`, `black_legwear`, `blue_headwear`, `blue_legwear`, `bright`, `brown_headwear`, `brown_legwear`, `buttoned`, `cap`, `cel_shading`, `checkered`, `cheongsam`, `chubby`, `clothes_removed`, `cream_dress`, `cream_footwear`, `cream_headwear`, `cream_jacket`, `cream_legwear`, `cream_pants`, `cream_ribbon`, `cream_shirt`, `cream_skirt`, `cross-hatching`, `crouching`, `dark_green_hair`, `daytime`, `digital_art`, `digital_media`, `drawing`, `face`, `face_focus`, `fair_skin`, `fall`, `feet_focus`, `female_focus`, `firelight`, `fist`, `foot`, `french_braid`, `front_view`, `frontlighting`, `fur`, `gold_eyes`, `gold_legwear`, `gold_pants`, `gold_shirt`, `gold_skirt`, `gradient`, `green_headwear`, `green_legwear`, `grey_headwear`, `grey_legwear`, `group`, `hand`, `hands`, `hard_lighting`, `harsh_lighting`, `head`, `head_turn`, `hugging`, `japanese_text`, `kissing`, `leg`, `light_brown_hair`, `light_green_hair`, `light_purple_hair`, `looking_away`, `low_light`, `metal_armor`, `mist`, `mixed_media`, `motion_sequence`, `multicolored`, `multicolored_headwear`, `multicolored_legwear`, `multiple_timeframes`, `no_text`, `oil_painting`, `orange_headwear`, `orange_legwear`, `painting`, `pantsuit`, `peace_sign`, `pencil_drawing`, `photo`, `photograph`, `picture-in-picture`, `pink_headwear`, `pink_legwear`, `pinstripe`, `plaid`, `polka_dot_clothes`, `pullover`, `purple_headwear`, `purple_legwear`, `raining`, `raised_leg`, `reaching_out`, `red_headwear`, `red_legwear`, `right-handed`, `rim_lighting`, `ripped_clothes`, `rough_sketch`, `see-through`, `shocked`, `short`, `short_female`, `side_view`, `silver_eyes`, `silver_hair`, `silver_headwear`, `silver_jacket`, `silver_pants`, `silver_ribbon`, `silver_shirt`, `single_panel`, `skintight`, `slim`, `snowfall`, `soft_lighting`, `solid_color`, `solid_color_background`, `spring`, `stilettos`, `stockings`, `striped`, `subtitles`, `sunny`, `symmetrical`, `tanned_skin`, `tartan`, `text`, `thunderstorm`, `tights`, `tracksuit`, `trousers`, `turn`, `unfinished`, `uniform`, `volumetric_lighting`, `watercolor`, `white_headwear`, `white_legwear`, `wide-angle_lens`, `windy`, `wink`, `yellow_headwear`, `yellow_legwear`, `zipped_up`

## Validation

`node --test tests/global_tag_rules.test.cjs tests/clothing_rules.test.cjs tests/prompt_boxes.test.cjs tests/batch_blacklist.test.cjs`

`python -m unittest discover -s tests -p test_global_tag_rules.py`

`npm run build` in `web`, plus isolated browser fixtures for global/clothing review and prefix saving.
