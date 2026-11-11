import csv,gzip,importlib,json,sys,tempfile,types,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
from prompt_rules import validate_definition,apply_rules
from prefix_library import GalleryPromptEncode
package=types.ModuleType('stock_rules_test');package.__path__=[str(ROOT)];sys.modules[package.__name__]=package
library=importlib.import_module('stock_rules_test.rules_library')
class StockTests(unittest.TestCase):
 def test_curated_definitions_only_use_general_vocabulary_and_each_option_executes(self):
  with gzip.open(ROOT/'data/danbooru.csv.gz','rt',encoding='utf-8') as stream:
   general_rows=[row for row in csv.reader(stream) if len(row)>1 and row[1]=='0']
  general={row[0] for row in general_rows}
  aliases={alias for row in general_rows if len(row)>3 for alias in row[3].split(',') if alias}
  definitions=json.loads((ROOT/'data/prompt-rulesets.json').read_text(encoding='utf-8'))['definitions']
  stock=[row for row in definitions if row['id'].startswith('stock-')]
  for definition in stock:
   validate_definition(definition)
   allowed=general | aliases if definition['id'] in ('stock-injury-gore-filter','stock-disturbing-content-filter','stock-fetish-content-filter') else general
   for choice in definition['choices']:
    expected_default='single' if (definition['id'],choice['id'])==('stock-attire-styling','bottoms') else 'keep'
    self.assertEqual(choice['default'],expected_default)
    for option in choice['options']:
     for rule in option['rules']:self.assertTrue(set(rule['tags'])<=allowed,(definition['name'],rule))
     box=dict(id='qa',definition=definition,origin='encoder',scope='main',preferences={choice['id']:option['id']},enabled=True,collapsed=False)
     apply_rules('blue eyes, skirt',[box])
  layering=next(row for row in stock if row['id']=='stock-clothing-layers')
  box=dict(id='qa',definition=layering,origin='encoder',scope='main',preferences={'layering':'skirt-pants'},enabled=True,collapsed=False)
  self.assertEqual(set(apply_rules('',[box])[0].split(', ')),{'skirt','pants'})
 def test_injury_filter_is_opt_in_and_applies_to_connected_source_tags(self):
  definitions=json.loads((ROOT/'data/prompt-rulesets.json').read_text(encoding='utf-8'))['definitions']
  definition=next(row for row in definitions if row['id']=='stock-injury-gore-filter')
  box=dict(id='qa',definition=definition,origin='encoder',scope='main',preferences={},enabled=True,collapsed=False)
  text='red scarf, amputee, (gore:1.2), bloody face, scar, prosthetic leg'
  self.assertEqual(apply_rules(text,[box])[0],text)
  box['preferences']={'gore':'omit'}
  self.assertEqual(apply_rules(text,[box])[0],'red scarf, amputee, bloody face, scar, prosthetic leg')

  class Clip:
   def tokenize(self,text):return text
   def encode_from_tokens_scheduled(self,tokens):return tokens

  box['preferences']={'gore':'omit','amputation':'omit','injury-blood':'omit'}
  result=GalleryPromptEncode().encode(Clip(),'standing',source_text=text,rules_state=json.dumps([box]))
  self.assertEqual(result['result'][1],'standing, red scarf, scar, prosthetic leg')
 def test_disturbing_content_categories_are_independent(self):
  definitions=json.loads((ROOT/'data/prompt-rulesets.json').read_text(encoding='utf-8'))['definitions']
  definition=next(row for row in definitions if row['id']=='stock-disturbing-content-filter')
  text='skeleton costume, corpse pile, self harm, torture, watersports, puking, maggots, scar'
  preferences={choice['id']:'omit' for choice in definition['choices']}
  box=dict(id='qa',definition=definition,origin='encoder',scope='main',preferences=preferences,enabled=True,collapsed=False)
  self.assertEqual(apply_rules(text,[box])[0],'skeleton costume, scar')
  box['preferences']={'infestation-decay':'omit'}
  self.assertEqual(apply_rules(text,[box])[0],text.replace('maggots, ',''))
 def test_new_stock_is_offered_without_overwriting_custom_definitions_or_pinned_boxes(self):
  with tempfile.TemporaryDirectory() as temp:
   path=Path(temp)/'rules.json';value={'version':1,'definitions':[{'version':1,'id':'stock-eyes','name':'My edited Eyes','family':'my-eyes','rules':[],'choices':[]}],'globals':[],'prefixes':{}}
   path.write_text(json.dumps(value));before=path.read_bytes();loaded,_=library.read_library(path)
   self.assertEqual(next(row for row in loaded['definitions'] if row['id']=='stock-eyes')['name'],'My edited Eyes');self.assertEqual(loaded['globals'],[]);self.assertEqual(path.read_bytes(),before)
   self.assertIn('stock-clothing-layers',[row['id'] for row in loaded['definitions']])
   self.assertIn('stock-injury-gore-filter',[row['id'] for row in loaded['definitions']])
   self.assertIn('stock-fetish-content-filter',[row['id'] for row in loaded['definitions']])
 def test_fetish_filter_categories_and_exceptions_apply_to_source_tags(self):
  definitions=json.loads((ROOT/'data/prompt-rulesets.json').read_text(encoding='utf-8'))['definitions']
  definition=next(row for row in definitions if row['id']=='stock-fetish-content-filter')
  box=dict(id='qa',definition=definition,origin='encoder',scope='main',preferences={},enabled=True,collapsed=False)
  text='bdsm, rope bondage, handcuffs, foot worship, latex gloves, barefoot, electricity, petboy, unbirth'
  self.assertEqual(apply_rules(text,[box])[0],text)
  box['preferences']={'bdsm':'omit'}
  self.assertEqual(apply_rules(text,[box])[0],text.replace('bdsm, rope bondage, ',''))
  box['preferences']={choice['id']:'omit' for choice in definition['choices']}
  class Clip:
   def tokenize(self,text):return text
   def encode_from_tokens_scheduled(self,value):return value
  result=GalleryPromptEncode().encode(Clip(),'portrait',source_text=text,rules_state=json.dumps([box]))
  self.assertEqual(result['result'][1],'portrait, latex gloves, barefoot, electricity')
  restraints=next(choice for choice in definition['choices'] if choice['id']=='restraints')
  restraints['options'][1]['rules'][0]['except_tags']=['handcuffs']
  self.assertIn('handcuffs',apply_rules(text,[box])[0])
