# Anima migration: feature inventory and preservation plan

Audited before implementation against the existing modules (including PR #18).

| Feature | Current implementation | Hybrid treatment |
| --- | --- | --- |
| Dictionary, aliases, categories, search | `tag_dictionary.py`, pinned CSV/wiki data, vocabulary tree, Hydrus search and autocomplete | Reuse unchanged; add searchable reusable prose and mixed components alongside it. No automatic tag-to-prose rewrite. |
| Prefixes, affixes, presets | Version-2 user-scoped `prompt-library.json`; prefix tag IDs, negative terms, insertion format/weight/affixes | Reference existing prefixes directly, including negative terms and nested `@prefix` expansion. Explicit prefix/body/suffix placement for hybrid components. |
| Rules | `prompt_rules.py`, rules library and availability; conditions, require/exclude/protect/select/exclusive, origin/channel priority | Apply the same engine to structured tags only. Component activation rules address prose, referenced groups and presets explicitly, with an ordered trace. Never parse sentences as tags. |
| Groups | `PromptBoxes`, nested dynamic syntax, activation and source-specific edits | Keep legacy boxes unchanged; a versioned hybrid tree adds tags, prose, groups, prefix references, reusable-component references and wired sources. References preserve reusable structure. |
| Gallery and external images | Local output/input browsing, Hydrus integration, history/batches, indexed metadata, prefix/snapshot/provenance associations | Reuse gallery and source nodes. Wire their prompt strings into hybrid source components; retain source markers and metadata relationships. Conditioning adapters remain optional and independent. |
| Persistence and exchange | Atomic revision-checked server library; optional browser migration cache; compressed workflows and snapshot history | Add optional versioned hybrid library records, preserve all old fields, back up before first hybrid write. Hybrid document exports carry referenced library records; imports merge with collision checks. |
| Workflow integration | Native STRING targets plus legacy Gallery encoder CONDITIONING; source inputs and snapshot capture | Add a STRING-only hybrid composer for native Anima conditioning, keeping the legacy encoder and its widget order untouched. No sampler/model coupling. |
| Other features | Ruleset editor, negative prompts, load report, crop/stitch/image import, archive, source filters, image-to-prefix pairing | Preserve existing features. Do not claim SDXL memory estimates or adapter weights describe Anima. |

## Incompatibilities to handle explicitly

Comma splitting, whitespace normalization, tag canonicalization, dynamic alternatives and tag-rule matching are useful for tag components but destructive to literal prose. Prose must bypass them and keep paragraph boundaries. No implicit weighting, CLIP token budget, SDXL negative preset or adapter compatibility can be assumed for Anima. Existing arbitrary prose stored in tag-only fields is left untouched, with explicit copy/import controls rather than destructive conversion.

The hybrid extension uses a separately versioned document inside the current project. Existing library version 2 remains readable. Legacy library files are not migrated at startup; optional hybrid data is written only through explicit save/import operations. A one-time sibling backup precedes the first such write. The existing browser prompt-library cache is never cleared.

## Verified external interface

The [official Anima workflow](https://github.com/Comfy-Org/workflow_templates/blob/main/templates/image_anima_base_v1.json) uses standard ComfyUI model/text/VAE loaders and native prompt conditioning. The [Anima tokenizer implementation](https://github.com/Comfy-Org/ComfyUI/blob/master/comfy/text_encoders/anima.py) uses Qwen3 and T5 paths; Qwen token weights are forced to 1. The composer should provide text and let the selected native node handle encoding. A real GPU/model generation run is a separate validation from schema and text-assembly tests.
