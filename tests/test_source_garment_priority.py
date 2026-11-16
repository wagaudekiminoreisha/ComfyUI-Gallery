import json
from pathlib import Path
import sys
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from source_garment_priority import prioritize_source_garments
from prefix_library import GalleryPromptEncode

class Clip:
    def tokenize(self,text):return text
    def encode_from_tokens_scheduled(self,text):return text

class SourcePriorityTests(unittest.TestCase):
    def run_policy(self,manual,source='t-shirt, blue_shirt',rules=None):
        return prioritize_source_garments([{'text':manual},{'text':source,'source':True}],rules)
    def test_optional_outfit_preserves_outer_layers_underwear_and_modifiers(self):
        rows,errors=self.run_policy('{blouse|red_shirt|bra|necklace|torn_clothes|jacket|}')
        self.assertEqual(rows[0]['text'],'{bra|necklace|torn_clothes|jacket|}');self.assertEqual(rows[1]['text'],'t-shirt, blue_shirt');self.assertEqual(errors,[])
        self.assertEqual(self.run_policy('({blouse|jacket|}:1.2)')[0][0]['text'],'({jacket|}:1.2)')
    def test_required_source_match_and_nested_viability(self):
        self.assertEqual(self.run_policy('{blouse|t-shirt|skirt}')[0][0]['text'],'')
        self.assertEqual(self.run_policy('{t-shirt, torn_clothes|blouse, necklace|skirt}')[0][0]['text'],'torn_clothes')
        self.assertTrue(self.run_policy('{blouse|sweater}')[1])
        rows,errors=self.run_policy('{{blouse|sweater}|necklace|}')
        self.assertEqual(rows[0]['text'],'{necklace|}');self.assertEqual(errors,[])
    def test_encoder_enforces_before_sampling_and_reports_impossible_groups(self):
        for _ in range(15):
            result=GalleryPromptEncode().encode(Clip(),'{blouse|t-shirt, torn_clothes|skirt}',source_text='t-shirt, blue_shirt')['result'][1]
            self.assertIn('t-shirt',result);self.assertIn('blue_shirt',result);self.assertIn('torn_clothes',result)
            self.assertNotIn('blouse',result);self.assertNotIn('skirt',result)
        with self.assertRaisesRegex(ValueError,'No compatible alternative'):
            GalleryPromptEncode().encode(Clip(),'{blouse|sweater}',source_text='t-shirt')
    def test_lower_layering_preserves_existing_policy(self):
        definition=next(row for row in json.loads((Path(__file__).resolve().parents[1]/'data/prompt-rulesets.json').read_text(encoding='utf-8'))['definitions'] if row['id']=='stock-attire-lower')
        box=dict(id='lower',definition=definition,origin='encoder',scope='main',enabled=True,collapsed=False,preferences={'bottoms':'layered'})
        self.assertEqual(self.run_policy('{skirt|track_pants|necklace|}','jeans',[box])[0][0]['text'],'{skirt|necklace|}')
