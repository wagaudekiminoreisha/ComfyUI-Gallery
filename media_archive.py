"""User-scoped archive membership. Optional reversible moves into a local archive folder."""
import asyncio
import json
import os
from pathlib import Path
import tempfile
import threading
from urllib.parse import urlsplit
from aiohttp import web

LOCK = threading.RLock()


def archive_update(path, root, urls=None, archived=True, move_files=False):
    path = Path(path)
    root = Path(root).resolve()
    root_key = os.path.normcase(str(root))
    with LOCK:
        data = json.loads(path.read_text(encoding='utf-8')) if path.exists() else {'version': 1, 'roots': {}}
        if not isinstance(data, dict) or data.get('version') != 1 or not isinstance(data.get('roots'), dict): raise ValueError('Invalid archive file')
        members = data['roots'].get(root_key, [])
        if not isinstance(members, list) or any(not isinstance(url, str) for url in members): raise ValueError('Invalid archive entries')
        current = set(members)
        moves = data.setdefault('moves', {}).setdefault(root_key, {})
        performed = []
        def move(source_url, target_url):
            try: from .local_library import local_path, move_no_replace
            except ImportError: from local_library import local_path, move_no_replace
            raw_source=root/source_url[len('/static_gallery/'):]
            if raw_source.is_symlink() or any(parent.is_symlink() for parent in raw_source.parents if parent!=root and root in parent.parents): raise ValueError('Archive cannot move symbolic links')
            source = local_path(root, source_url)
            target = root / target_url[len('/static_gallery/'):]
            if root not in target.resolve().parents or target.is_symlink(): raise ValueError('Archive destination must stay inside the gallery root')
            side = source.with_name(source.name + '.gallery.json')
            target_side = target.with_name(target.name + '.gallery.json')
            if target.exists() or target_side.exists(): raise ValueError('Archive destination already exists; no file was overwritten')
            for src, dst in [(source,target)] + ([(side,target_side)] if side.exists() else []):
                if src.is_symlink(): raise ValueError('Archive cannot move symbolic links')
                move_no_replace(src,dst); performed.append((src,dst))
        if urls is not None:
            if not isinstance(urls, list) or len(urls) > 10000 or not isinstance(archived, bool): raise ValueError('Invalid archive operation')
            for url in urls:
                if not isinstance(url, str) or len(url) > 8192 or not url.startswith('/static_gallery/'): raise ValueError('Only local Gallery media can be archived')
            path.parent.mkdir(parents=True, exist_ok=True)
            try:
                for url in urls:
                    if archived and move_files and url not in current and not url.startswith('/static_gallery/_archive/'):
                        target_url = '/static_gallery/_archive/' + url[len('/static_gallery/'):]
                        move(url,target_url); moves[target_url] = url; current.add(target_url); current.discard(url)
                    elif not archived and url in moves:
                        move(url,moves[url]); del moves[url]; current.discard(url)
                    elif archived: current.add(url)
                    else: current.discard(url)
            except Exception:
                try: from .local_library import move_no_replace
                except ImportError: from local_library import move_no_replace
                for src,dst in reversed(performed): move_no_replace(dst,src)
                raise
            data['roots'][root_key] = sorted(current)
            path.parent.mkdir(parents=True, exist_ok=True)
            temporary = None
            try:
                with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=path.parent, delete=False) as stream:
                    temporary = stream.name
                    json.dump(data, stream, ensure_ascii=False)
                os.replace(temporary, path)
            except Exception:
                try: from .local_library import move_no_replace
                except ImportError: from local_library import move_no_replace
                for src,dst in reversed(performed): move_no_replace(dst,src)
                raise
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
            result = await asyncio.to_thread(archive_update, path, root, body.get('urls'), body.get('archived', True), body.get('move_files') is True)
            return web.json_response(result, headers={'Cache-Control': 'no-store'})
        except (ValueError, TypeError) as error:
            return web.json_response({'error': str(error)}, status=400)
        except OSError:
            return web.json_response({'error': 'Cannot access the Gallery archive file'}, status=500)
