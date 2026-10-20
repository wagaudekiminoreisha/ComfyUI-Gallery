# Handheld objects and hair interactions

Hair attribute filtering only covers known scalp-hair attributes. Tags such as `holding own hair`, `holding another's hair`, and `knife in hair` remain separate instructions. Hair review now lists explicit handling/prop terms found in the potential prompt, including optional branches. This identifies prompt instructions, not proof that a particular tag caused a particular generated object.

On the encoder, choose **Add ruleset → Handheld objects and hair interactions**. Its three independent preferences are:

- **Hair handling and grooming:** omit known hair-holding, grabbing, brushing and grooming actions.
- **Tools and props in hair:** omit known tool/prop tags such as `knife in hair`, `knife hair ornament` and `hair brush`.
- **Holding/action tags:** omit `holding` and general-category `holding_*` tags from the bundled Danbooru vocabulary. This deliberately broad choice also covers body/pose interactions such as holding hands; enable it only when that scope is intended.

Each preference defaults to **Keep supplied**. Choose **Omit these prompt tags** to filter it. The ruleset adds no positive or negative tags, and the saved chips remain available for editing. Ordinary worn accessories such as `hairclip` and `hairpin` are preserved. Filtering instructions does not guarantee empty hands: conditioning images, a LoRA and the checkpoint can still produce objects.

The tag lists are stored in `data/handheld-prompt-tags.json`; the matching stock definition is in `data/prompt-rulesets.json`. New definitions are offered by the existing library loader without overwriting custom definitions or pinned ruleset snapshots. Refresh the frontend to see the warning and reload the rules library if it was already open.
