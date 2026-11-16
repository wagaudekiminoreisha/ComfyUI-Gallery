# Overflow audit

The browser audit exercises 1280×720, 850×650, 480×640 and 360×480 viewports, plus a floating editor resized to 320 pixels on a desktop viewport. It seeds long prefix names and tags rather than checking empty forms alone.

## Findings addressed

| Finding | Correction |
| --- | --- |
| The toolbar required 1112 pixels at an 850-pixel viewport. | Wrap header controls at every width. |
| Tag suggestions extended past the right edge of a compact viewport. | Clamp their width and position, choose the roomier vertical direction, and limit height to the available space. |
| A wide Hydrus autocomplete could flip to a negative horizontal position. | Supply its actual viewport-limited width and enable shifting as well as flipping. Apply the same policy to local library search. |
| Short, compact workspaces pushed gallery controls below an unscrollable edge. | Allow vertical workspace scrolling and constrain the folder sidebar. |
| Metadata containers exceeded the panel width by 44 pixels; previews used fixed media widths. | Include padding in container widths, constrain media/cards, and keep description tables within their panels. |
| Group headers overflowed a 320-pixel editor; populated snapshot rails exceeded their container width. | Wrap group controls and use border-box sizing for panel contents. Stack the association rail in narrow panels. |

Custom chip/member context menus and native source-preview action menus also now use measured dimensions to fit the viewport. Panel footers wrap long actions and scroll vertically when needed. Suggestions follow scrolling/resizing/moving inputs and disappear when the input is fully clipped by a scroll container.

## Runtime coverage

The automated audit opens the workspace, prefix editor, prefix associations, rules settings, gallery settings, viewer, append dialog, metadata and export window. It also opens tag suggestions, Hydrus autocomplete, rules/source-target selects, chip/member context menus, image context menus and the batch image picker. It checks both viewport bounds and unintended horizontal overflow of panel bodies, headers and footers. Deliberate vertical scrolling is allowed.

Run `tests/gallery_browser_server.py`, then `node tests/browser_overflow_audit.cjs` with `PLAYWRIGHT_MODULE` and `CHROME_PATH` configured as for the other browser tests. `GALLERY_OVERFLOW_REPORT_ONLY=1` reports findings without failing; `GALLERY_OVERFLOW_SCREENSHOTS` optionally selects a screenshot directory.

This covers the bundled Gallery interface in Chromium. Native operating-system select menus, third-party ComfyUI extensions, and every possible user stylesheet are outside the audit.

## Validation

Production build, all 210 frontend unit tests, the overflow audit, and the existing window-hierarchy, association-controls and image-source browser tests passed. The older `browser_floating_panels.cjs` test times out opening “Prompts & prefixes” on both this branch and the unchanged `origin/main` bundle in the same fixture; it is not counted as a passing check.
