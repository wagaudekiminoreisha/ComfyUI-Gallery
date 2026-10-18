"""Authenticated Hydrus Web access inside ComfyUI; no companion server process."""
import asyncio
import hashlib
import hmac
import secrets
import time
from urllib.parse import quote, urlsplit
from aiohttp import web
from .output_browser import list_output, output_path, MEDIA_EXTENSIONS
from .thumbnails import ThumbnailService

PREFIX = '/Gallery/hydrus-web'


def register_direct_connection(app, routes, get_root, identity, get_settings):
    challenges, sessions, tickets = {}, {}, {}
    thumbnails = ThumbnailService(get_root)

    def key(): return get_settings().get('access_key', '')
    def fingerprint(): return hashlib.sha256(key().encode()).hexdigest()
    def prune(mapping):
        for token, record in list(mapping.items()):
            if record['expires'] < time.monotonic(): mapping.pop(token, None)
    def origin_of(request):
        origin = request.headers.get('Origin') or request.headers.get('X-Hydrus-Web-Origin', '')
        claimed = request.headers.get('X-Hydrus-Web-Origin', origin)
        parsed = urlsplit(origin)
        if claimed != origin or parsed.scheme not in ('http', 'https', 'capacitor') or not parsed.netloc or parsed.path or parsed.query or parsed.fragment or parsed.username or parsed.password:
            raise ValueError('A valid Hydrus Web origin is required.')
        return origin
    def signature(role, challenge, origin, token=''):
        message = '\n'.join(('hydrus-web-direct-v1', role, identity, challenge, origin, token))
        return hmac.new(key().encode(), message.encode(), hashlib.sha256).hexdigest()
    def authorized(request, origin):
        token = request.headers.get('Authorization', '').removeprefix('Bearer ')
        record = sessions.get(token)
        if not record or record['expires'] < time.monotonic() or record['origin'] != origin or record['key'] != fingerprint():
            raise web.HTTPUnauthorized(text='Gallery session expired; reconnect to ComfyUI.')
        if request.headers.get('X-Gallery-Instance') != identity:
            raise web.HTTPConflict(text='Gallery installation changed; confirm the intended installation.')
        return token

    async def dispatch(request):
        tail = request.path[len(PREFIX):]
        if request.content_length and request.content_length > 65536: raise web.HTTPRequestEntityTooLarge(max_size=65536, actual_size=request.content_length)
        if request.method == 'OPTIONS':
            origin_of(request)
            return web.Response(status=204)
        # Media elements cannot attach a bearer header. Tickets authorize just one
        # output path and representation, expire quickly and die with their session.
        if tail == '/media' and request.method in ('GET', 'HEAD'):
            record = tickets.get(request.query.get('ticket', ''))
            session = sessions.get(record['session']) if record else None
            if not record or record['expires'] < time.monotonic() or not session or session['expires'] < time.monotonic() or session['key'] != fingerprint():
                raise web.HTTPUnauthorized(text='Media ticket expired; reopen the file.')
            if request.headers.get('Origin') and request.headers['Origin'] != session['origin']:
                raise web.HTTPForbidden()
            target = output_path(get_root(), record['path'])
            if not target.is_file() or target.suffix.lower() not in MEDIA_EXTENSIONS: raise web.HTTPNotFound()
            if record['thumbnail']:
                try:
                    preview = await thumbnails.get('/static_gallery/' + quote(record['path'], safe='/'))
                    return web.Response(body=preview.data, content_type=preview.content_type)
                except (OSError, ValueError): raise web.HTTPNotFound(text='Thumbnail unavailable; open the original.')
            return web.FileResponse(target)
        origin = origin_of(request)
        if tail == '/health' and request.method == 'GET':
            prune(challenges)
            if len(challenges) >= 256: challenges.pop(next(iter(challenges)))
            challenge = secrets.token_hex(32)
            challenges[challenge] = {'origin': origin, 'expires': time.monotonic() + 30}
            return web.json_response({'ok': True, 'version': 1, 'instanceId': identity, 'challenge': challenge, 'configured': bool(key())})
        if tail == '/handshake' and request.method == 'POST':
            if not key(): return web.json_response({'error': 'Save the Hydrus connection in Gallery first.'}, status=409)
            body = await request.json()
            if not isinstance(body, dict): raise ValueError('Invalid handshake.')
            challenge, proof = body.get('challenge'), body.get('proof')
            record = challenges.pop(challenge, None) if isinstance(challenge, str) else None
            if not record or record['origin'] != origin or record['expires'] < time.monotonic():
                return web.json_response({'error': 'Handshake expired. Reconnect to try again.'}, status=403)
            if body.get('instanceId') != identity or not isinstance(proof, str) or not hmac.compare_digest(proof, signature('client', challenge, origin)):
                return web.json_response({'error': 'Hydrus API keys differ. Save the same Hydrus API key in Gallery and Hydrus Web.'}, status=403)
            prune(sessions)
            if len(sessions) >= 256: sessions.pop(next(iter(sessions)))
            token = secrets.token_urlsafe(32)
            sessions[token] = {'origin': origin, 'expires': time.monotonic() + 3600, 'key': fingerprint()}
            return web.json_response({'instanceId': identity, 'session': token, 'proof': signature('server', challenge, origin, token)})
        session = authorized(request, origin)
        if tail == '/output' and request.method == 'POST':
            body = await request.json()
            if not isinstance(body, dict): raise ValueError('Expected output folder request.')
            result = await asyncio.to_thread(list_output, get_root(), body.get('folder', ''), body.get('offset', 0), body.get('limit', 48), body.get('order', 'date'))
            return web.json_response({'folder': result['folder'], 'total': result['total'], 'nextOffset': result['nextOffset'],
                                     'folders': [item for item in result['items'] if item['kind'] == 'folder'],
                                     'entries': [{'id': item['path'], 'source': 'comfy', 'name': item['name'], 'mime': item['mime'], 'timestamp': item['timestamp']} for item in result['items'] if item['kind'] == 'file']})
        if tail == '/ticket' and request.method == 'POST':
            body = await request.json()
            if not isinstance(body, dict): raise ValueError('Expected a media request.')
            path = body.get('id', '')
            target = output_path(get_root(), path)
            if not target.is_file() or target.suffix.lower() not in MEDIA_EXTENSIONS: raise web.HTTPNotFound()
            prune(tickets)
            if len(tickets) >= 4096: tickets.pop(next(iter(tickets)))
            ticket = secrets.token_urlsafe(32)
            tickets[ticket] = {'path': path, 'thumbnail': body.get('thumbnail') is True, 'session': session, 'expires': time.monotonic() + 300}
            return web.json_response({'ticket': ticket})
        raise web.HTTPNotFound()

    @web.middleware
    async def direct_gateway(request, handler):
        if not (request.path == PREFIX or request.path.startswith(PREFIX + '/')):
            return await handler(request)
        try: response = await dispatch(request)
        except web.HTTPException as error: response = web.json_response({'error': error.text or error.reason}, status=error.status)
        except (ValueError, TypeError, OSError): response = web.json_response({'error': 'Invalid request or output path unavailable.'}, status=400)
        origin = request.headers.get('Origin')
        if origin:
            response.headers['Access-Control-Allow-Origin'] = origin
            response.headers['Vary'] = 'Origin'
        response.headers.update({'Access-Control-Allow-Methods': 'GET,HEAD,POST,OPTIONS',
                                 'Access-Control-Allow-Headers': 'Authorization,Content-Type,X-Gallery-Instance,X-Hydrus-Web-Origin,ngsw-bypass',
                                 'Access-Control-Expose-Headers': 'Content-Length,Content-Range,Accept-Ranges',
                                 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer'})
        return response

    # ComfyUI rejects cross-site requests before route handlers. Only this scoped,
    # authenticated protocol bypasses that guard; every other route retains it.
    app.middlewares.insert(0, direct_gateway)
