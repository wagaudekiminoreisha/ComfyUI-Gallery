import importlib.util
import os
import tempfile
import unittest
from pathlib import Path
from aiohttp import web
from aiohttp.test_utils import TestClient, TestServer

spec=importlib.util.spec_from_file_location('media_cache',Path(__file__).resolve().parents[1]/'media_cache.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)

class MediaCacheTests(unittest.IsolatedAsyncioTestCase):
    async def test_mutable_output_revalidates_and_same_name_replacement_changes_etag(self):
        with tempfile.TemporaryDirectory() as temp:
            path=Path(temp)/'reuse.png';path.write_bytes(b'old image')
            app=web.Application();module.register_media_cache_policy(app);app.router.add_static('/static_gallery',temp)
            async with TestClient(TestServer(app)) as client:
                old=await client.get('/static_gallery/reuse.png');self.assertIn('no-cache',old.headers['Cache-Control']);etag=old.headers['ETag'];await old.read()
                not_modified=await client.get('/static_gallery/reuse.png',headers={'If-None-Match':etag});self.assertEqual(not_modified.status,304);self.assertIn('no-cache',not_modified.headers['Cache-Control'])
                stamp=path.stat().st_mtime_ns;path.unlink();path.write_bytes(b'new image');os.utime(path,ns=(stamp+1_000_000_000,stamp+1_000_000_000))
                fresh=await client.get('/static_gallery/reuse.png',headers={'If-None-Match':etag});self.assertEqual(fresh.status,200);self.assertEqual(await fresh.read(),b'new image');self.assertNotEqual(fresh.headers['ETag'],etag)

    async def test_only_gallery_owned_view_requests_override_view_caching(self):
        app=web.Application();module.register_media_cache_policy(app)
        async def view(request):return web.Response(body=b'preview',headers={'Cache-Control':'public, max-age=3600'})
        app.router.add_get('/view',view)
        async with TestClient(TestServer(app)) as client:
            regular=await client.get('/view');self.assertEqual(regular.headers['Cache-Control'],'public, max-age=3600')
            gallery=await client.get('/view?gallery_revision=new');self.assertIn('no-cache',gallery.headers['Cache-Control'])

if __name__=='__main__':unittest.main()
