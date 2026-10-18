# Scriptable prompt rulesets

Open **Gallery workspace → Rules & protections**. Rulesets contain policy, while prefixes contain tags. Hair and Pose are supplied as starter definitions; all preferences initially keep the supplied prompt unchanged.

1. Choose **Global encoder defaults** or a saved prefix under **Attach rulesets**.
2. Use **Add ruleset** to attach one or more boxes, then choose deterministic preferences. Save the library.
3. On **Gallery Prompt Encode**, the **Rulesets** section has its own Add ruleset dropdown. Boxes can be enabled, collapsed, reordered and removed. Prefix attachments appear read-only with an **Override on encoder** button that copies their preferences into an editable box.
4. Existing encoders keep snapshots of their global defaults. Use **Reload global defaults** to adopt saved changes. New encoders get the current defaults. This applies to positive and negative encoders alike: keep generation-only defaults off negative encoders, or disable/remove their boxes.

Prefix attachments follow saved prefix IDs through autocomplete, palette insertion (including combined groups), prefix-editor appends, and connected Gallery Image Source positive prompts. Nested prefix references inherit attachments too. Negative-only prefixes and the Image Source negative output do not inherit positive prefix policies. Older tag boxes without a saved prefix identity must be reinserted from the library to establish this association.

## Precedence and conflicts

For each **family + policy scope**, encoder overrides prefix, which overrides global defaults. A higher-level box replaces the whole lower-level family in that scope, including preferences left at Keep supplied. To modify only one preference while keeping a prefix's others, use **Override on encoder**. Different families combine. Reordering boxes changes their presentation, not conflict resolution.

Equal-level contradictions are reported in the preview and rejected by the backend before CLIP encoding. Excluded tags cannot simultaneously be required. An `exclusive` rule rejects competing tags that actually occur together; alternatives in an OR expression may be valid. Scope is a policy precedence key, not regional conditioning or tag ownership: different scopes still act on one flat prompt and can conflict.

Rules execute after optional/OR sampling and the existing Hair prompting filter. An explicit Require or Select can therefore add a hair tag that the older filter omitted. Saved tag chips and their counts remain unchanged. The effective text, applied rule trace, and complete pinned programs are recorded in `gallery_prompts` metadata. Original sampling probabilities remain intact; no rerolling occurs.

## JSON scripts

Select a definition under **Ruleset scripts**, edit its JSON, click **Apply script draft**, then **Save rules library**. Scripts are validated declarative data; JavaScript and Python are not evaluated. Preferences generate dropdowns automatically. Attachments hold definition snapshots: replace an attached box to adopt an edited definition. Saving prefix attachments refreshes their inherited snapshots on open encoders, including other tabs on the same origin; offline workflows retain their last saved snapshots.

```json
{
  "version": 1,
  "id": "wardrobe-policy",
  "name": "Wardrobe",
  "family": "clothing",
  "rules": [],
  "choices": [{
    "id": "layering",
    "label": "Skirt layering",
    "default": "keep",
    "options": [
      {"id": "keep", "label": "Keep supplied", "rules": []},
      {"id": "skirt", "label": "Skirt without trousers", "rules": [
        {"op": "require", "tags": ["skirt"]},
        {"op": "exclude", "tags": ["pants", "track pants"]}
      ]},
      {"id": "layered", "label": "Skirt over track pants", "rules": [
        {"op": "require", "tags": ["skirt", "track pants"]}
      ]}
    ]
  }]
}
```

Operations:

| Operation | Meaning |
| --- | --- |
| `exclude` | Remove listed tags from the resolved prompt. |
| `require` | Add missing listed tags, preserving existing weights when present. |
| `select` | Keep/add `value` and exclude the other members of `tags`. |
| `exclusive` | Reject a resolved prompt containing more than one member of `tags`. |
| `protect` | Prevent listed tags from batch selection/conversion/removal; individual editing is allowed. |

Any operation may include `"if_all": ["solo", "standing"]`. Conditions inspect the sampled input before any rule modifications, so rule order cannot create cascades. Preview defers conditions dependent on optional choices. Tags are individual literals, with spaces/underscores and known aliases normalized for comparison; prompt expressions and LoRA syntax are not accepted as tag operands. No implied spatial ownership is introduced.

## Migrating the blacklist

**Import legacy blacklist as Protect rules** creates a global protection box. Until Save succeeds, the old browser list remains active. Successful save removes that legacy list, refreshes global defaults on currently open encoders, and leaves encoder overrides intact. Thereafter edit protections through the imported JSON definition and replace its attachment when changing its snapshot. Workspace tag editors use current global Protect rules; encoder editors use their effective rules, including inherited prefix policies.

The existing broad global congruency dictionary remains advisory. This feature enforces only rulesets you explicitly attach; it does not turn every advisory relationship into a blanket exclusion.

## Storage and concurrency

`gallery-rulesets.json` lives in the current ComfyUI user's directory, separately from `prompt-library.json`. It stores definitions, global attachments, and prefix-ID bindings. Workflow properties and hidden `rules_state` input carry pinned programs. Saves are atomic and revision checked; a concurrent edit returns a conflict instead of overwriting another user's draft. Library files are limited to 8 MiB. Back up this file alongside the prompt library when moving installations.
