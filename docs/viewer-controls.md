# Viewer navigation

The bottom position slider jumps through the entire current viewer list, beyond the nearby thumbnail strip. Its counter and accessible label follow the current file. This also applies to detached viewers and source-image lists. Keyboard arrows/Home/End on the focused slider use its native range behavior.

| Shortcut | Action |
| --- | --- |
| Left / Right | Previous / next image |
| Home / End | First / last image |
| S or Space | Toggle selection, including with a direction button focused |
| Shift + S / Space | Select a range using the existing selection anchor |
| + / - | Zoom in / out |
| 0 | Fit image to window |
| I | Metadata |
| P | Prefix associations |
| A | Open append for img2img |
| G / Escape | Close viewer / return to grid |
| Delete | Open the existing delete/trash confirmation |

Button tooltips show their shortcuts; the bottom **?** button lists them. Commands respect the same disabled states and selection scope as the toolbar. Held selection/action keys do not trigger repeated toggles or dialogs. Text fields, editable content, menus and native media controls retain their own keyboard behavior. Ctrl/Cmd/Alt combinations remain untouched. Selection and other viewer commands also work while the position slider is focused.
