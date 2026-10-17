"""Persistent, non-secret installation identity for transfer destination checks."""
import os
import uuid
import hashlib
import hmac
import re
from aiohttp import web


def register_instance_identity(app, routes, directory, describe, get_hydrus_settings=None):
    os.makedirs(directory, exist_ok=True)
    filename = os.path.join(directory, "gallery-instance-id")
    try:
        with open(filename, "x", encoding="utf-8") as stream:
            stream.write(str(uuid.uuid4()))
    except FileExistsError:
        pass
    with open(filename, encoding="utf-8") as stream:
        identity = str(uuid.UUID(stream.read().strip()))

    @routes.get('/Gallery/instance')
    async def instance(request):
        return web.json_response({"instanceId": identity, **describe()}, headers={"Cache-Control": "no-store"})

    @routes.post('/Gallery/handshake')
    async def handshake(request):
        settings = get_hydrus_settings() if get_hydrus_settings else {}
        key = settings.get('access_key')
        if not key:
            return web.json_response({'error': 'Save the Hydrus connection in Gallery first.'}, status=409)
        try:
            data = await request.json()
            nonce, proof = data.get('nonce', ''), data.get('proof', '')
            if not isinstance(nonce, str) or not re.fullmatch(r'[a-f0-9]{64}', nonce):
                raise ValueError()
            message = 'hydrus-web-handshake-v1\n{}\n' + identity + '\n' + nonce
            expected = hmac.new(key.encode(), message.format('client').encode(), hashlib.sha256).hexdigest()
            if not isinstance(proof, str) or not hmac.compare_digest(proof, expected):
                return web.json_response({'error': 'Hydrus API keys differ. Use the same saved Hydrus API key in Gallery and Hydrus Web for automatic connection.'}, status=403)
            result = hmac.new(key.encode(), message.format('server').encode(), hashlib.sha256).hexdigest()
            return web.json_response({'instanceId': identity, 'proof': result}, headers={'Cache-Control': 'no-store'})
        except (ValueError, AttributeError, TypeError):
            return web.json_response({'error': 'Invalid handshake request.'}, status=400)

    @web.middleware
    async def guard(request, handler):
        expected = request.headers.get('X-Gallery-Instance')
        if expected and expected != identity:
            return web.json_response({"error": "Gallery instance changed; pair the intended installation again."}, status=409)
        return await handler(request)

    app.middlewares.append(guard)
