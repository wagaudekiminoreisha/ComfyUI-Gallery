# Encoder layout and chip interactions

- Removing the trailing tag box fits node height to the remaining editor content,
  preserving width. Layout is measured after React commits, with a short deferred
  retry for ComfyUI's widget layout. Ordinary edits preserve manually added extra
  height unless the content needs more room. Very tall content remains scrollable.
- The editor no longer stretches its final input to fill unused node height.
  Format borders keep their colour while focused; focus uses a separate outline.
- Chip movement uses pointer hit-testing within prompt drop targets, rather than
  depending on native HTML dragging through the canvas. Moving within one editor
  reorders chips; crossing independent editors copies them.
- A temporary trash target belongs to the originating editable prompt. Read-only
  source/image tags cannot be deleted from their originals. Dropping elsewhere
  cancels. Escape, window blur and pointer cancellation end the drag.
- Native whole-box dragging remains available. Layout observers and subscriptions
  are cleaned up when a node is removed.

Verification: `npm run build` in `web`; 42 prompt/batch/rule unit tests;
`tests/browser_encoder_boxes.cjs`; `tests/browser_encoder_feedback.cjs`.
The latter uses a canvas/widget sizing fixture plus the actual Gallery prefix
workspace and deliberately cancels native chip dragstart. A live ComfyUI install
may still apply its own layout timing; the deferred fit is intended to accommodate
that without a frame-by-frame resize loop.

The committed `web/dist/assets/comfy-ui-gallery.js` includes this change. Update
Gallery and hard-refresh ComfyUI after applying the snapshot. The output-directory
API from the preceding snapshot is included as well.
