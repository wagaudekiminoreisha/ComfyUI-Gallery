import importlib.util
import tempfile
import unittest
import hashlib
import hmac
from pathlib import Path
from aiohttp import web
from aiohttp.test_utils import TestClient, TestServer

spec = importlib.util.spec_from_file_location('instance_identity', Path(__file__).resolve().parents[1] / 'instance_identity.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class IdentityTests(unittest.IsolatedAsyncioTestCase):
    async def test_identity_persists_and_guard_blocks_wrong_destination(self):
        with tempfile.TemporaryDirectory() as directory:
            settings = {}
            async def create():
                app, routes = web.Application(), web.RouteTableDef()
                writes = []
                module.register_instance_identity(app, routes, directory, lambda: {'mediaRootMatches': False}, lambda: settings)

                @routes.post('/upload/image')
                async def upload(request):
                    writes.append(True)
                    return web.json_response({'ok': True})

                app.add_routes(routes)
                client = TestClient(TestServer(app))
                await client.start_server()
                return client, writes

            client, writes = await create()
            try:
                identity = await (await client.get('/Gallery/instance')).json()
                self.assertFalse(identity['mediaRootMatches'])
                response = await client.post('/Gallery/handshake', json={})
                self.assertEqual(response.status, 409)
                settings['access_key'] = 'fixture-shared-hydrus-key'
                nonce = 'a' * 64
                message = 'hydrus-web-handshake-v1\n{}\n' + identity['instanceId'] + '\n' + nonce
                proof = lambda role: hmac.new(settings['access_key'].encode(), message.format(role).encode(), hashlib.sha256).hexdigest()
                response = await client.post('/Gallery/handshake', json={'nonce': nonce, 'proof': 'wrong'})
                self.assertEqual(response.status, 403)
                response = await client.post('/Gallery/handshake', json={'nonce': nonce, 'proof': proof('client')})
                self.assertEqual(response.status, 200)
                result = await response.json()
                self.assertEqual(result['proof'], proof('server'))
                self.assertNotIn(settings['access_key'], str(result))
                response = await client.post('/upload/image', headers={'X-Gallery-Instance': 'wrong'})
                self.assertEqual(response.status, 409)
                self.assertEqual(writes, [])
                response = await client.post('/upload/image', headers={'X-Gallery-Instance': identity['instanceId']})
                self.assertEqual(response.status, 200)
                self.assertEqual(writes, [True])
            finally:
                await client.close()
            restarted, _ = await create()
            try:
                self.assertEqual((await (await restarted.get('/Gallery/instance')).json())['instanceId'], identity['instanceId'])
            finally:
                await restarted.close()


if __name__ == '__main__':
    unittest.main()
