import importlib
import json
from pathlib import Path
import sys
import tempfile
import types
import unittest
from aiohttp import web
from aiohttp.test_utils import TestClient, TestServer
from PIL import Image, PngImagePlugin
ROOT=Path(__file__).resolve().parents[1]
package=types.ModuleType('catalogue_test');package.__path__=[str(ROOT)];sys.modules[package.__name__]=package
sys.modules.setdefault('folder_paths',types.ModuleType('folder_paths'))
module=importlib.import_module('catalogue_test.catalogue_metadata')
scanner=importlib.import_module('catalogue_test.folder_scanner')
class CatalogueTests(unittest.IsolatedAsyncioTestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup);self.root=Path(self.temp.name)
  sources=json.dumps({'version':1,'images':[{'prompt':{'positive':'blue eyes','negative':'blur'},'metadata':{'workflow':'x'*300000},'preview':'data:image/png;base64,'+'x'*10000}]})
  self.metadata={'prompt':{'1':{'class_type':'GalleryImageSource','inputs':{'sources':sources}},'2':{'class_type':'GalleryPromptEncode','inputs':{'text':'long hair','source_text':['1',4],'rules_state':'x'*100000}}},'workflow':{'nodes':[{'id':1,'type':'GalleryImageSource','widgets_values':[sources],'properties':{'gallery_source_history':['x'*300000]}}]},'gallery_prompts':{'2':{'text':'{long hair|short hair}','resolved':'long hair, blue eyes','rules_program':'x'*100000}}}
  info=PngImagePlugin.PngInfo()
  for key,value in self.metadata.items():info.add_text(key,json.dumps(value))
  self.path=self.root/'literal %20 # image.png';Image.new('RGB',(16,12)).save(self.path,pnginfo=info)
 def test_projection_is_small_preserves_prompt_semantics_and_never_changes_original(self):
  original=self.path.read_bytes();full,_=scanner._scan_for_images(str(self.root),'output',True,organize_files=False)
  compact,_=scanner._scan_for_images(str(self.root),'output',True,organize_files=False,compact=True)
  a=full['output'][self.path.name]['metadata'];b=compact['output'][self.path.name]['metadata']
  self.assertLess(len(json.dumps(b)),len(json.dumps(a))//100)
  prompt=json.loads(b['prompt']) if isinstance(b['prompt'],str) else b['prompt'];manifest=json.loads(prompt['1']['inputs']['sources']);self.assertEqual(manifest['images'][0]['prompt']['positive'],'blue eyes');self.assertNotIn('metadata',manifest['images'][0]);self.assertIsNone(manifest['images'][0]['preview'])
  self.assertEqual(b['gallery_prompts']['2']['resolved'],'long hair, blue eyes');self.assertNotIn('rules_program',b['gallery_prompts']['2']);self.assertTrue(b['gallery_metadata_deferred']);self.assertEqual(self.path.read_bytes(),original)
 async def test_full_metadata_is_available_on_demand_with_path_confinement(self):
  routes=web.RouteTableDef();module.register_metadata_routes(routes,lambda request:self.root)
  app=web.Application();app.add_routes(routes)
  async with TestClient(TestServer(app)) as client:
   response=await client.get('/Gallery/local-metadata',params={'url':'/static_gallery/'+self.path.name})
   self.assertEqual(response.status,200);metadata=(await response.json())['metadata'];self.assertEqual(json.loads(metadata['workflow']) if isinstance(metadata['workflow'],str) else metadata['workflow'],self.metadata['workflow']);self.assertEqual(json.loads(metadata['prompt']) if isinstance(metadata['prompt'],str) else metadata['prompt'],self.metadata['prompt'])
   for url in ['/static_gallery/../outside.png','http://evil.example/image.png','/view?filename=preview.png']:
    response=await client.get('/Gallery/local-metadata',params={'url':url});self.assertEqual(response.status,400)
if __name__=='__main__':unittest.main()
