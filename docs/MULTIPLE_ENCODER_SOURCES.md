# Multiple source cards in Gallery Prompt Encode

One encoder can receive up to eight independent STRING sources: the existing
`source_text` input and `source_text_2` through `source_text_8`.

For a pose reference and an appearance reference:

1. Send the first Gallery Image Source's IMAGE output to ControlNet and its
   positive STRING output to the encoder's `source_text`.
2. Send the second source's IMAGE output to IPAdapter and its positive STRING
   output to `source_text_2` on the same encoder.
3. Label the source cards **Pose** and **Appearance**. The corresponding input
   labels update; their internal socket names remain stable for saved workflows.

Connected additional inputs create their cards automatically. **＋ Source** adds
another card and exposes its socket on older saved encoder nodes. Move cards up
or down to control where each source appears relative to other tag boxes.

Each card has independent enable/collapse controls, per-image exclusions, group
and individual-tag edits, reset buttons, a prefix append target, and an **Inherit
prefix rules** switch. The same image path and prompt side may appear in several
cards without sharing their edits. Adding tags to a prefix through a card edits
that connected workflow source only. Prefix snapshots use that card's exclusions
and replacements when the workflow is queued.

Disabling a card omits its text and inherited rules. Disabling inheritance alone
keeps its text. Disconnecting a socket stops contributing text/rules while keeping
its card and saved edits for reconnection. Removing an additional card disconnects
its input. The original source card remains for compatibility and can be disabled.

Inherited rules from all enabled sources join the existing encoder-wide rules
program. A source label does not create a regional prompt or restrict a ruleset's
tag matching to that card. Existing family/channel priority and conflict checks
still apply. Negative source outputs keep the existing negative-source behavior;
they do not import positive prefix requirements.

Gallery sources update immediately. Other STRING providers show their separate
runtime values after execution; changing their connections clears stale values.
Runtime messages, named source edits, workflow save/reload, prefix snapshots, and
load-report group labels retain the originating socket.

Existing single-source workflows and their output socket positions stay compatible.
Legacy source markers and per-image edit payloads remain accepted. New markers
reference named sockets, and new edit payloads are partitioned by socket. No image
file-size or source-node image-count limit changes in this feature.

After this PR is merged and installed, restart ComfyUI to register the additional
optional sockets, then refresh the browser to load the editor bundle.
