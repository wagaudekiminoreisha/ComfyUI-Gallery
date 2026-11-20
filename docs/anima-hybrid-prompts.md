# Hybrid prompt management for Anima

Add **Gallery Hybrid Prompt (Anima / Text)** from `prompt/library`, then use **Open hybrid composer**. The existing **Gallery Prompt Encode (Library)** node continues to work as before for Illustrious/SDXL workflows.

The composer also opens from **Prompts & prefixes → Hybrid composer…**, or an image's **Prefix associations… → Hybrid components…**. The gallery scratchpad survives closing its window, but lasts only until page reload; save a preset or export it. A composition on a Hybrid Prompt node is saved with the ComfyUI workflow.

## Compose and reuse

- **Tags** retain comma-separated tags, trigger words, weights and nested `{a|b|}` syntax. Choices use the document seed, so preview and execution agree for the same inputs and seed. The tag field switches between text and the existing chip editor, retaining autocomplete, nested syntax and weight controls. No SDXL quality/negative preset is inserted automatically.
- **Prose** is literal text. Commas, paragraphs, braces, URLs and comment-like characters are preserved. It is never automatically converted into tags, sampled as dynamic syntax or scanned by tag rules.
- **Groups** contain either form plus other groups, prefix references and reusable references. Collapse a group, enable/disable it, or reorder its children. Disabled ancestors suppress their descendants. Group activation supports all children, an optional group with a configurable chance, one child, or one child or none. Choices are seeded and appear in the trace; explicit component rules can override the sampled activation state.
- **Prefix references** reuse the existing tag library, including aliases/spelling in that library, nested `@prefix` definitions, negative terms and attached tag rules. Deleting or breaking a reference reports an error rather than silently dropping it.
- **Reusable references** link to saved hybrid entries. Shared edits affect every reference; duplicating a component gives it independent occurrence IDs. Saving a composition as a preset retains its tree and attached component/tag rules.

Every component has polarity and prefix/body/suffix placement. Children inherit these values unless explicitly configured. Literal sections are separated with blank lines; adjacent tag sections remain comma-separated. Duplicate top-level tag spellings and cross-component duplicate syntax are consolidated using the existing tag merge machinery. Prose is not deduplicated: an intentional repeated sentence is meaningful.

The reusable library searches names, aliases, descriptions, text and categories. It supports single references and multiple selected entries. The existing dictionary/category browser, tag autocomplete and prefix library remain available under **Existing tag / prefix library**, including filtered bulk selection and insertion formats. New tag entries can have a searchable prose description without changing what their tag text contributes.

**Library metadata → Availability** supports on demand, global and disabled. Global components are added automatically; manually referencing one avoids its automatic extra copy. Disabled library entries contribute nothing. Component metadata is independent of legacy ruleset availability.

**Edit final output** enables positive/negative text overrides. Turning it off restores compilation from the untouched components. The trace records that the override was used.

## Rules

Existing tag rulesets use the same Python evaluator, origin/channel priority, conditions, exclusions, protections, dependencies and conflict errors. Global rules and rules attached to referenced prefixes remain active, and encoder rules retain their override priority. Positive tag rules do not apply to negative prose or negative tags. Separate `negative_tag_rules` are supported in portable documents.

The hybrid compiler keeps prose opaque while passing structured tags through the legacy rule engine. **Rule trace and source contributions** shows rulesets, before/after tag lists, component activations and source attribution. Explicit tag rules still run after source garment compatibility checks.

Component rules enable or disable any component ID, including a prose block, group or preset reference. Conditions require all listed tags and component IDs; `unless` blocks a rule when any listed ID is active. They settle to a fixed point, allowing dependency chains. Higher numeric priority wins per target. Conflicting equal-priority decisions, missing targets, cycles and non-convergence are errors. Rules inside a reusable group participate only while that group is active. Component rules inspect guaranteed structured tags before dynamic alternatives are sampled; they do not infer meaning from sentences.

## Gallery sources

Connect a Gallery Image Source's positive or negative STRING output to `source_text` through `source_text_8`. The composer creates a corresponding source component automatically. Choose **Structured tags** or **Literal prose** for that wire. External STRING sources are also supported; their values may only be known at execution.

The image-source node still controls which images, snapshots, prefixes and filters it supplies. Positive sources inherit the selected prefixes’ and snapshots’ private rules with their existing priorities; **Inherit source prefix rules** opts that source out. An explicitly cleared snapshot attachment list remains cleared, and historical global rules are never promoted into source-owned policies. It continues to function without ControlNet or IP-Adapter. The composer does not install conditioning adapters, convert their weights, or assume SDXL weights work with Anima.

Open the composer from an image's prefix-association window to fill its association keys. Pick reusable components and use **Associate selected components with images**. Alternatively, **Use connected image keys** fills keys from active connected Gallery sources. The stored associations are references; no image bytes or historical workflows are copied. Connected source components retrieve the associated tags/prose/groups, and their provenance appears in the report. Existing image-prefix and snapshot associations remain intact.

Generated images record both compiled polarities and hybrid source/rule information in the existing `gallery_prompts` metadata channel. Gallery extraction follows the selected output socket, preserving negative polarity. Gallery prompt filters recognize only dictionary tags and saved custom tag definitions. Typed prose is excluded from those filters and remains available through the metadata viewer’s explicit text search. Literal descriptions are not silently treated as a new set of canonical Danbooru tags.

**Import copy of legacy boxes** is explicit and nondestructive. It retains tag syntax, box order and configured rules, and copies effective source contributions with the original per-image exclusions/replacements/category filters applied. It freezes these source contributions as editable tags; wire live sources separately. The original encoder, source wires and shared library are unchanged.

## Anima wiring

The [official Anima Base v1 workflow](https://github.com/Comfy-Org/workflow_templates/blob/main/templates/image_anima_base_v1.json) currently uses `UNETLoader`, `CLIPLoader` (Qwen3 weights, loader type `stable_diffusion`), `VAELoader` and native `CLIPTextEncode` nodes. This loader label does not imply SDXL text encoding; model detection selects the Anima encoder.

1. Load `anima-base-v1.0.safetensors`, `qwen_3_06b_base.safetensors` and `qwen_image_vae.safetensors` in the corresponding native loaders.
2. Connect the Qwen loader's CLIP output to the positive and negative native `CLIPTextEncode` nodes.
3. Convert their text widgets to STRING inputs if necessary. Connect the hybrid composer's positive/negative outputs to those text inputs.
4. Keep the rest of the native sampling/VAE/output pipeline. Use LoRA or image-conditioning nodes only when their authors explicitly support Anima.

No checkpoint, encoder, sampler or adapter is loaded by the composer. **Workflow targets** also lets users append compiled output to a chosen editable prompt widget. A live STRING connection is preferable because it avoids copying text and avoids frontend dynamic-prompt preprocessing of literal prose.

The [Anima tokenizer](https://github.com/Comfy-Org/ComfyUI/blob/master/comfy/text_encoders/anima.py) has Qwen and T5 paths; Qwen weights are set to 1. The composer preserves explicitly entered tag syntax but makes no claim that SDXL weighting or CLIP token budgets transfer to Anima. Tokenization, weighting, truncation, negative conditioning and model behavior belong to the chosen conditioning implementation.

[`examples/anima-hybrid-prompt.json`](../examples/anima-hybrid-prompt.json) is a portable mixed scene/preset example. [`examples/anima-hybrid-api.json`](../examples/anima-hybrid-api.json) is a native API prompt with the hybrid node wired into positive/negative conditioning. It is API format, not a canvas export. Model filenames must match local installations. Schema/text integration was tested; full diffusion inference with Anima weights was not run.

## Persistence, imports and rollback

Damaged hybrid JSON opens a recovery view that retains the original strings. Validating a repaired document keeps the originals as a recovery copy on the workflow node; malformed content is never silently reset to an empty draft.

Existing library version 2 and all its tags, prefixes, image associations and snapshots remain unchanged. New records live in an optional `hybrid` field with its own `version: 1`; document trees also use `version: 1`. There is no startup conversion or browser-cache deletion.

Before the first explicit hybrid library write, the server creates a sibling `prompt-library.json.pre-hybrid.bak` without overwriting an existing backup. Writes keep the existing revision checks, atomic replacement and size limit. Failed validation/collisions leave the file unchanged. The browser's `comfy.prompt-library.v2` remains an optional cache, not the authoritative store.

Portable exports contain the document and only its required prefix/tag/component references, including referenced global hybrid entries and relevant rules. Importing a portable prompt loads a draft without changing the shared library. Missing references can resolve from the portable snapshot; installed shared entries take precedence. **Import portable references into library** is a separate explicit operation and refuses conflicting IDs. This prevents an import from replacing unrelated library data.

ComfyUI workflow exports compress large hybrid widget documents using the existing lossless Gallery archive. Live/API widgets remain expanded. Frontend and Python restoration handle both archived and plain exports; the same archive validation/checksum limits remain in force. Limits are 4 MiB per hybrid document/expanded prompt, 5,000 expanded components and 32 nested levels. Tag/prose text fields are bounded to 100,000 characters.

Before downgrading to a plugin version without hybrid support, export portable prompts and copy the current server library. Such older versions cannot be expected to preserve unknown extension fields when they save. The `.pre-hybrid.bak` file restores the exact pre-extension state; preserve subsequent edits separately before using it. To roll back only the extension, work on a copy of the current library and remove its optional `hybrid` field, retaining all legacy fields.

## Validation and boundaries

The regression suite covers empty/populated libraries; tag/prose searches; prefixes/suffixes; legacy rule conflicts/priorities; component activation chains/cycles; nested references; literal paragraphs; image associations; source attribution; final overrides; portable import/export; backups and rollback data; compressed round trips; positive/negative metadata and native conditioning STRING wiring. Existing Illustrious/tag-only tests remain in the suite.

No AI rewriting, inference from prose, automatic subject binding, adapter compatibility guarantee or Anima GPU benchmark is included. Existing legacy source snapshots and rules are preserved; hybrid source edits do not create new legacy prefix snapshots automatically. The preserved feature inventory and adaptation decisions are in [anima-feature-inventory.md](anima-feature-inventory.md).

The definition-backed gallery filter integration is shared with PR #21; it does not treat arbitrary sentences or descriptions as prompt tags.
