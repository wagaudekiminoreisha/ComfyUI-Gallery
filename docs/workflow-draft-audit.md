# Workflow draft autosave audit

The current downloaded `Ipadapter+ControlNet.json` was 5,807,948 bytes (24 nodes), larger than the earlier handoff copy. `nogallerytest.json` was 646,736 bytes (22 nodes).

## Reproduced cause

An isolated Chromium session against the running ComfyUI frontend reproduced `QuotaExceededError`, DOM code 22, at:

```
Storage.setItem
writePayload (settingStore)
saveDraft
persistCurrentWorkflow (GraphView)
```

The original workflow attempted a **7,667,914-character** `Comfy.Workflow.Draft.v2:*` payload. The draft wrapper escapes already serialized widget JSON again, so the storage payload is larger than the workflow itself.

After that failed write, ComfyUI's draft module marked storage unavailable for the remainder of the page session. Both a smaller workflow and a minimal graph then returned failure without attempting another payload write. A full page reload restored persistence; the no-gallery workflow saved normally. Clearing draft keys does not reset that module-local flag.

## Serialization changes

- Source nodes keep standard input names, crops, output slots and prompt strings in their normal widget positions. Full image metadata and source history are retained losslessly in a versioned gzip archive, with identical active/history metadata stored once.
- Encoder properties retain selected groups, rules, exclusions, replacements, snapshots and legacy restoration state in the same archive. Named widget backups reference canonical positional widget values when they agree, rather than copying those strings again. Inconsistent legacy backups remain available.
- Archives expand before node configuration and when reading workflow-only generation metadata. Python readers also expand archives for prompt group resource attribution and catalogue projections. Plain existing exports still load normally. Live widget values and API prompt inputs remain expanded.
- Corrupt or unsupported archives fail explicitly. Restoration is atomic. The serializer does not clear localStorage or write to the prompt library. No workflow files were overwritten.

New compact exports require an archive-aware Gallery frontend to restore all editor/history state. Reload ComfyUI fully after installing the update, especially if a previous quota failure disabled drafts in that page session.

## Actual frontend validation

Characters measured using the real ComfyUI serializers and draft persistence handler, with only the Gallery bundle overridden in the isolated test browser:

| Workflow | Patched export | Patched draft payload | Save and round-trip |
| --- | ---: | ---: | --- |
| Full workflow | 670,741 | 710,360 | Passed, including browser reload |
| No-gallery workflow | 180,274 | 217,677 | Passed |
| Minimal graph | 731 | 882 | Passed |

All Gallery widget values, source metadata/history, rules, exclusions/replacements, snapshots and output links matched before and after restoring the saved draft. The prompt-library revision was unchanged, and the test blocked library mutation requests. The user's Firefox profile was not modified; live autosave validation used isolated Chromium.

Validation also passed 241 JavaScript tests, 226 Python tests (3 skipped), the production build, and five browser regressions covering prefix saves, nested source-group restoration, multiple sources, snapshot rules and shared chips. Python metadata/report readers were additionally checked against the real fflate archives exported by the browser test.

Run `tests/browser_workflow_drafts.cjs` with `COMFY_QA_URL`, `GALLERY_WORKFLOW_ORIGINAL`, and `GALLERY_WORKFLOW_NO_GALLERY`. `GALLERY_DRAFT_AUDIT_DIR` optionally writes local exports and a report. User workflows are not committed as test fixtures.
