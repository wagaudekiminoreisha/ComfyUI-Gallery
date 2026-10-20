# Unified tag and prompt display

Tag boxes use one collapsible **Tags & prompt** editor instead of separate editable groups and a read-only Prompt dropdown. Opening this disclosure also opens a collapsed box. The source box uses its own disclosure and existing source-exclusion controls.

AND badges join tags used together; OR badges separate alternatives; OPTIONAL marks an optional tag, group or set of alternatives. Compound alternatives retain their nested relationships and weights. A box-level behavior is displayed around its chips without changing their stored identity or prompt syntax.

Rule-omitted tags are struck through in this same editor. This is a preview of filtering, not a disabled editing state: chips and group members remain selectable, removable, copyable and draggable. Omitted members can therefore be moved or edited without switching to a second display. Disabled chips and unused metadata retain their existing restrictions.

Positive and negative encoders share this editor. The actual template and last encoded prompt remain available below it for inspecting output syntax and sampled choices.

Validation: `tests/browser_merged_prompt.cjs` covers both encoder titles, logical badges, collapse/expand, editing, group-member removal and dragging rule-omitted members. Existing layered-rule and encoder-feedback browser tests cover snapshots, rule effects, resizing and cross-editor dragging.

This change only updates the frontend. Hard-refresh ComfyUI to load the rebuilt extension; a backend restart is unnecessary.
