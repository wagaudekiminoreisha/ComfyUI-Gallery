import hashlib
import json
import hmac
import importlib
from pathlib import Path
import sys
import tempfile
import types
import unittest
from aiohttp import web
from aiohttp.test_utils import TestClient, TestServer
from PIL import Image

package = types.ModuleType('direct_gallery_test')
package.__path__ = [str(Path(__file__).resolve().parents[1])]
sys.modules[package.__name__] = package
module = importlib.import_module('direct_gallery_test.direct_connection')
PREFIX = module.PREFIX
ORIGIN = 'http://localhost:4200'
IDENTITY = '11111111-1111-4111-8111-111111111111'


class DirectConnectionTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        (self.root / 'nested').mkdir()
        Image.new('RGB', (32, 24), 'blue').save(self.root / 'nested/image.png')
        (self.root / 'private.txt').write_text('must not be served')
        (self.root / '.hidden.png').write_bytes(b'hidden')
        self.settings = {'access_key': 'fixture-shared-key'}
        @web.middleware
        async def comfy_origin_guard(request, handler):
            return web.Response(status=403, text='ComfyUI origin guard')
        app = web.Application(middlewares=[comfy_origin_guard])
        module.register_direct_connection(app, web.RouteTableDef(), lambda: self.root, IDENTITY, lambda: self.settings, lambda request: str(self.root / 'user' / 'prompt-library.json'))
        self.client = TestClient(TestServer(app))
        await self.client.start_server()

    async def asyncTearDown(self):
        await self.client.close()
        self.temp.cleanup()

    def sign(self, role, challenge, token='', origin=ORIGIN):
        message = '\n'.join(('hydrus-web-direct-v1', role, IDENTITY, challenge, origin, token))
        return hmac.new(self.settings['access_key'].encode(), message.encode(), hashlib.sha256).hexdigest()

    async def handshake(self):
        headers = {'Origin': ORIGIN}
        health = await (await self.client.get(PREFIX + '/health', headers=headers)).json()
        response = await self.client.post(PREFIX + '/handshake', headers=headers, json={'instanceId': IDENTITY, 'challenge': health['challenge'], 'proof': self.sign('client', health['challenge'])})
        self.assertEqual(response.status, 200)
        result = await response.json()
        self.assertEqual(result['proof'], self.sign('server', health['challenge'], result['session']))
        self.assertNotIn(self.settings['access_key'], str(result))
        return {'Origin': ORIGIN, 'Authorization': 'Bearer ' + result['session'], 'X-Gallery-Instance': IDENTITY}

    async def test_scoped_cors_session_and_output(self):
        response = await self.client.options(PREFIX + '/output', headers={'Origin': ORIGIN, 'Access-Control-Request-Headers': 'authorization,x-gallery-instance'})
        self.assertEqual(response.status, 204)
        self.assertEqual(response.headers['Access-Control-Allow-Origin'], ORIGIN)
        self.assertNotIn('Access-Control-Allow-Credentials', response.headers)
        response = await self.client.post(PREFIX + '/output', headers={'Origin': ORIGIN}, json={})
        self.assertEqual(response.status, 401)
        headers = await self.handshake()
        response = await self.client.post(PREFIX + '/output', headers=headers, json={})
        self.assertEqual(response.status, 200)
        result = await response.json()
        self.assertEqual([folder['name'] for folder in result['folders']], ['nested'])
        self.assertEqual(result['entries'], [])
        response = await self.client.get('/prompt', headers=headers)
        self.assertEqual(response.status, 403, 'unrelated ComfyUI routes retain the normal guard')

    async def test_catalogue_pages_are_stable_and_bound_to_the_session(self):
        headers = await self.handshake()
        response = await self.client.post(PREFIX+'/catalogue', headers={'Origin': ORIGIN}, json={})
        self.assertEqual(response.status, 401)
        for number in range(3): Image.new('RGB', (2, 2), str('blue')).save(self.root/f'{number}.png')
        response = await self.client.post(PREFIX+'/catalogue', headers=headers, json={'limit': 2, 'order': 'name'})
        page = await response.json()
        self.assertEqual(len(page['entries']), 2)
        self.assertEqual(len(page['entries'][0]['hash']), 64)
        self.assertEqual((page['entries'][0]['width'], page['entries'][0]['height']), (2, 2))
        self.assertGreater(page['entries'][0]['size'], 0)
        Image.new('RGB', (2, 2), 'red').save(self.root/'-new.png')
        response = await self.client.post(PREFIX+'/catalogue', headers=headers, json={'limit': 2, 'offset': 2, 'catalogueId': page['catalogueId']})
        rest = await response.json()
        self.assertEqual([row['id'] for row in rest['entries']], ['2.png', 'nested/image.png'])
        other = await self.handshake()
        response = await self.client.post(PREFIX+'/catalogue', headers=other, json={'catalogueId': page['catalogueId']})
        self.assertEqual(response.status, 409)

    async def test_missing_library_with_string_path_returns_empty_library(self):
        headers = await self.handshake()
        response = await self.client.get(PREFIX+'/library', headers=headers)
        self.assertEqual(response.status, 200, await response.text())
        result = await response.json()
        self.assertEqual(result['library'], {'version': 2, 'tags': [], 'prefixes': []})
        self.assertEqual(result['revision'], hashlib.sha256(b'').hexdigest())

    async def test_prefix_pairing_checks_revision_and_uses_real_local_hash(self):
        headers = await self.handshake()
        from direct_gallery_test.prefix_library import read, update
        path = self.root/'user'/'prompt-library.json'
        _, revision = read(path)
        saved = update(path, {'action': 'save', 'revision': revision, 'name': 'Portrait', 'terms': ['long hair']})
        prefix = saved['library']['prefixes'][0]['id']
        response = await self.client.get(PREFIX+'/library', headers=headers)
        self.assertEqual((await response.json())['revision'], saved['revision'])
        body = {'action': 'associate', 'revision': saved['revision'], 'prefix_id': prefix, 'items': [{'source': 'comfy', 'id': 'nested/image.png', 'hash': '0'*64}]}
        response = await self.client.post(PREFIX+'/association', headers=headers, json=body)
        self.assertEqual(response.status, 200, await response.text())
        result = await response.json()
        digest = hashlib.sha256((self.root/'nested/image.png').read_bytes()).hexdigest()
        self.assertIn('sha256:'+digest, result['library']['associations'])
        self.assertNotIn('sha256:'+'0'*64, result['library']['associations'])
        response = await self.client.post(PREFIX+'/association', headers=headers, json=body)
        self.assertEqual(response.status, 409)
        body['revision'] = result['revision']; body['items'][0]['id'] = '../private.png'
        response = await self.client.post(PREFIX+'/association', headers=headers, json=body)
        self.assertEqual(response.status, 400)

    async def test_corrupt_sidecar_does_not_hide_browsable_media(self):
        (self.root/'nested/image.png.gallery.json').write_text('{broken')
        headers = await self.handshake()
        response = await self.client.post(PREFIX+'/catalogue', headers=headers, json={})
        result = await response.json()
        self.assertEqual([row['id'] for row in result['entries']], ['nested/image.png'])
        self.assertEqual(result['entries'][0]['metadata'], {})

    async def test_catalogue_respects_virtual_and_physical_archives(self):
        path = self.root/'user'; path.mkdir()
        import os
        (path/'gallery-archive.json').write_text(json.dumps({'version': 1, 'roots': {os.path.normcase(str(self.root.resolve())): ['/static_gallery/nested/image.png']}}))
        (self.root/'_archive').mkdir()
        Image.new('RGB', (2, 2), 'blue').save(self.root/'_archive'/'old.png')
        headers = await self.handshake()
        response = await self.client.post(PREFIX+'/catalogue', headers=headers, json={})
        self.assertEqual((await response.json())['entries'], [])

    async def test_toggle_disables_access_and_revokes_sessions(self):
        headers = await self.handshake()
        self.settings['hydrus_web_enabled'] = False
        response = await self.client.get(PREFIX + '/health', headers={'Origin': ORIGIN})
        health = await response.json()
        self.assertFalse(health['enabled'])
        self.assertNotIn('challenge', health)
        response = await self.client.post(PREFIX + '/output', headers=headers, json={})
        self.assertEqual(response.status, 403)
        self.settings['hydrus_web_enabled'] = True
        response = await self.client.post(PREFIX + '/output', headers=headers, json={})
        self.assertEqual(response.status, 401)
        await self.handshake()

    async def test_wrong_key_and_challenge_replay_are_rejected(self):
        headers = {'Origin': ORIGIN}
        health = await (await self.client.get(PREFIX + '/health', headers=headers)).json()
        body = {'instanceId': IDENTITY, 'challenge': health['challenge'], 'proof': '0' * 64}
        response = await self.client.post(PREFIX + '/handshake', headers=headers, json=body)
        self.assertEqual(response.status, 403)
        body['proof'] = self.sign('client', health['challenge'])
        response = await self.client.post(PREFIX + '/handshake', headers=headers, json=body)
        self.assertEqual(response.status, 403)

    async def test_origin_pin_key_rotation_and_missing_configuration(self):
        headers = await self.handshake()
        response = await self.client.post(PREFIX + '/output', headers={**headers, 'Origin': 'https://other.example'}, json={})
        self.assertEqual(response.status, 401)
        response = await self.client.post(PREFIX + '/output', headers={**headers, 'X-Gallery-Instance': 'replacement'}, json={})
        self.assertEqual(response.status, 409)
        self.settings['access_key'] = 'changed-key'
        response = await self.client.post(PREFIX + '/output', headers=headers, json={})
        self.assertEqual(response.status, 401)
        self.settings['access_key'] = ''
        response = await self.client.post(PREFIX + '/handshake', headers={'Origin': ORIGIN}, json={})
        self.assertEqual(response.status, 409)

    async def test_tickets_thumbnails_ranges_and_path_confinement(self):
        headers = await self.handshake()
        for path in ('../private.txt', '/private.txt', '.hidden.png', 'private.txt'):
            response = await self.client.post(PREFIX + '/ticket', headers=headers, json={'id': path})
            self.assertIn(response.status, (400, 404))
        for thumbnail in (False, True):
            response = await self.client.post(PREFIX + '/ticket', headers=headers, json={'id': 'nested/image.png', 'thumbnail': thumbnail})
            ticket = (await response.json())['ticket']
            response = await self.client.get(PREFIX + '/media?ticket=' + ticket)
            self.assertEqual(response.status, 200)
            self.assertEqual(response.content_type, 'image/webp' if thumbnail else 'image/png')
            self.assertTrue(await response.read())
            if not thumbnail:
                response = await self.client.get(PREFIX + '/media?ticket=' + ticket, headers={'Range': 'bytes=0-7'})
                self.assertEqual(response.status, 206)
                self.assertEqual(await response.read(), b'\x89PNG\r\n\x1a\n')
            response = await self.client.get(PREFIX + '/media?ticket=' + ticket, headers={'Origin': 'https://other.example'})
            self.assertEqual(response.status, 403)
            self.settings['access_key'] = 'rotated'
            response = await self.client.get(PREFIX + '/media?ticket=' + ticket)
            self.assertEqual(response.status, 401)
            self.settings['access_key'] = 'fixture-shared-key'


if __name__ == '__main__': unittest.main()
