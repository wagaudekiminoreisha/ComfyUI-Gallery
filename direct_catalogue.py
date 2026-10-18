"""Paged, read-only output metadata for the authenticated Hydrus Web connection."""
import hashlib
from functools import lru_cache
import mimetypes
import json
import os
from pathlib import Path
from .output_browser import output_path, MEDIA_EXTENSIONS
from .transfer_metadata import read_metadata
from .catalogue_metadata import compact_metadata


def archive_exclusions(library_path, root):
    path = Path(library_path).with_name('gallery-archive.json')
    if not path.exists(): return set()
    data = json.loads(path.read_text(encoding='utf-8'))
    if not isinstance(data, dict) or not isinstance(data.get('roots'), dict): raise ValueError('Invalid archive index.')
    base = Path(root).resolve(); excluded = set()
    for saved_root, members in data['roots'].items():
        folder = Path(saved_root).resolve()
        if not folder.is_relative_to(base) or not isinstance(members, list): continue
        relative = folder.relative_to(base).as_posix()
        prefix = '' if relative == '.' else relative+'/'
        for url in members:
            if isinstance(url, str) and url.startswith('/static_gallery/'):
                excluded.add('/static_gallery/'+prefix+url[len('/static_gallery/'):])
    return excluded


def listing(root, order='date', excluded=()):
    base = Path(root).resolve()
    rows = []
    for directory, folders, files in os.walk(base, followlinks=False):
        folders[:] = [name for name in folders if not (name.startswith('.') or name == '_archive')
                      and not (Path(directory)/name).is_symlink()
                      and not getattr(Path(directory)/name, 'is_junction', lambda: False)()]
        for name in files:
            if name.startswith('.') or Path(name).suffix.lower() not in MEDIA_EXTENSIONS:
                continue
            relative = (Path(directory)/name).relative_to(base).as_posix()
            if '/static_gallery/'+relative in excluded: continue
            try:
                path = output_path(base, relative)
                rows.append((relative, path.stat().st_mtime))
            except (OSError, ValueError):
                continue
    rows.sort(key=lambda row: (row[0].casefold() if order == 'name' else -row[1], row[0]))
    return rows


@lru_cache(maxsize=4096)
def cached_hash(path, size, mtime_ns):
    digest = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024*1024), b''): digest.update(chunk)
    return digest.hexdigest()


def catalogue(root, offset=0, limit=100, order='date', rows=None):
    base = Path(root).resolve()
    if rows is None: rows = listing(root, order)
    offset = max(0, int(offset)); limit = max(1, min(200, int(limit)))
    entries = []
    for relative, timestamp in rows[offset:offset+limit]:
        try:
            path = output_path(base, relative)
            stat = path.stat()
            digest = cached_hash(str(path), stat.st_size, stat.st_mtime_ns)
            try: metadata = compact_metadata(read_metadata(path))
            except (OSError, ValueError, TypeError): metadata = {}
            entries.append({'id': relative, 'source': 'comfy', 'name': path.name,
                            'hash': digest, 'timestamp': timestamp,
                            'mime': mimetypes.guess_type(path.name)[0] or '',
                            'metadata': metadata})
        except (OSError, ValueError):
            continue
    end = offset+limit
    return {'entries': entries, 'total': len(rows), 'nextOffset': end if end < len(rows) else None}
