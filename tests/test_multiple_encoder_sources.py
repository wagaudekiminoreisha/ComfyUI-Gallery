import json
import math
from pathlib import Path
import sys
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from prefix_library import GalleryPromptEncode, compose_prompt, RESOLVED_KEY

class Clip:
 def tokenize(self,text):return text
 def encode_from_tokens_scheduled(self,text):return text

class MultipleEncoderSourcesTests(unittest.TestCase):
 def encode(self,text='⟦source⟧, ⟦source:source_text_2⟧',**kwargs):
  return GalleryPromptEncode().encode(Clip(),text,source_mode='boxes',**kwargs)
 def test_separate_sources_and_marker_positions(self):
  result=self.encode('⟦source:source_text_2⟧, style, ⟦source⟧',source_text='standing',source_text_2='blonde hair')
  self.assertEqual(result['result'][1],'blonde hair, style, standing')
  self.assertEqual(result['ui']['source_texts'][0],{'source_text':'standing','source_text_2':'blonde hair'})
 def test_identical_image_keys_keep_edits_on_their_own_socket(self):
  segment={'key':'same.png:positive','text':'blue eyes, blonde hair','excluded':['blue eyes']}
  edits={'sources':{'source_text':{'segments':[segment]},'source_text_2':{'segments':[{**segment,'excluded':[],'replacements':{'blonde hair':'red hair'}}]}}}
  result=self.encode(source_text=segment['text'],source_text_2=segment['text'],source_image_exclusions=json.dumps(edits))
  self.assertEqual([part.strip() for part in result['result'][1].split(',')],['blonde hair','blue eyes','red hair'])
 def test_primary_legacy_payload_and_empty_extra_input(self):
  self.assertEqual(self.encode(source_text='a, b',source_image_exclusions={'replacements':{'a':'c'}})['result'][1],'c, b')
  self.assertEqual(self.encode(source_text_2='only second')['result'][1],'only second')
  self.assertEqual(self.encode(source_text='primary')['result'][1],'primary')
 def test_stale_secondary_segments_fail_instead_of_editing_other_sources(self):
  edits={'sources':{'source_text_2':{'segments':[{'key':'b','text':'old','excluded':['old']}]}}}
  with self.assertRaisesRegex(ValueError,'prompts changed'):
   self.encode(source_text='safe',source_text_2='new',source_image_exclusions=edits)
 def test_additional_dynamic_groups_disable_cache(self):
  self.assertTrue(math.isnan(GalleryPromptEncode.IS_CHANGED(source_text_2='{a|b}')))
  self.assertEqual(GalleryPromptEncode.IS_CHANGED(source_text_2='literal'),'')
 def test_legacy_order_modes_join_connected_sources(self):
  node=GalleryPromptEncode()
  self.assertEqual(node.encode(Clip(),'style',source_text='pose',source_text_2='look',source_mode='before')['result'][1],'pose, look, style')
  self.assertEqual(node.encode(Clip(),'style',source_text_2='',source_mode='replace')['result'][1],'')
  self.assertEqual(node.encode(Clip(),'style',source_mode='replace')['result'][1],'style')
 def test_named_sources_are_measured_separately_in_group_provenance(self):
  metadata={'workflow':{'nodes':[{'id':2,'properties':{'prompt_boxes':{'boxes':[{'kind':'source','name':'Pose'},{'kind':'source','input':'source_text_2','name':'Appearance'}]}}}]}}
  self.encode(source_text='standing',source_text_2='blonde hair',extra_pnginfo=metadata,unique_id='2')
  self.assertEqual([group['name'] for group in metadata[RESOLVED_KEY]['2']['diagnostic_context']['groups']],['Pose tags','Appearance tags'])
 def test_named_markers_never_fall_back_to_primary_source(self):
  self.assertEqual(compose_prompt('⟦source:source_text_2⟧','primary','boxes'),'')
 def test_all_eight_inputs_have_independent_marker_positions(self):
  names=['source_text']+['source_text_'+str(i) for i in range(2,9)]
  text=', '.join('⟦source⟧' if name=='source_text' else '⟦source:'+name+'⟧' for name in reversed(names))
  values={name:'tag'+str(index) for index,name in enumerate(names)}
  self.assertEqual(self.encode(text,**values)['result'][1],', '.join(reversed(list(values.values()))))

if __name__=='__main__':unittest.main()
