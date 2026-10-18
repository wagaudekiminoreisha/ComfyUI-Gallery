import json
from pathlib import Path
import sys
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from prefix_library import apply_source_exclusions,GalleryPromptEncode,RESOLVED_KEY

class SourceImageExclusionsTests(unittest.TestCase):
 def payload(self):
  return {'segments':[{'key':'a.png:positive','text':'blue eyes, blonde hair','excluded':['blue eyes']},{'key':'b.png:positive','text':'blue eyes, long hair','excluded':[]}]}
 def test_batch_retains_same_tag_from_another_image(self):
  result=apply_source_exclusions('blue eyes, blonde hair, blue eyes, long hair',self.payload())
  self.assertEqual(result,'blonde hair, blue eyes, long hair')
 def test_source_switch_does_not_reuse_previous_image(self):
  payload=self.payload();payload['segments']=payload['segments'][1:]
  self.assertEqual(apply_source_exclusions('blue eyes, long hair',payload),'blue eyes, long hair')
 def test_stale_or_malformed_payload_never_filters_another_source(self):
  with self.assertRaisesRegex(ValueError,'Source image prompts changed'):
   apply_source_exclusions('a changed source',self.payload())
  with self.assertRaisesRegex(ValueError,'Invalid per-image'):
   apply_source_exclusions('source',{'segments':[None]})
 def test_encoder_records_correct_prompt_and_per_image_exclusions(self):
  class Clip:
   def tokenize(self,text):return text
   def encode_from_tokens_scheduled(self,text):return text
  metadata={}
  result=GalleryPromptEncode().encode(Clip(),'⟦source⟧',source_text='blue eyes, blonde hair, blue eyes, long hair',source_mode='boxes',source_image_exclusions=json.dumps(self.payload()),extra_pnginfo=metadata,unique_id='1')
  self.assertEqual(result['result'][1],'blonde hair, blue eyes, long hair')
  self.assertEqual(metadata[RESOLVED_KEY]['1']['source_excluded_by_image'],self.payload())
if __name__=='__main__':unittest.main()
