import copy
import json
from pathlib import Path
import sys
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from prompt_rules import apply_rules, active_boxes, validate_definition
from source_prompt_policy import filter_source_categories
DEFINITIONS=json.loads((Path(__file__).resolve().parents[1]/'data/prompt-rulesets.json').read_text(encoding='utf-8'))['definitions']
def box(id,origin,preferences=None,scope='main'):
    return dict(id=origin+id,definition=next(row for row in DEFINITIONS if row['id']==id),origin=origin,preferences=preferences or {},scope=scope,enabled=True,collapsed=False)

class GarmentPolicyTests(unittest.TestCase):
    def test_lower_override_preserves_upper_and_old_layering_constraints(self):
        broad=box('stock-attire-styling','global',{'base':'blouse','outer':'cardigan','headwear':'beret'})
        lower=box('stock-attire-lower','encoder',{'bottoms':'layered'})
        text=apply_rules('jeans, skirt',[broad,lower])[0]
        for tag in ['blouse','cardigan','beret']:self.assertIn(tag,text)
        self.assertIn(broad,active_boxes([broad,lower]))
        with self.assertRaisesRegex(ValueError,'conflict'):apply_rules('jeans, track pants, skirt',[broad,lower])
        for change in ({'enabled':False},{'scope':'independent'},{'origin':'global'}):
            with self.assertRaisesRegex(ValueError,'conflict'):apply_rules('jeans, skirt',[broad,{**lower,**change}])

    def test_upper_override_keeps_lower_recipe(self):
        broad=box('stock-attire-styling','global',{'base':'blouse','outer':'coat','bottoms':'skirt-track'})
        upper=box('stock-attire-upper','encoder',{'base':'shirt','outer':'cardigan'})
        text=apply_rules('jeans, hat',[broad,upper])[0]
        for tag in ['shirt','cardigan','skirt','track_pants']:self.assertIn(tag,text)
        for tag in ['blouse','coat','jeans']:self.assertNotIn(tag,text)

    def test_new_rulesets_reuse_existing_choices_and_do_not_become_global(self):
        broad=next(row for row in DEFINITIONS if row['id']=='stock-attire-styling')
        for id,keys in [('stock-attire-upper',['base','outer']),('stock-attire-lower',['bottoms'])]:
            definition=next(row for row in DEFINITIONS if row['id']==id)
            self.assertEqual(definition['choices'],[choice for choice in broad['choices'] if choice['id'] in keys])
            validate_definition(definition)
        malformed=copy.deepcopy(broad);malformed['choices'][0]['channel']=123
        with self.assertRaises(ValueError):validate_definition(malformed)

    def test_fine_transfer_sets_match_frontend_contract(self):
        text='sitting, running, arms up, blue eyes, closed eyes, looking at viewer, freckles, wet, forest, rain, night, monochrome, lineart, sword, cat, unknown'
        self.assertEqual(filter_source_categories(text,['pose-motion','skin-body-surface','background-weather','art-palette'])[0],'sitting, arms up, blue eyes, closed eyes, looking at viewer, freckles, forest, night, lineart, sword, cat, unknown')
        self.assertEqual(filter_source_categories('sword, cat, tree, hug',['props-interaction-objects'])[0],'cat, tree, hug')
