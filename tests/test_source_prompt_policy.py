import json
from pathlib import Path
import sys
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from source_prompt_policy import filter_source_categories, merge_prompt_texts, prompt_source_images, CATALOG
from image_source import parse_manifest, source_prompts
from prefix_library import GalleryPromptEncode, RESOLVED_KEY

class Clip:
 def tokenize(self,text):return text
 def encode_from_tokens_scheduled(self,text):return text

class SourcePromptPolicyTests(unittest.TestCase):
 def test_presets_separate_pose_and_appearance_and_keep_unknowns(self):
  text='long hair, blue eyes, black dress, standing, arms up, from behind, unknown tag'
  pose,trace=filter_source_categories(text,CATALOG['presets']['pose'])
  self.assertEqual(pose,'standing, arms up, from behind, unknown tag')
  self.assertEqual(len(trace),3)
  appearance,_=filter_source_categories(text,CATALOG['presets']['appearance'])
  self.assertEqual(appearance,'long hair, blue eyes, black dress, unknown tag')
  self.assertEqual(filter_source_categories(text,[])[0],text)
 def test_weighted_nested_groups_keep_empty_branch_multiplicity(self):
  filtered,_=filter_source_categories('({blue eyes|standing|green eyes}:1.2), [long hair], smile',['hair','eyes'])
  self.assertEqual(filtered,'({|standing|}:1.2), smile')
  self.assertEqual(filter_source_categories('{long hair|blue eyes}', ['hair','eyes'])[0],'')
 def test_consensus_counts_each_image_once_and_keeps_unknown_metadata_in_denominator(self):
  texts=['blue eyes, blue_eyes, standing','blue eyes, sitting','']
  self.assertEqual(merge_prompt_texts(texts,'union'),'blue eyes, standing, sitting')
  self.assertEqual(merge_prompt_texts(texts,'common'),'')
  self.assertEqual(merge_prompt_texts(texts,'frequency',60),'blue eyes')
  self.assertEqual(merge_prompt_texts(texts,'frequency',70),'')
  self.assertEqual(merge_prompt_texts(['{a|b}, x','{a|b}, y'],'common'),'{a|b}')
 def manifest(self):
  return {'version':1,'layout':'single','active_index':0,'batch_indices':[1,2],
   'images':[{'input_name':'a.png','prompt':{'positive':'standing, blue eyes'}},{'input_name':'b.png','prompt':{'positive':'sitting, blue eyes'}},{'input_name':'c.png','prompt':{'positive':'kneeling, blue eyes'}}]}
 def test_prompt_selection_is_independent_from_layout_and_batch_pixels(self):
  value=self.manifest()
  self.assertEqual(source_prompts(parse_manifest(value))[0],'standing, blue eyes')
  value.update(prompt_selection='batch',prompt_merge='common')
  parsed=parse_manifest(value)
  self.assertEqual([image['input_name'] for image in prompt_source_images(parsed)],['b.png','c.png'])
  self.assertEqual(source_prompts(parsed)[0],'blue eyes')
  self.assertEqual(parsed['layout'],'single');self.assertEqual(parsed['batch_indices'],[1,2])
  value['prompt_selection']='active'
  self.assertEqual(source_prompts(parse_manifest(value))[0],'standing, blue eyes')
  value['images'][0]['prompt']['negative']=None
  self.assertEqual(source_prompts(parse_manifest(value))[1],'')
 def test_encoder_filters_each_source_separately_and_records_trace(self):
  metadata={}
  edits={'sources':{'source_text':{'category_exclusions':CATALOG['presets']['appearance']},'source_text_2':{'category_exclusions':CATALOG['presets']['pose']}}}
  result=GalleryPromptEncode().encode(Clip(),'manual tag, ⟦source⟧, ⟦source:source_text_2⟧',source_mode='boxes',source_text='long hair, sitting',source_text_2='blue eyes, standing',source_image_exclusions=edits,extra_pnginfo=metadata,unique_id='2')
  self.assertEqual(result['result'][1],'manual tag, long hair, standing')
  self.assertEqual(metadata[RESOLVED_KEY]['2']['source_filters']['source_text']['removed_tags'][0]['tag'],'sitting')
 def test_per_image_edits_are_applied_before_consensus_with_stale_check(self):
  segments=[{'key':'a','text':'blue eyes, standing','excluded':['blue eyes']},{'key':'b','text':'blue eyes, sitting','excluded':[]}]
  edits={'segments':segments,'merge':{'mode':'common','min_percent':60}}
  result=GalleryPromptEncode().encode(Clip(),'⟦source⟧',source_mode='boxes',source_text='blue eyes',source_image_exclusions=edits)
  self.assertEqual(result['result'][1],'')
  with self.assertRaisesRegex(ValueError,'prompts changed'):
   GalleryPromptEncode().encode(Clip(),'⟦source⟧',source_mode='boxes',source_text='a changed aggregate',source_image_exclusions=edits)
 def test_invalid_selection_merge_categories_and_thresholds_are_rejected(self):
  for patch in [{'prompt_selection':'wrong'},{'prompt_merge':'average'},{'prompt_min_percent':0},{'prompt_min_percent':True}]:
   with self.assertRaises(ValueError):parse_manifest({**self.manifest(),**patch})
  with self.assertRaises(ValueError):filter_source_categories('blue eyes',['wrong'])
  with self.assertRaises(ValueError):merge_prompt_texts(['a'],'frequency',101)

if __name__=='__main__':unittest.main()
