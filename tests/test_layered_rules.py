import copy
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from prefix_snapshots import capture_snapshot,validate_snapshots
from prompt_rules import apply_rules,validate_boxes
from hair_policy import sample_policy,filter_hair_prompt
from hydrus import HydrusBridge,HydrusError
from test_hydrus_sync import Remote

def box(rules,origin='encoder'):
 return dict(id='box',definition=dict(version=1,id='rules',name='Test',family='hair',rules=rules,choices=[]),origin=origin,scope='main',preferences={},enabled=True,collapsed=False)

class SnapshotTests(unittest.TestCase):
 def setUp(self):
  self.library={'version':2,'tags':[{'id':'a','name':'a','text':'blonde hair'},{'id':'b','name':'b','text':'short hair'}],'prefixes':[{'id':'p','name':'Character','tags':['a','b']}]}
 def test_parent_consolidation_and_content_addressed_membership(self):
  original=copy.deepcopy(self.library)
  self.assertIsNone(capture_snapshot(self.library,{'prefix_id':'p','terms':['short_hair','blonde hair'],'image_keys':['sha256:a']}))
  self.assertEqual(self.library['prefixes'],original['prefixes'])
  self.assertEqual(self.library['associations']['sha256:a']['prefix_id'],'p')
  data={'prefix_id':'p','terms':['long hair','blonde hair'],'image_keys':['sha256:a'],'image_refs':{'sha256:a':{'name':'First'}}}
  first=capture_snapshot(self.library,data)
  second=capture_snapshot(self.library,{**data,'terms':['BLONDE_HAIR','long hair'],'image_keys':['sha256:b']})
  self.assertEqual(first,second)
  self.assertEqual(set(self.library['snapshots'][first]['members']),{'sha256:a','sha256:b'})
  self.assertEqual(self.library['prefixes'],original['prefixes'])
  self.assertEqual(self.library['tags'],original['tags'])
  validate_snapshots(self.library['snapshots'])
 def test_empty_image_source_prompt_sides_are_not_snapshot_tags(self):
  self.assertIsNone(capture_snapshot(self.library,{'prefix_id':'p','terms':['short hair','blonde hair',' '],'negative_terms':['']}))
  identifier=capture_snapshot(self.library,{'prefix_id':'p','terms':['','  '],'negative_terms':['']})
  snapshot=self.library['snapshots'][identifier]
  self.assertEqual(snapshot['terms'],[])
  self.assertEqual(snapshot['negative_terms'],[])
  validate_snapshots(self.library['snapshots'])
 def test_optional_branches_survive_empty_outer_term_cleanup(self):
  identifier=capture_snapshot(self.library,{'prefix_id':'p','terms':[' {blonde hair|} ',''],'negative_terms':[' ']})
  self.assertEqual(self.library['snapshots'][identifier]['terms'],['{blonde hair|}'])
  with self.assertRaisesRegex(ValueError,'Invalid snapshot tags'):
   capture_snapshot(self.library,{'prefix_id':'p','terms':[None]})
 def test_rules_and_negative_and_hair_distinguish_immutable_variants(self):
  data={'prefix_id':'p','terms':['long hair']}
  first=capture_snapshot(self.library,data)
  before=copy.deepcopy(self.library['snapshots'][first])
  ids=[capture_snapshot(self.library,{**data,'negative_terms':['blurry']}),capture_snapshot(self.library,{**data,'rules':[box([{'op':'exclude','tags':['bangs']}])]}),capture_snapshot(self.library,{**data,'hair_policy':{'mode':'natural'}})]
  self.assertEqual(len(set(ids+[first])),4)
  self.assertEqual(before,self.library['snapshots'][first])
 def test_tree_conditions_original_input_and_snapshot_precedence(self):
  condition={'op':'all','children':[{'op':'any','children':[{'op':'tag','tag':'solo'},{'op':'tag','tag':'1girl'}]},{'op':'not','children':[{'op':'tag','tag':'hat'}]}]}
  rules=[box([{'op':'exclude','tags':['long hair'],'condition':condition}])]
  self.assertEqual(apply_rules('solo, long hair',rules)[0],'solo')
  self.assertEqual(apply_rules('solo, hat, long hair',rules)[0],'solo, hat, long hair')
  validate_boxes(rules)
  rules[0]['definition']['rules'][0]['condition']={'op':'execute','code':'x'}
  with self.assertRaises(ValueError):validate_boxes(rules)
  picks=lambda value:{'op':'select','tags':['short hair','long hair'],'value':value}
  self.assertEqual(apply_rules('long hair',[box([picks('long hair')],'prefix'),box([picks('short hair')],'snapshot')])[0],'short hair')
 def test_either_hair_attributes_sample_once_and_keep_other_tags(self):
  policy={'mode':'minimal','attributes':['length','arrangement'],'attributeMode':'one'}
  with patch('random.choice',return_value='length'):
   sampled=sample_policy(policy)
  self.assertEqual(sampled['attributes'],['length'])
  self.assertEqual(policy['attributes'],['length','arrangement'])
  self.assertEqual(filter_hair_prompt('long hair, twintails, blue eyes',sampled),'long hair, blue eyes')

class PagingTests(unittest.IsolatedAsyncioTestCase):
 async def asyncSetUp(self):
  self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
  self.remote=Remote();self.bridge=HydrusBridge(lambda:self.temp.name,self.temp.name,self.remote)
  self.bridge.settings.save({'access_key':'ab'*32})
  self.remote.records={f'{i:064x}':{'hash':f'{i:064x}','file_id':i,'is_local':True,'mime':'image/png','notes':{}} for i in range(1,452)}
 async def test_demand_paging_freezes_ids_and_fetches_only_requested_metadata(self):
  data={'tags':['hair'],'limit':200}
  first=await self.bridge.browse('search',data)
  self.assertEqual((first['total'],len(first['items']),first['next_offset']),(451,200,200))
  self.remote.records['f'*64]={'hash':'f'*64,'file_id':999,'is_local':True,'mime':'image/png'}
  second=await self.bridge.browse('search',{**data,'offset':200,'search_id':first['search_id']})
  third=await self.bridge.browse('search',{**data,'offset':400,'search_id':first['search_id']})
  self.assertEqual((len(second['items']),len(third['items']),third['next_offset']),(200,51,None))
  self.assertEqual(len({r['file_id'] for page in (first,second,third) for r in page['items']}),451)
  self.assertEqual(sum(endpoint.endswith('search_files') for endpoint,_ in self.remote.calls),1)
  with self.assertRaises(HydrusError):await self.bridge.browse('search',{**data,'tags':['different'],'offset':200,'search_id':first['search_id']})
  self.bridge._gallery_search_pages[first['search_id']]['expires']=0
  with self.assertRaisesRegex(HydrusError,'expired'):await self.bridge.browse('search',{**data,'offset':200,'search_id':first['search_id']})
