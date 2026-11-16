"""Mutable output filenames must be revalidated rather than served from cache."""


def register_media_cache_policy(app):
    async def prepare(request, response):
        if (request.path.startswith('/static_gallery/') or
                request.path == '/view' and 'gallery_revision' in request.query):
            response.headers['Cache-Control'] = 'private, no-cache'
    app.on_response_prepare.append(prepare)
