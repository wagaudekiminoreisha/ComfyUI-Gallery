# Attire and styling — first pass

Add **Attire and styling** from the encoder's **Add ruleset** menu, or attach it through the existing prefix/snapshot rule controls. It is not enabled globally by installation. Existing saved rulesets stay pinned.

## Bottoms and layering

The initial **One primary bottom · check supplied** preference checks supplied garments. `jeans, hairpin` is valid; `jeans, track pants` conflicts. Authored OR batches such as `{jeans, hairpin|track pants, hair ribbon}` are valid and sampled through the existing encoder. Two independently optional bottoms can coincide, so `{jeans|}, {track pants|}` is reported as a possible conflict. The ruleset does not silently rewrite those boxes into an OR batch.

Broad descriptions and subtypes can coexist: `pants, jeans`, `skirt, pleated skirt`, and `shorts, denim shorts` are accepted. The checks concern garment families rather than counting tags.

**Allow skirt/dress over trousers · check supplied** permits skirts or dresses over jeans, track pants, cargo pants or leggings. It still rejects two competing trouser families. **Allow multiple garments · no bottom conflicts** disables this ruleset's bottom checks; other active rulesets retain their own behavior.

Specific choices select jeans, track pants, shorts, skirt, leggings, dress or jumpsuit. Ready-made combinations include skirt over jeans, track pants or leggings, and dress over jeans. These choices remove competing bottom instructions and add the requested garments to the final prompt. Saved chips remain intact and show omissions in the editor.

## Independent styling slots

- **Upper base:** shirt, T-shirt, blouse or tank top.
- **Outer layer:** jacket, coat, cardigan or hoodie. This can accompany an upper base.
- **Headwear:** hat, beret, baseball cap or hood.
- **Worn hair accessories:** pins, clips, ribbon, bow, band or flower; also pins with a ribbon or flower. Headwear is independent, so a beret and hairpins are possible.
- **Eyewear:** glasses, sunglasses or goggles.
- **Hair actions and routing:** optionally omit hair handling/tool props, unusual wrapping/routing/effects, or both. Examples include `holding own hair`, `knife in hair`, `prehensile hair`, `tentacle hair`, `hair bondage`, and `hair through hood`. Ordinary scalp-hair attributes and worn accessories are preserved.

These slots default to keeping supplied tags. Deterministic selections are independent: a blouse with a cardigan does not suppress hairpins. Existing rules can still contradict a new selection; the shared resolver reports required/excluded conflicts.

Large rule lists have a collapsed **rule checks** disclosure. Expanding it shows the existing logical operations and tag chips; collapsing it unmounts the large list.

This first pass checks the whole flat prompt. It does not establish ownership for different characters or spatial conditioning. For scenes with several separately dressed subjects, use the multiple-garment preference where appropriate. Materials, garment-specific colours and coordinated outfit sampling are not newly inferred here.

Validation covers frontend branch checks, actual Python encoder sampling, layering, ancestor tags, outfit recipes, hair filtering and browser controls. Refresh ComfyUI and reload the rules library to see the new definition; no backend restart is required for the data/UI update.
