import importlib.util
import tempfile
import unittest
from pathlib import Path
from aiohttp import web
from aiohttp.test_utils import TestClient, TestServer

spec = importlib.util.spec_from_file_location('instance_identity', Path(__file__).resolve().parents[1] / 'instance_identity.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class IdentityTests(unittest.IsolatedAsyncioTestCase):
    async def test_identity_persists_and_guard_blocks_wrong_destination(self):
        with tempfile.TemporaryDirectory() as directory:
            async def create():
                app, routes = web.Application(), web.RouteTableDef()
                writes = []
                module.register_instance_identity(app, routes, directory, lambda: {'mediaRootMatches': False})

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
