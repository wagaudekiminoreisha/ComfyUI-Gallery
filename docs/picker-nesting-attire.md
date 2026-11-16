# Image selection, tag nesting and attire filters

The node-local image picker starts in **In node**, in manifest order. A click toggles a staged selection without closing the picker; **Use images** applies the selected membership once. Closing without applying discards staged picks. Double-click keeps the existing quick-use action. **History**, Imported and Generated include removed images that can be restored. Removing an image with × persists immediately and the current grid closes the gap. Preview focus follows the surviving image rather than its old array index.

Batch selection remains separate: **Select batch images → Use batch** changes the combined/numbered batch outputs without removing unselected source records. Numbered sockets keep their existing image association through deletion to preserve downstream ControlNet/IPAdapter wires; visual positions and batch indices close gaps independently.

**Group tags…** opens an occurrence-based tree inside one top-level tag box or the selected image of a source box. Pick individual tags, entire nests, or both, then use the context menu or grouping selector. Picks across unrelated branches in that owner are allowed; picks cannot span top-level boxes, source inputs or source images. Selected ancestors include their descendants once. Matching syntax is consolidated by the existing group builder. Unselected nests and weights stay intact. Moving tags out of an old branch changes their activation according to the new grouping, as stated beside the controls. Source edits remain per-image replacements, leaving the image metadata and shared prefixes untouched, and use the existing prompt undo controls.

Individual chips also expose their grouping choices in the right-click menu.

An empty Source box reserves the prompt position, label and source-local filters for a future incoming text connection. It contributes nothing until connected. Automatic source boxes already cover normal connections; the explicit add control is useful when preparing or arranging a workflow in advance.

## Attire hierarchy

The existing `clothing` category ID remains compatible. Its child filters are tops, bottoms, outerwear, dresses/full outfits, armor, underwear/swimwear, legwear, footwear, headwear, and casual/fashion styles. They are shown only within the collapsed **Refine attire** section. A disabled parent blocks every child; restoring the parent preserves the user's finer choices.

Both frontend and Python use the same static category file. Child membership comes from the bundled Danbooru wiki vocabulary and curated garment roots/compounds, supplemented by reviewed armor terms. The parent includes every child. Tag sets are built once at module load. No live wiki lookup, new node widget, per-image tag list, stock ruleset copy, or database schema is needed.

Reviewed primary sources:

- [Danbooru attire groups](https://safebooru.donmai.us/wiki_pages/tag_group%3Aattire): upper garments, bottomwear, legwear/footwear, costumes, swimsuits and traditional clothing.
- [Danbooru armor](https://safebooru.donmai.us/wiki_pages/armor): protective clothing, specific armor types and related color tags.
- [Danbooru casual](https://safebooru.donmai.us/wiki_pages/casual): a character normally wearing a costume shown in modern everyday clothing. Shirts and jeans alone do not imply this tag.
- Bundled `data/danbooru-groups.json`: legwear, headwear and fashion-style vocabulary. Wiki navigation/request tags are excluded.

Categories intentionally overlap (for example armored dresses and armored boots). They are filtering sets, not mutual-exclusion rules: this change does not make wearing a top and armor contradictory or enable additional global rules. Explicit source filters run before encoder-wide rules; manually added tags continue through the existing rules pipeline. Unknown tags remain untouched. The vocabulary is bounded and curated rather than an exhaustive implication engine.

Validation: production build; JavaScript and Python category/nesting tests; browser tests for staged selection, deletion reflow, history quick-use, per-image nesting/restoration, category inheritance, and existing source-editing, multi-source and shared-chip flows. Tests use the isolated fixture server; the installed ComfyUI and user libraries are unchanged.
