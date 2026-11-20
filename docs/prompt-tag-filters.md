# Defined tags in gallery filters

Positive/negative prompt filters, prompt suggestions, and the local-prompt branch of Both searches accept complete tags defined in the bundled Danbooru dictionary or the shared custom tag library. Case, spaces/underscores, recognized aliases and explicit weights are normalized. Unresolved alternatives are omitted because their actual choice is unknown.

An image containing `blue_hair, this character should have her hand over her forehead` is indexed under `blue hair`. The sentence does not become a searchable prompt tag, and words inside a sentence are not mined for tags. Registering a custom trigger in the shared library makes that exact trigger searchable without reloading image metadata.

Saved custom definitions come from literal tag terms in the shared tag library and, when hybrid prompting is installed, saved components explicitly typed as tags. Explicit prose components/descriptions do not define tags. A deliberately saved multiword custom tag is still a tag; the filter does not guess based on its word count.

Filename searches keep substring matching. Actual cached Hydrus tags remain searchable in their own field, including namespaced/custom tags. The metadata viewer's explicit text search remains available for prose. Original prompts, descriptions, image metadata, prefixes and libraries are not rewritten or removed.

Definitions are loaded once into memory and refreshed when the library changes. The user-scoped endpoint supports compressed responses and conditional requests; unchanged definitions do not need to be downloaded again. No vocabulary payload is stored in workflow JSON or browser localStorage. A loading/error notice and retry control replace any silent fallback to treating arbitrary prose as tags.

Cached Hydrus prompt searches use the same definitions and alias-aware exact matching, including existing indexed notes. No index rebuild or destructive migration is required.
