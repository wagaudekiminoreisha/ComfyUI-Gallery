# Individual and selection exports

Image context menus in the grid, slideshow, image search and legacy cards expose **Export this image to Hydrus**. This action always opens the export dialog for the clicked image, regardless of an existing selection.

A separate **Export selected images to Hydrus (N)** action exposes deliberate batch export when multiple applicable images are selected. The existing selection toolbar remains a batch action. Exporting an individual image neither adds to nor clears the user's selection.

This fixes repeated context-menu exports accidentally including images selected during earlier slideshow browsing. The export dialog itself already replaces its requested URL list; the bug was resolving a single-image context action through the shared selection.

`tests/browser_export_scope.cjs` checks submitted URLs for consecutive grid exports, a slideshow export with retained selection, and an explicit selected-pair export. Namespace export coverage verifies that tag/metadata options remain intact.
