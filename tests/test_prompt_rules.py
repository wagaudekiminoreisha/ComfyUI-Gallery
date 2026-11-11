import asyncio
import importlib
import json
from pathlib import Path
import sys
import tempfile
import types
import unittest
from unittest.mock import patch
from aiohttp import web
from aiohttp.test_utils import TestClient, TestServer
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from prompt_rules import apply_rules, validate_definition, validate_boxes
from prefix_library import GalleryPromptEncode
package=types.ModuleType('rules_gallery_test');package.__path__=[str(ROOT)];sys.modules[package.__name__]=package
library=importlib.import_module('rules_gallery_test.rules_library')
def box(rules,origin='encoder',family='hair',scope='main'):
 return dict(id='test',definition=dict(version=1,id='test',name='Test',family=family,rules=rules,choices=[]),origin=origin,scope=scope,preferences={},enabled=True,collapsed=False)
def select(value):return dict(op='select',tags=['short hair','long hair'],value=value)
class RulesTests(unittest.TestCase):
 def test_tag_exceptions_apply_to_all_operations_and_survive_encoder_metadata(self):
  rules=[dict(op='exclude',tags=['gore','blood'],except_tags=['GORE']),
         dict(op='require',tags=['hat','coat'],except_tags=['coat']),
         dict(op='protect',tags=['blue_eyes','hair bow'],except_tags=['blue eyes']),
         dict(op='exclusive',tags=['standing','sitting'],except_tags=['sitting']),
         dict(op='exclude',tags=['fog'],if_all=['indoors'])]
  boxes=[box(rules)]
  class Clip:
   def tokenize(self,text):return text
   def encode_from_tokens_scheduled(self,value):return value
  metadata={}
  result=GalleryPromptEncode().encode(Clip(),'gore, (blood:1.2), blue eyes, standing, sitting, fog',
                                    rules_state=json.dumps(boxes),extra_pnginfo=metadata,unique_id='1')
  self.assertEqual(result['result'][1],'gore, blue eyes, standing, sitting, fog, hat')
  self.assertEqual(metadata['gallery_prompts']['1']['rules_applied']['protected_tags'],['hair_bow'])
  self.assertEqual(metadata['gallery_prompts']['1']['rules_program'],boxes)
  fixed=dict(op='select',tags=['short hair','long hair'],value='short hair',except_tags=['short_hair'])
  self.assertEqual(apply_rules('long hair',[box([fixed])])[0],'long hair')
  with self.assertRaises(ValueError):validate_definition(box([dict(op='exclude',tags=['gore'],except_tags=['{gore|}'])])['definition'])

 def test_precedence_noop_weights_and_conflicts(self):
  text='alpha,  (long hair:1.2), beta'
  for rows in ([],[box([dict(op='protect',tags=['long hair'])])]):self.assertEqual(apply_rules(text,rows)[0],text)
  rows=[box([select('long hair')],'global'),box([select('long hair')],'prefix'),box([select('short hair')])]
  for boxes in (rows,list(reversed(rows))):self.assertEqual(apply_rules('(long hair:1.2), blue eyes',boxes)[0],'blue eyes, short hair')
  with self.assertRaisesRegex(ValueError,'required and excluded'):apply_rules('blue eyes',[box([select('long hair')]),box([select('short hair')])])
  with self.assertRaisesRegex(ValueError,'conflict'):apply_rules('standing, sitting',[box([dict(op='exclusive',tags=['standing','sitting'])])])
 def test_condition_is_original_input_and_not_order_dependent(self):
  rules=[dict(op='require',tags=['solo']),dict(op='exclude',tags=['long hair'],if_all=['solo'])]
  self.assertEqual(apply_rules('long hair',[box(rules)])[0],'long hair, solo')
  self.assertEqual(apply_rules('solo, long hair',[box(rules)])[0],'solo')
 def test_validation_and_builtins(self):
  for value in ['{tag|other}','a,b','tag|other','(tag:1.2)','<lora:name:1>']:
   with self.assertRaises(ValueError):validate_definition(box([dict(op='require',tags=[value])])['definition'])
  validate_definition(box([dict(op='require',tags=['hair_(style)'])])['definition'])
  with self.assertRaises(ValueError):validate_boxes([{**box([]),'enabled':'false'}])
  library.validate_library(json.loads((ROOT/'data/prompt-rulesets.json').read_text(encoding='utf-8')))
 def test_encoder_samples_first_then_rules_and_records_trace(self):
  class Clip:
   def tokenize(self,text):self.text=text;return text
   def encode_from_tokens_scheduled(self,value):return value
  clip,metadata=Clip(),{}
  rows=[box([select('short hair')])]
  with patch('random.choice',side_effect=lambda options:options[0]):
   result=GalleryPromptEncode().encode(clip,'{long hair|blue eyes}',extra_pnginfo=metadata,unique_id='7',rules_state=json.dumps(rows))
  self.assertEqual(result['result'][1],'short hair');self.assertEqual(clip.text,'short hair')
  trace=metadata['gallery_prompts']['7'];self.assertEqual(trace['resolved'],'short hair');self.assertEqual(trace['rules_program'],rows);self.assertEqual(trace['rules_applied']['added_tags'],['short hair'])
  with self.assertRaisesRegex(ValueError,'required and excluded'):
   GalleryPromptEncode().encode(clip,'blue eyes',rules_state=json.dumps([box([select('long hair')]),box([select('short hair')])]))
class AttireTests(unittest.TestCase):
 def test_branch_sampling_layering_recipes_and_accessories(self):
  definition=next(row for row in json.loads((ROOT/'data/prompt-rulesets.json').read_text(encoding='utf-8'))['definitions'] if row['id']=='stock-attire-styling')
  def attire(**preferences):return dict(id='attire',definition=definition,origin='encoder',scope='main',preferences=preferences,enabled=True,collapsed=False)
  self.assertEqual(apply_rules('jeans, hairpin',[attire()])[0],'jeans, hairpin')
  self.assertEqual(apply_rules('pants, jeans',[attire()])[0],'pants, jeans')
  with self.assertRaisesRegex(ValueError,'conflict'):apply_rules('jeans, track pants',[attire()])
  with self.assertRaisesRegex(ValueError,'conflict'):apply_rules('jeans, track pants, skirt',[attire(bottoms='layered')])
  self.assertEqual(apply_rules('jeans, skirt',[attire(bottoms='layered')])[0],'jeans, skirt')
  self.assertEqual(apply_rules('jeans, track pants',[attire(bottoms='multiple')])[0],'jeans, track pants')
  self.assertEqual(apply_rules('track pants, hairpin',[attire(bottoms='skirt-jeans')])[0],'hairpin, skirt, jeans')
  self.assertEqual(apply_rules('long hair, hairpin, knife in hair, holding own hair, prehensile hair',[attire(**{'hair-interactions':'both'})])[0],'long hair, hairpin')
  class Clip:
   def tokenize(self,text):return text
   def encode_from_tokens_scheduled(self,value):return value
  for pick in (0,-1):
   with patch('random.choice',side_effect=lambda options:options[pick]):
    result=GalleryPromptEncode().encode(Clip(),'{jeans, hairpin|track pants, hair ribbon}',rules_state=json.dumps([attire()]))
   self.assertIn(result['result'][1],['jeans, hairpin','track pants, hair ribbon'])

class LibraryTests(unittest.IsolatedAsyncioTestCase):
 async def test_queue_uses_each_users_current_global_and_disabled_rules(self):
  definition=box([dict(op='exclude',tags=['gore'])])
  definition['definition']['id']='filter'
  global_box={**definition,'origin':'global'}
  handlers=[]
  server=types.SimpleNamespace(app=web.Application(),add_on_prompt_handler=handlers.append)
  with tempfile.TemporaryDirectory() as temp:
   root=Path(temp)
   for user,mode in [('a','global'),('b','disabled'),('c','on-demand')]:
    (root/user).write_text(json.dumps({'version':1,'definitions':[definition['definition']],
      'globals':[global_box],'prefixes':{},'availability':{'filter':mode}}),encoding='utf-8')
   library.install_prompt_rules(server,lambda request:root/request.user)
   async def queue(user):
    payload={'prompt':{'1':{'class_type':'GalleryPromptEncode','inputs':{'rules_state':['3',0]}},
                       '2':{'class_type':'CLIPTextEncode','inputs':{}}}}
    async def body():return payload
    async def receive(_):
     await asyncio.sleep(0)
     return handlers[0](payload)
    request=types.SimpleNamespace(user=user,method='POST',path='/api/prompt',json=body)
    submitted=await server.app.middlewares[-1](request,receive)
    self.assertEqual(submitted['prompt']['2']['inputs'],{})
    self.assertEqual(submitted['prompt']['1']['inputs']['rules_state'],['3',0])
    return submitted['prompt']['1']['inputs']['rules_policy']
   global_policy,disabled,on_demand=await asyncio.gather(queue('a'),queue('b'),queue('c'))

  class Clip:
   def tokenize(self,text):return text
   def encode_from_tokens_scheduled(self,tokens):return tokens

  def effective(policy,boxes=()):
   return GalleryPromptEncode().encode(Clip(),'portrait, gore',rules_policy=policy,rules_state=list(boxes))['result'][1]
  self.assertEqual(effective(global_policy),'portrait')
  self.assertEqual(effective(global_policy,[{**definition,'definition':{**definition['definition'],'rules':[]}}]),'portrait, gore')
  self.assertEqual(effective(disabled,[definition,global_box]),'portrait, gore')
  self.assertEqual(effective(on_demand,[global_box]),'portrait, gore')
  self.assertEqual(effective(on_demand,[definition]),'portrait')
  with self.assertRaisesRegex(ValueError,'availability'):
   library.validate_library({'version':1,'availability':{'filter':'always'}})

 async def test_cas_user_isolation_invalid_script_and_origin(self):
  with tempfile.TemporaryDirectory() as temp:
   routes=web.RouteTableDef();library.register_rules_routes(routes,lambda request:Path(temp)/request.headers.get('X-User','default')/'rules.json')
   app=web.Application();app.add_routes(routes)
   async with TestClient(TestServer(app)) as client:
    response=await client.get('/Gallery/rulesets');initial=await response.json();self.assertEqual(response.status,200)
    initial['library']['globals']=[box([select('short hair')],'global')]
    response=await client.post('/Gallery/rulesets',json=initial);self.assertEqual(response.status,200);saved=await response.json()
    response=await client.post('/Gallery/rulesets',json=initial);self.assertEqual(response.status,409)
    response=await client.get('/Gallery/rulesets',headers={'X-User':'other'});self.assertEqual((await response.json())['library']['globals'],[])
    response=await client.post('/Gallery/rulesets',json=saved,headers={'Origin':'https://evil.example'});self.assertEqual(response.status,403)
    saved['library']['globals'][0]['definition']['rules']=[{'op':'eval','tags':['anything']}]
    response=await client.post('/Gallery/rulesets',json=saved);self.assertEqual(response.status,400)
    self.assertEqual(len(list(Path(temp).rglob('*rules.json'))),1)
if __name__=='__main__':unittest.main()
