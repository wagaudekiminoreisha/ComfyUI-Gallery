import importlib.util
from pathlib import Path
import tempfile
import unittest
from aiohttp import web
from aiohttp.test_utils import TestClient,TestServer

spec=importlib.util.spec_from_file_location('output_browser',Path(__file__).resolve().parents[1]/'output_browser.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)


class OutputBrowserTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.temp=tempfile.TemporaryDirectory(prefix='gallery-output-test-');self.root=Path(self.temp.name)/'output';self.root.mkdir()
        (self.root/'nested').mkdir();(self.root/'nested'/'image.png').write_bytes(b'fake image; listing must not decode metadata')
        (self.root/'first.png').write_bytes(b'png');(self.root/'notes.txt').write_text('private')
        (self.root/'.hidden.png').write_bytes(b'hidden')
        routes=web.RouteTableDef();module.register_output_routes(routes,lambda:self.root)
        app=web.Application();app.add_routes(routes);self.client=TestClient(TestServer(app));await self.client.start_server()

    async def asyncTearDown(self):
        await self.client.close();self.temp.cleanup()

    async def test_shallow_folders_pagination_and_media_only(self):
        first=await(await self.client.get('/Gallery/output-directory?limit=1')).json()
        self.assertEqual(first['total'],2);self.assertEqual(first['items'][0]['kind'],'folder');self.assertEqual(first['nextOffset'],1)
        second=await(await self.client.get('/Gallery/output-directory?offset=1')).json()
        self.assertEqual(second['items'][0]['name'],'first.png')
        nested=await(await self.client.get('/Gallery/output-directory?path=nested')).json()
        self.assertEqual(nested['items'][0]['path'],'nested/image.png');self.assertNotIn('metadata',nested['items'][0])
        response=await self.client.get(nested['items'][0]['url']);self.assertEqual(await response.read(),b'fake image; listing must not decode metadata')

    async def test_traversal_hidden_and_nonmedia_are_unavailable(self):
        for path in ['../','C:/','nested/../../','/tmp','nested\\escape']:
            response=await self.client.get('/Gallery/output-directory',params={'path':path});self.assertEqual(response.status,400,path)
        for path in ['../outside.png','.hidden.png','notes.txt']:
            response=await self.client.get('/Gallery/output-file',params={'path':path});self.assertEqual(response.status,404,path)

    async def test_linked_directories_do_not_escape_output(self):
        outside=Path(self.temp.name)/'outside';outside.mkdir()
        try:(self.root/'linked').symlink_to(outside,target_is_directory=True)
        except OSError:self.skipTest('Symlink creation is unavailable on this Windows installation.')
        result=module.list_output(self.root)
        self.assertNotIn('linked',[item['name'] for item in result['items']])
        with self.assertRaises(ValueError):module.output_path(self.root,'linked')


if __name__=='__main__':unittest.main()
