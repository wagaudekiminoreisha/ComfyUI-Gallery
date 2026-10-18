"""User-scoped archive membership. Originals are never moved, edited or deleted."""
import asyncio
import json
import os
from pathlib import Path
import tempfile
import threading
from urllib.parse import urlsplit
from aiohttp import web

LOCK = threading.RLock()


def archive_update(path, root, urls=None, archived=True):
    path = Path(path)
    root_key = os.path.normcase(str(Path(root).resolve()))
    with LOCK:
        data = json.loads(path.read_text(encoding='utf-8')) if path.exists() else {'version': 1, 'roots': {}}
        if not isinstance(data, dict) or data.get('version') != 1 or not isinstance(data.get('roots'), dict): raise ValueError('Invalid archive file')
        members = data['roots'].get(root_key, [])
        if not isinstance(members, list) or any(not isinstance(url, str) for url in members): raise ValueError('Invalid archive entries')
        current = set(members)
        if urls is not None:
            if not isinstance(urls, list) or len(urls) > 10000 or not isinstance(archived, bool): raise ValueError('Invalid archive operation')
            for url in urls:
                if not isinstance(url, str) or len(url) > 8192 or not url.startswith('/static_gallery/'): raise ValueError('Only local Gallery media can be archived')
            current = current.union(urls) if archived else current.difference(urls)
            data['roots'][root_key] = sorted(current)
            path.parent.mkdir(parents=True, exist_ok=True)
            temporary = None
            try:
                with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=path.parent, delete=False) as stream:
                    temporary = stream.name
                    json.dump(data, stream, ensure_ascii=False)
                os.replace(temporary, path)
            finally:
                if temporary and os.path.exists(temporary): os.unlink(temporary)
        return {'urls': sorted(current)}


def register_archive_routes(routes, get_path, get_root):
    @routes.get('/Gallery/archive')
    @routes.post('/Gallery/archive')
    async def archive(request):
        try:
            origin = request.headers.get('Origin')
            if request.method == 'POST' and (request.headers.get('Sec-Fetch-Site') == 'cross-site' or origin and urlsplit(origin).netloc.lower() != request.host.lower()):
                return web.json_response({'error': 'Cross-origin archive writes are not allowed'}, status=403)
            path = get_path(request)
            if not path: raise ValueError('Current ComfyUI user is unavailable')
            root = get_root(request)
            body = await request.json() if request.method == 'POST' else {}
            if not isinstance(body, dict): raise ValueError('Expected archive operation')
            if request.method == 'POST' and not isinstance(body.get('urls'), list): raise ValueError('Expected local media URLs')
            result = await asyncio.to_thread(archive_update, path, root, body.get('urls'), body.get('archived', True))
            return web.json_response(result, headers={'Cache-Control': 'no-store'})
        except (ValueError, TypeError) as error:
            return web.json_response({'error': str(error)}, status=400)
        except OSError:
            return web.json_response({'error': 'Cannot access the Gallery archive file'}, status=500)
