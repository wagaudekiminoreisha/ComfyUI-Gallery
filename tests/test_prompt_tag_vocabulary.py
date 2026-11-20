import json,sys,unittest,tempfile
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from prompt_tag_vocabulary import build_vocabulary,recognized_tags
from hydrus_sync import matches,NOTE
from hydrus import HydrusBridge

class PromptVocabularyTests(unittest.TestCase):
 def test_dictionary_aliases_and_saved_custom_definitions(self):
  vocabulary=build_vocabulary({'tags':[{'text':'my_trigger'},{'text':'{custom_pose|other_pose}'},{'text':'Not a filter tag.','kind':'prose'}],'hybrid':{'components':{'p':{'type':'prose','text':'this character should have her hand over her forehead'},'g':{'type':'group','children':[{'type':'tags','text':'another_trigger'}]}}}})
  self.assertEqual(vocabulary['blond hair'],vocabulary['blonde hair']);self.assertIn('my trigger',vocabulary);self.assertIn('custom pose',vocabulary);self.assertIn('another trigger',vocabulary);self.assertNotIn('this character should have her hand over her forehead',vocabulary);self.assertNotIn('not a filter tag.',vocabulary)
 def test_only_whole_resolved_tags_are_recognized(self):
  vocabulary=build_vocabulary({'tags':[{'text':'my_trigger'}]})
  self.assertEqual(recognized_tags('(blond_hair:1.2), my_trigger, this character should have her hand over her forehead, {blue hair|red hair}',vocabulary),[vocabulary['blond hair'],'my trigger'])
  self.assertEqual(recognized_tags('The character has blue hair and stands at night',vocabulary),[])
 def test_hydrus_prompt_filters_reject_prose_but_retain_other_fields(self):
  record={'hash':'a'*64,'notes':{NOTE:json.dumps({'positive':'blond_hair, this character should have her hand over her forehead','negative':'my_trigger','fileinfo':{'filename':'forehead.png'}})},'tags':{'service':{'display_tags':{'0':['custom:tag']}}}}
  vocabulary=build_vocabulary({'tags':[{'text':'my_trigger'}]})
  self.assertTrue(matches(record,'positive',['blonde hair'],vocabulary));self.assertTrue(matches(record,'negative',['my trigger'],vocabulary));self.assertFalse(matches(record,'positive',['this character should have her hand over her forehead'],vocabulary));self.assertTrue(matches(record,'hydrus',['custom:tag'],vocabulary));self.assertTrue(matches(record,'name',['forehead'],vocabulary))
 def test_cached_hydrus_index_alias_prefilter_and_custom_tags(self):
  with tempfile.TemporaryDirectory() as directory:
   bridge=HydrusBridge(lambda:directory,directory);settings={'url':'http://qa','profile':'qa','access_key':'qa'}
   record={'hash':'a'*64,'file_id':1,'notes':{NOTE:json.dumps({'positive':'(blond_hair:1.2), my_trigger, this character should have her hand over her forehead'})}}
   bridge.sync.put_records(settings,[record]);vocabulary=build_vocabulary({'tags':[{'text':'my_trigger'}]})
   self.assertEqual(len(bridge.sync.search(settings,'positive',['blonde hair'],vocabulary)),1);self.assertEqual(len(bridge.sync.search(settings,'positive',['my trigger'],vocabulary)),1);self.assertEqual(bridge.sync.search(settings,'positive',['this character should have her hand over her forehead'],vocabulary),[])

if __name__=='__main__':unittest.main()
