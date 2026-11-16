# Gallery source imports on Windows external drives

Gallery copies each source into a complete, validated temporary file inside the ComfyUI input directory, hashes it, then publishes it under its content-addressed filename. Previously publication required a hard link. On the user's exFAT external SSD, the hard-link call failed with Windows error 1 / errno 22, producing the generic “source image could not be read or saved” response.

On Windows, unsupported-hard-link errors now fall back to a same-directory `os.rename`. Python's [Windows rename behavior](https://docs.python.org/3/library/os.html#os.rename) rejects existing destinations. The complete temporary file is therefore published without overwriting another source. Existing destinations still undergo the original regular-file and SHA-256 checks; real permission errors propagate, and temporary-file cleanup remains in place. POSIX does not use this fallback because its rename operation can replace an existing destination.

No workflow paths, source metadata, user libraries, or installed files are migrated or rewritten by this fix. It supports Windows FAT/exFAT imports through the existing source routes. Old absolute paths in custom settings, missing source files, and genuinely unwritable folders remain separate errors.

Validation reproduced the failing hard-link operation in a temporary directory on the user's actual D: exFAT drive. The patched importer then passed a real import/re-import there, with exact source bytes, provenance, deduplication and cleanup verified. Automated coverage checks normal imports, unsupported links, existing-file collisions, concurrent publication, real permission failures and failed-rename cleanup.
