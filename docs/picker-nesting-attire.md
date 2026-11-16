# Image selection, tag nesting and source-transfer policies

The node-local image picker starts in **In node**, in manifest order. A click toggles a staged selection without closing the picker; **Use images** applies the selected membership once. Closing without applying discards staged picks. Double-click keeps the existing quick-use action. **History**, Imported and Generated include removed images that can be restored. Removing an image with × persists immediately and the current grid closes the gap. Preview focus follows the surviving image rather than its old array index.

Batch selection remains separate: **Select batch images → Use batch** changes the combined/numbered batch outputs without removing unselected source records. Numbered sockets keep their existing image association through deletion to preserve downstream ControlNet/IPAdapter wires; visual positions and batch indices close gaps independently.

**Group tags…** opens an occurrence-based tree inside one top-level tag box or the selected image of a source box. Pick individual tags, entire nests, or both, then use the context menu or grouping selector. Picks across unrelated branches in that owner are allowed; picks cannot span top-level boxes, source inputs or source images. Selected ancestors include their descendants once. Matching syntax is consolidated by the existing group builder. Unselected nests and weights stay intact. Moving tags out of an old branch changes their activation according to the new grouping, as stated beside the controls. Source edits remain per-image replacements, leaving the image metadata and shared prefixes untouched, and use the existing prompt undo controls.

Individual chips also expose their grouping choices in the right-click menu.

An empty Source box reserves the prompt position, label and source-local filters for a future incoming text connection. It contributes nothing until connected. Automatic source boxes already cover normal connections; the explicit add control is useful when preparing or arranging a workflow in advance.

## Attire hierarchy

The existing `clothing` category ID remains compatible. Its child filters are tops, bottoms, outerwear, dresses/full outfits, armor, underwear/swimwear, legwear, footwear, headwear, and casual/fashion styles. They are shown only within the collapsed **Refine attire** section. A disabled parent blocks every child; restoring the parent preserves the user's finer choices.

Both frontend and Python use the same static category file. Child membership comes from the bundled Danbooru wiki vocabulary and curated garment roots/compounds, supplemented by reviewed armor terms and existing garment facets. The parent includes every child. Tag sets are built once at module load. No live wiki lookup, new node widget, per-image tag list or database schema is needed.

## Distinctions beyond attire

The pinned dictionary contains 140,782 rows, including 30,782 general tags. `tools/build_source_distinctions.py` builds 33 finer filters from its general vocabulary and the existing reviewed facet pack. These are application categories for borrowing selected aspects of an image, not new Danbooru tags or a claim that Danbooru provides this exact hierarchy.

| Area | Independently selectable distinctions |
| --- | --- |
| Hair | Colour/dye distribution; length/silhouette; arrangement/grooming; texture |
| Eyes | Iris colour; iris/pupil details |
| Body | Skin tone; build/anatomy; distinguishing marks; surface state/body paint |
| Pose | Body support/stance; locomotion; arm/leg arrangement; hand gestures |
| Framing | Crop/visible extent; camera position/angle; gaze; layout/focus |
| Expression | Emotion; eye/mouth openness |
| Environment | Location/enclosure; time/season; weather; background treatment |
| Lighting | Source; direction; quality |
| Rendering | Medium/technique; palette/colour treatment |
| Props/interaction | Objects; companion creatures; vegetation; contact/actions |

For example, one can suppress wetness/body paint while retaining freckles and scars, borrow a stance without locomotion, retain iris colour while omitting eye openness, or take scenery without its rain/night conditions. The original preset lists remain unchanged. Refinements stay collapsed under their parent; there are two additional top-level areas, Rendering and palette, and Props and interaction. Categories overlap deliberately, and unknown tags remain untouched.

The review used the bundled dictionary and wiki snapshot alongside Danbooru's current [tag-group index](https://safebooru.donmai.us/wiki_pages/tag_groups), [body parts](https://safebooru.donmai.us/wiki_pages/tag_group%3Abody_parts), [posture](https://safebooru.donmai.us/wiki_pages/tag_group%3Aposture), [image composition](https://safebooru.donmai.us/wiki_pages/tag_group%3Aimage_composition), [lighting](https://safebooru.donmai.us/wiki_pages/tag_group%3Alighting) and [background](https://safebooru.donmai.us/wiki_pages/tag_group%3Abackgrounds) pages. This is a curated vocabulary review, not an exhaustive live Danbooru database import.

## Independent garment policies

**Upper-body attire** and **Lower-body attire** are new stock rulesets. They have no global attachments and start on demand, using the existing user-defined global/on-demand/disabled controls. Upper-body attire reuses the combined policy's separate base and outer layers. Lower-body attire reuses its exact subtype-safe bottom checks and recipes, including skirt over track pants/jeans/leggings and dress over jeans. Underwear remains a separate source category; lower-body attire means bottoms, not underwear.

The combined **Attire and styling** ruleset remains available. Its upper and lower preferences now participate in separate override families, so an encoder's lower-body policy can replace only the lower portion of a global combined policy while preserving its blouse, cardigan, headwear and hair accessories. Existing pinned combined definitions receive the same family convention without rewriting saved libraries. Base rules and unrelated preferences retain their original family.

The usual origin priority still applies within the same policy channel: encoder, snapshot, prefix, global. Equal-priority conflicts remain explicit, and independent policy channels still combine. Preference-level override families can be edited in each preference's advanced controls. When carrying effective policies into a snapshot or prefix, overridden preferences and their saved selections are omitted from that copy so changing inheritance origin cannot resurrect them. Original definitions and settings remain intact.

`tools/build_stock_rulesets.py` deterministically regenerates the two garment definitions from the reviewed combined policy. It does not change availability, global attachments or user libraries. Category filtering and garment enforcement remain separate operations: taxonomy membership alone does not imply exclusivity.

Reviewed primary sources:

- [Danbooru attire groups](https://safebooru.donmai.us/wiki_pages/tag_group%3Aattire): upper garments, bottomwear, legwear/footwear, costumes, swimsuits and traditional clothing.
- [Danbooru armor](https://safebooru.donmai.us/wiki_pages/armor): protective clothing, specific armor types and related color tags.
- [Danbooru casual](https://safebooru.donmai.us/wiki_pages/casual): a character normally wearing a costume shown in modern everyday clothing. Shirts and jeans alone do not imply this tag.
- Bundled `data/danbooru-groups.json`: legwear, headwear and fashion-style vocabulary. Wiki navigation/request tags are excluded.

Categories intentionally overlap (for example armored dresses and armored boots). They are filtering sets, not mutual-exclusion rules: this change does not make wearing a top and armor contradictory or enable additional global rules. Explicit source filters run before encoder-wide rules; manually added tags continue through the existing rules pipeline. Unknown tags remain untouched. The vocabulary is bounded and curated rather than an exhaustive implication engine.

Validation: production build; JavaScript and Python category/nesting and policy tests; browser tests for staged selection, deletion reflow, history quick-use, per-image nesting/restoration, category inheritance, upper/lower override controls, hidden globals, source editing, snapshot inheritance and ruleset availability. Generators were checked for deterministic output. Tests use the isolated fixture server; the installed ComfyUI and user libraries are unchanged.
