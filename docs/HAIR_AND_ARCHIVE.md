# Hair prompting and workspace archive

## Hair prompting

Expand **Hair prompting** in Gallery Prompt Encode:

- **Specific hairstyle** is the backwards-compatible default. Supplied tags stay
  active; missing attributes are never filled from image metadata automatically.
- **Natural variation** omits known scalp-hair appearance tags from the encoded
  prompt, including connected `source_text`. It does not generate a random
  hairstyle tag or change checkpoint/LoRA strengths.
- **Minimal direction** retains only the checked hair attributes; length is the
  initial selection. Uncheck all to omit all recognized hair attributes.

The Hair filtering summary shows recognised potential terms omitted/retained in
the compiled template. Box tag counts still describe saved chips, including tags
that filtering leaves out. Accessories, facial/body hair and unknown terms remain.
Keeping length permits supplied length tags; it does not automatically choose one
mutually exclusive length. Optional choices are still sampled when queued.

The original boxes/chips and connected source remain intact, so changing back to
Specific restores their effect. Policy is saved in the workflow and sent through
the encoder's optional `hair_policy` widget. Filtering runs on the Python backend
after dynamic options are sampled, preserving the source's sampling probabilities.
The preview filters the template; the last encoded prompt and PNG
`gallery_prompts` record show the actual filtered result and policy.

`data/hair-prompt-tags.json` is an explicit list based on the pinned hairstyle and
hair-colour groups plus material/effect/location additions. Exact known tags and
the global pack's aliases are matched, including weighted/nested expressions.
Accessories, facial/body hair, fur trim and unknown prose are preserved. The
ambiguous standalone `highlights` alias no longer silently becomes `streaked_hair`
in either the rules or automatic spelling/export vocabulary. Explicit
`streaked_hair` remains available. Old prompts already rewritten to that tag are
not retrospectively changed.

Hair review appears in the encoder and positive prefix term editors. It checks
co-active branches, competing distribution instructions, ambiguous terms,
material/effect hair and multiple subjects with different colours. The optional
**Single-colour hairstyle** check warns about competing colour families; it never
disables tags. Multicoloured designs remain permitted. Boxes are not spatial
conditioning: subject ownership remains advisory and requires regional
conditioning or masked editing to affect placement. No checkpoint-specific
failure claims or automatic exclusions are inferred without generation tests.

## Archive

Select local media, then **Archive selected**, or use **Archive local media** in a
card's context menu / **Archive** in its viewer. The **Archive** tab shows archived
media from every scanned folder of the current local library root. Select and
**Restore selected**, or restore a card/viewer item, to return it to Media.

Archive membership is written atomically to the current ComfyUI user's
`gallery-archive.json`, keyed by resolved library root and local Gallery URL. It
survives browser/server restarts and synchronizes between same-origin Gallery
windows. Files are not moved, deleted, or modified; thumbnails, source references
and file paths remain valid. Normal Gallery browsing, local searches and prompt
catalogues exclude archived files; archive searches inspect the archive instead.
Restoring a file preserves its original folder.

Archive applies to persistent local Gallery media, including videos and other
supported types, not Hydrus originals or transient node previews. Changing library
root changes the archive being shown. This is a Gallery visibility feature: other
file browsers, Hydrus Web's direct output-folder browser, and explicitly saved
source references can still access those files. A moved/renamed file has a new URL
and is treated as new media. If archive loading fails, a visible warning appears;
the server list can be retried by reloading or refocusing Gallery.

Update Gallery's Python files and compiled frontend together, restart ComfyUI,
and hard-refresh its browser. No Hydrus Web update is required for these features.

Validation: production frontend build; shared JS/Python hair-filter fixtures,
source-to-CLIP recording, branch-aware warnings, archive root/user isolation,
concurrent writes, restoration and unchanged-original checks; built-browser
archive/reload/restore and hair-control checks; existing encoder interaction
regressions. These do not establish a particular checkpoint's visual behaviour.
