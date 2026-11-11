# Scriptable prompt rulesets

Open **Gallery workspace → Rules & protections**. Rulesets contain policy, while prefixes contain tags. Hair and Pose are supplied as starter definitions.

1. Pick a definition in **Ruleset settings** and choose **Global**, **On demand**, or **Disabled**.
2. **Global** applies the preferences from **Global encoder defaults** to every Gallery Prompt Encode without adding a visible box. Saving updates open encoders and the ComfyUI queue. Global settings apply to positive and negative encoders.
3. **On demand** applies through an explicit encoder, prefix, or snapshot attachment. **Disabled** blocks existing attachments and removes the ruleset from Add ruleset. Switching it back restores its saved preferences.
4. Add a global ruleset on an encoder to override its settings in that family and policy channel. Prefix attachments have an **Override on encoder** button that copies their preferences.

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

The broad global congruency dictionary remains advisory. Enabled global rulesets and active attachments enforce their own configured policies.

## Storage and concurrency

`gallery-rulesets.json` lives in the current ComfyUI user's directory, separately from `prompt-library.json`. It stores definitions, global attachments, and prefix-ID bindings. Workflow properties and hidden `rules_state` input carry pinned programs. Saves are atomic and revision checked; a concurrent edit returns a conflict instead of overwriting another user's draft. Library files are limited to 8 MiB. Back up this file alongside the prompt library when moving installations.

## Rule controls and operation display

Hair prompting is an optional encoder box under Rulesets. Add **Hair prompting · attribute filter** from the same selector as other rulesets; its Remove button disables the filter and persists its absence in the workflow. Existing saved filters remain available. New encoders start without this box. Adding it again starts at Specific hairstyle (no filtering).

Add **Injury and gore filter** to a positive encoder to omit unwanted prompt tags. Set any of **Amputation and missing limbs**, **Gore and body horror**, or **Injuries and visible blood** to **Omit tags**. These choices apply to tags from connected sources as well as tags entered on the encoder. Each category starts at **Keep supplied**.

**Disturbing content filter** adds separate preferences for **Violence, death and self-harm**, **Coercion and abuse**, **Bodily waste and vomit**, and **Infestation and decay**.

Each preference displays its operation and matching template tags. `T` means sampled tags, `Tₜ` the template's potential tags, `S` the full operand set, and `B` batch-editable tags. `∖` removes, `∪` adds, and `∩` intersects. Expand S to see every tag covered by a rule. Hair attribute checkboxes show `T′ ∩ S = T ∩ S` when kept and `T′ = T ∖ S` when omitted. Template matches can include optional alternatives; the backend still applies rules after sampling.

Expand **Tags** on a configured ruleset to inspect its tags and create exceptions. Choose a rule group, search its tags, then click a tag to toggle its treatment. Exclusion rules offer **Allow/Block**, required tags offer **Make optional/Require**, and protection and exclusivity rules have their corresponding actions. The input below the list adds another tag to that rule. **Reset exceptions** restores the full set. Conditions and preference choices still determine when each rule runs.

Tag changes on a global, prefix, or encoder attachment belong to that configuration. Changes in the reusable definition editor are used by new attachments. Encoder overrides copy their starting definition and exceptions. Exempting a selection rule's fixed value disables that selection step.

The former Global rules panel is now labelled **Compatibility review · advisory**. It remains useful for broad warnings beyond attached rulesets and never enforces additions, exclusions or blocking.
