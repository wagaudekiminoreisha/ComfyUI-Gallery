# Output directory API for Hydrus Web

Update this Gallery installation on the **ComfyUI server**, then restart ComfyUI.
The Hydrus Web output browser uses these new read-only routes:

- `GET /Gallery/output-directory?path=&offset=0&limit=48&order=date`
- `GET /Gallery/output-file?path=folder%2Fimage.png`
- `GET /Gallery/output-thumbnail?url=%2Fstatic_gallery%2Ffolder%2Fimage.png`

The root is ComfyUI's actual output directory, independent of the Gallery monitor
or its selected library root. Listing reads one directory's names and stat data;
it never recursively scans, extracts prompt metadata, auto-organizes or moves files.
Folders and media files share paginated results. Arbitrary filesystem roots,
hidden paths, traversal and links outside output are not exposed. The existing
Gallery instance middleware checks the caller's expected instance header.

Hydrus Web forwards these through its authenticated local connection. A Hydrus
API key or export pairing is not required merely to read output files; an existing
installation pin is still checked and retained. Hydrus search, tag editing,
lineage, metadata sync and transfer controls are absent from the output browser.

Both Hydrus Web and Gallery need this update. A 404 from an older Gallery gives an
explicit update-and-restart message in Hydrus Web rather than an empty browser.
The Gallery frontend bundle did not change for these Python routes.

Verification: `python -m unittest discover -s tests -p test_output_browser.py`.
