# Encoder workflow widget compatibility

Gallery Prompt Encode historically saved widget values by array position. Older field layouts can place hair-policy JSON in the source-mode combo, causing ComfyUI to report an unavailable value before queuing. New optional fields and frontend-added widgets must not silently move existing values.

The frontend now migrates workflow records before graph configuration, normalizes live encoder widget ordering before positional assignment, and stores versioned named widget values under `properties.gallery_encoder_widgets` when saving. A constructor hook covers individual-node configuration/copy paths; the editor has a fallback repair for hosts that skipped that hook.

Legacy detection recognizes source-mode values, hair policies, rules, prefix references and per-image omissions by their structure. Both reported Natural and Specific layouts are covered. Empty arrays cannot overwrite an already identified nonempty rules program. Source-box properties or a compiled source marker recover boxes mode when no valid source mode was saved. The first prompt value is never mistaken for a combo value merely because its text says before or after.

Named values are authoritative on subsequent loads. Unknown node types, links and unrelated widgets are not migrated. An invalid old positional layout is retained in `properties.gallery_encoder_legacy_widgets` for recovery; migration does not edit the source workflow file on disk. Reload the original workflow/image after refreshing ComfyUI to repair an already-open import.

Tests: `tests/encoder_serialization.test.cjs`, `tests/browser_encoder_serialization.cjs`, and the existing per-image exclusion, prompt-box, snapshot and ruleset-control regressions. This is a frontend compatibility fix; no backend restart is required solely for this patch.
