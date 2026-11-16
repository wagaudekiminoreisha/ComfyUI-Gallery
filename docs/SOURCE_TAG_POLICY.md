# Source tag filters and batch prompt selection (prototype)

These controls are opt-in. Existing workflows retain their source selection,
append behavior, and unfiltered source tags.

## Character references and pose references

In Gallery Prompt Encode, label one source card Appearance and another Pose.
Choose the corresponding **Source filter** preset:

- **Appearance** omits known pose/gesture and framing/viewpoint tags from that card.
- **Pose** omits known hair, eye, clothing/accessory, skin and body-attribute tags.
- **Unfiltered** preserves incoming tags. Category checkboxes allow custom masks.

Category matching reuses the stock ruleset vocabularies and authored global tag
facets, including their aliases. It is not a complete Danbooru classifier and
does not inspect pixels. Unknown tags stay visible and are preserved.
**Filtered here** lists candidate tags removed from that source with their
categories. Identical tags in other source cards are unaffected.

Filtering preserves weights and nested groups. If an alternative is filtered to
empty, its empty slot is retained so the remaining choices do not become more
probable merely because the filter removed other options.

This first version filters the source text before composition. It does not make
prefix rules source-local: inherited and encoder-wide rules still run on the
combined prompt, and can require a tag that a source filter omitted. Manual tag
boxes are also unaffected. The existing inheritance switch can disable unwanted
prefix rules. This prototype does not change IPAdapter or ControlNet strength,
spatial guidance, regional conditioning, or cross-source conflict precedence.

## Which images supply tags

The Gallery Image Source editor has **Prompt sources** controls independent of
the pixel composition:

- **Follow composition**: the previous behavior, active image in Single mode and
  all images in stitched/grid layouts.
- **Active image**: only the active reference, regardless of layout.
- **Selected batch images**: the same references selected for the batch output.
- **All source images**: every reference loaded in that source node.

You can keep Single image output for a pose or preview while drawing character
tags from a batch. These controls do not change the images sent to IPAdapter,
ControlNet, the batch socket, or numbered image sockets.

## Combining selected images' prompt terms

- **Append as supplied** preserves current order and repetitions.
- **Union** emits unique complete terms, comparing case, spacing and underscores.
- **Common** retains terms present in every selected image's prompt metadata.
- **Minimum frequency** retains terms present in at least the configured percent
  of selected images (60% initially).

Repeated occurrences in one image count once. An image without prompt tags still
counts in the denominator. Groups and weighted expressions remain complete terms;
this is not semantic tag matching or an average of image embeddings.

Per-image exclusions/replacements run before aggregation. The source category
filter runs after aggregation, before the source cards are combined. Preview and
backend use the same selection, aggregation and mask settings. Queueing checks
that the source text still matches its declared image segments. Prefix snapshots
retain the resulting positive term contributions. Workflow save/reload preserves
the opt-in settings.

## Report and review

Gallery Load Report retains per-source merge settings and filtered-candidate
traces, including cached Gallery conditioning. Candidate traces can include tags
from alternatives that would not have been selected this run; they are not
per-tag GPU timing or memory measurements.

Review the effective prompt before queueing. For example, multiple character
references with different clothing may produce contradictory outfits under Union;
Common may omit clothing altogether. Select the aggregation and category masks
for the intended generation rather than treating consensus as visual truth.
