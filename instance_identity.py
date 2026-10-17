"""Persistent, non-secret installation identity for transfer destination checks."""
import os
import uuid
from aiohttp import web


def register_instance_identity(app, routes, directory, describe):
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

    @web.middleware
    async def guard(request, handler):
        expected = request.headers.get('X-Gallery-Instance')
        if expected and expected != identity:
            return web.json_response({"error": "Gallery instance changed; pair the intended installation again."}, status=409)
        return await handler(request)

    app.middlewares.append(guard)
