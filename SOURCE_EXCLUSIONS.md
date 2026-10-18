# Per-image source exclusions

The encoder stores Left out tags separately for each source image and prompt side. Switching the active Gallery Image Source image restores its exclusions. Workflow saves and copies retain them.

For layouts containing several images, the Source image selector chooses which image's exclusions to edit. It does not change the source node's layout or active image. Omitting a tag from one image preserves the same tag supplied by another image, both in the encoded prompt and in each prefix snapshot.

Old shared exclusions are assigned once to the currently visible image (the first image in a combined layout). They are not copied onto every source. Generic text inputs without image identities retain the original shared exclusion behavior.

The encoder sends the active images' raw prompt segments with their exclusions. The backend checks that those segments still match the connected source text before filtering them separately. Stale source data produces an explicit error instead of silently applying one image's exclusions to another.

Validation: source_exclusions.test.cjs, encoder_snapshots.test.cjs, test_source_image_exclusions.py and browser_source_exclusions.cjs. The browser fixture verifies switching A → B → A, editing batch members, restoration and the serialized execution payload without running a GPU workflow.
