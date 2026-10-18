import csv,gzip,importlib,json,sys,tempfile,types,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
from prompt_rules import validate_definition,apply_rules
package=types.ModuleType('stock_rules_test');package.__path__=[str(ROOT)];sys.modules[package.__name__]=package
library=importlib.import_module('stock_rules_test.rules_library')
class StockTests(unittest.TestCase):
 def test_curated_definitions_only_use_general_vocabulary_and_each_option_executes(self):
  with gzip.open(ROOT/'data/danbooru.csv.gz','rt',encoding='utf-8') as stream:general={row[0] for row in csv.reader(stream) if len(row)>1 and row[1]=='0'}
  definitions=json.loads((ROOT/'data/prompt-rulesets.json').read_text(encoding='utf-8'))['definitions']
  stock=[row for row in definitions if row['id'].startswith('stock-')];self.assertEqual(len(stock),16)
  for definition in stock:
   validate_definition(definition)
   for choice in definition['choices']:
    self.assertEqual(choice['default'],'keep')
    for option in choice['options']:
     for rule in option['rules']:self.assertTrue(set(rule['tags'])<=general,(definition['name'],rule))
     box=dict(id='qa',definition=definition,origin='encoder',scope='main',preferences={choice['id']:option['id']},enabled=True,collapsed=False)
     apply_rules('blue eyes, skirt, pants',[box])
  layering=next(row for row in stock if row['id']=='stock-clothing-layers')
  box=dict(id='qa',definition=layering,origin='encoder',scope='main',preferences={'layering':'skirt-pants'},enabled=True,collapsed=False)
  self.assertEqual(set(apply_rules('',[box])[0].split(', ')),{'skirt','pants'})
 def test_new_stock_is_offered_without_overwriting_custom_definitions_or_pinned_boxes(self):
  with tempfile.TemporaryDirectory() as temp:
   path=Path(temp)/'rules.json';value={'version':1,'definitions':[{'version':1,'id':'stock-eyes','name':'My edited Eyes','family':'my-eyes','rules':[],'choices':[]}],'globals':[],'prefixes':{}}
   path.write_text(json.dumps(value));before=path.read_bytes();loaded,_=library.read_library(path)
   self.assertEqual(next(row for row in loaded['definitions'] if row['id']=='stock-eyes')['name'],'My edited Eyes');self.assertEqual(loaded['globals'],[]);self.assertEqual(path.read_bytes(),before)
   self.assertIn('stock-clothing-layers',[row['id'] for row in loaded['definitions']])
