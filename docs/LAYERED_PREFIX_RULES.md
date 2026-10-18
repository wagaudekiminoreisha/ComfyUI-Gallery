# Layered prefixes, snapshots and visual rules

Image searches open on **Lineage**: the searched picture, its source and ancestors. **Generated from it** and **Same source** stay within that lineage. Enable **Include broader prefix results** to add other images paired with or descended from the same prefix. Prefix searches remain broad by design.

A parent prefix is the shared recipe; pairing several original pictures with it does not create separate recipes. Gallery Prompt Encode captures a variant when queued prefix-linked boxes or source terms differ from the parent recipe, or when the effective rules/hair policy differ. The snapshot records the unresolved tag recipe, negative terms, selected rule program and hair settings. Actual optional choices and the resolved prompt remain in each generated image's encoder metadata. Identical canonical tag/rule/hair configurations reuse a SHA-256 snapshot identity and merge image membership. Capturing a variant never rewrites the parent prefix. This is a recipe snapshot, not a copy of image files.

The prefix editor and image-prefix screen have a compact **snapshots** rail. Expand it to choose a variant, edit its tags and private rules, or **Find snapshot images**. Saving edited snapshot tags creates/reuses another immutable variant. **Parent prefix** returns to shared editing. The full editor shows associated source pictures. **Append images and prompts** offers a Reference snapshot selector for a paired prefix; the chosen snapshot is recorded on Gallery Image Source for provenance and inherited rules. Its IMAGE output can feed IPAdapter/ControlNet like any other source image.

Source-box additions now edit the workflow source rather than the shared prefix; source exclusions remain encoder-local. Queue serialization records those changes as snapshots. Changing the parent prefix remains an explicit action in the prefix editor.

## Rules and protections

**Rules & protections** has a visual editor for reusable definitions. Add a ruleset, give it a name and override family, then add action steps. Tag pools are editable chips. Each step can have a condition tree: TAG, AND (all), OR (any), or NOT (none). Conditions inspect the initially sampled tags, so an earlier ADD step cannot accidentally trigger a later condition. Preferences have named alternatives, each containing its own steps; one default is selected deterministically. Advanced declarative JSON remains available under a collapsed disclosure.

Actions are EXCLUDE, ADD, PICK ONE (a fixed required choice), AT MOST ONE (reject a competing sampled combination), and PROTECT (keep those tags out of batch edits). The S disclosure shows the affected tag pool as chips; IN BOTH shows matching template tags. These are prompt operations, not spatial ownership instructions for the model.

Prefix and snapshot screens support **Private ruleset** creation alongside tag editing. These are independent pinned attachments: editing one does not rewrite the reusable definition or other prefixes. Save the prefix before saving a new prefix's rules. Save rule edits with **Save prefix/snapshot rules**; save tag changes separately. Precedence within the same family/scope is global → prefix → snapshot → encoder. Equal-rank contradictory instructions are errors. Different families accumulate.

The old implicit mutually-exclusive-tag editor/encoder rewrite is retired. **Import legacy mutually exclusive tags** converts the preserved saved set list into AT MOST ONE global checks. Review and save the imported rules; already disabled chips remain disabled. **Import legacy blacklist as Protect rules** converts old batch protections. Advisory global dictionary warnings remain separate from executable rules.

## Counts and hair experiments

Group headers count leaf tags inside alternatives and grouped chips. With filtering/rules active they show retained/total; collapsed omitted tags are struck through. Counts describe reachable template tags, not the number sampled in one generation.

Minimal hair direction has **AND** (keep every checked attribute) and **EITHER** (sample one checked attribute per queued prompt). EITHER previews show possible tags; all images in a single generated batch share the chosen prompt. The effective sampled hair policy is recorded in image metadata.

## Browsing

Local navigation includes empty roots and subfolders, including output/download. Selecting an empty folder is allowed and shows no files; folder counts are direct contents, not recursive totals. Local grids virtualize the loaded catalogue, and the separate image-search results reveal more entries as you scroll.

Hydrus Search uses a page size (up to 200), not a total result cap. The backend freezes matching identifiers for a ten-minute sliding session and retrieves metadata only for each requested page. Scrolling near the end requests the next page; Load more is a fallback/retry. Query changes, closing the workspace and changed connections invalidate in-flight UI updates. Expired sessions ask for a fresh search. Newly added remote files appear on the next search.

Regression coverage: test_layered_rules.py, browser_layered_rules.cjs and browser_paging.cjs, plus the existing rules, source, metadata and archive suites.
