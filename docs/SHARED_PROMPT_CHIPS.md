# Shared prompt chips and provenance browsing

Prompt contributions in image append, prefix associations, crop/stitch and metadata now use the encoder chip renderer. Compound text is parsed into chips; behavior groups keep their boundaries, colors, weights and optional/alternative syntax. The All tags palette appends parsed terms instead of storing a complete recipe as one literal tag.

Read-only metadata supports selecting and copying groups or individual members. Unused alternatives are crossed out and excluded from copy/drag. The group header drags the whole group; larger individual tag targets drag one member. Moving a member within an editable editor removes it from its original group; crossing editors and copying from read-only metadata retain the original. Group behavior and outer weight travel with the member.

Default numbered boxes follow current tag-box order on removal, movement and workflow loading. Internal IDs and custom prefix names remain stable.

Node image-history tiles and crop/stitch source images share image context menus for viewing, metadata, provenance search and prefix associations where an original is available. Escape dismisses the image menu before the editor or history popover.

Folder lineages are chosen through a thumbnail picker with local, Hydrus and folder views. Names are saved alongside hashes. The optional provenance filter restricts results to known source/generation/prefix associations. Saved legacy hashes remain valid and display a source label rather than requiring UUID entry.

The pre-search Hydrus result sampling dropdown was removed. Use result sorting after searching. Switching source/result tabs clears gallery selections; opening tool dialogs preserves them.

Other prefix associations shows associated images outside the searched image's source family: the image, its ancestors and generations from any of those sources are excluded. It also includes associated Hydrus-only images using saved references and cached records. An empty results tab explains when nothing outside the lineage is loaded.

Hydrus exports include per-image local prefix names/IDs, recipes and matching snapshot references in the generation metadata note, in addition to embedded workflow provenance. This is a metadata association, not an automatic literal Hydrus tag. Hydrus note sync and conflict controls still apply. Copies downloaded locally retain those portable associations.
