import copy,json,tempfile,unittest,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from hybrid_prompt import compile_hybrid,validate_document,validate_extension,library_subset,GalleryHybridPrompt
from prefix_library import read,update,validate,GalleryPromptEncode
from local_library import prompts

def tags(id,text,**kw):return dict(id=id,type='tags',text=text,**kw)
def prose(id,text,**kw):return dict(id=id,type='prose',text=text,**kw)
def doc(*rows,**kw):return dict(version=1,components=list(rows),**kw)
def rulebox(op,tags,**kw):return {'id':'policy','origin':'encoder','scope':'main','preferences':{},'enabled':True,'definition':{'version':1,'id':'policy','name':'Test policy','family':'test','rules':[dict(op=op,tags=tags,**kw)],'choices':[]}}
LIB={'version':2,'tags':[{'id':'a','name':'a','text':'night'},{'id':'b','name':'b','text':'@Scene'}],'prefixes':[{'id':'p','name':'Scene','tags':['a'],'negative_terms':['watermark']},{'id':'nested','name':'Nested','tags':['b']}]}

class HybridCompilerTests(unittest.TestCase):
 def test_empty_and_existing_library_are_not_mutated(self):
  before=copy.deepcopy(LIB);self.assertEqual(compile_hybrid(doc(),LIB)['positive'],'');self.assertEqual(LIB,before)
 def test_prose_keeps_commas_braces_comments_and_paragraphs(self):
  text='She sits, beside the window.\n\nLiteral {red|blue}, https://example.test and /* words */.'
  result=compile_hybrid(doc(tags('t','1girl, red hair, red_hair'),prose('p',text)))
  self.assertEqual(result['positive'],'1girl, red hair\n\n'+text)
 def test_prefix_suffix_polarity_and_nested_prefixes(self):
  result=compile_hybrid(doc(prose('body','Scene.'),tags('suffix','detailed',placement='suffix'),{'id':'ref','type':'prefix','ref':'nested','placement':'prefix'},{'id':'negative','type':'prefix','ref':'p','side':'negative'}),LIB)
  self.assertEqual(result['positive'],'night\n\nScene.\n\ndetailed');self.assertEqual(result['negative'],'watermark')
 def test_legacy_tag_rules_do_not_touch_prose(self):
  text='Red hair, night. Do not remove this sentence.'
  result=compile_hybrid(doc(tags('t','red hair, night'),prose('p',text),tag_rules=[rulebox('exclude',['red hair'])]))
  self.assertEqual(result['positive'],'night\n\n'+text);self.assertTrue(result['trace'][-2]['changed'])
 def test_rules_retain_conflict_and_origin_override_semantics(self):
  with self.assertRaisesRegex(ValueError,'Rules conflict'):compile_hybrid(doc(tags('t','night'),tag_rules=[rulebox('exclude',['night']),{**rulebox('require',['night']),'id':'other'}]))
  inherited={**rulebox('require',['day']),'origin':'global'}
  result=compile_hybrid(doc(tags('t','night'),tag_rules=[rulebox('require',['moon'])]),rule_library={'globals':[inherited]})
  self.assertIn('moon',result['positive']);self.assertNotIn('day',result['positive'])
 def test_conditional_prose_dependency_chain_and_trace(self):
  rows=[tags('night','night'),prose('light','Moonlight falls on the stone.',enabled=False),prose('texture','The stone is rough.',enabled=False)]
  rules=[dict(id='a',target='light',action='enable',tags=['night']),dict(id='b',target='texture',action='enable',components=['light'])]
  result=compile_hybrid(doc(*rows,rules=rules));self.assertIn('rough',result['positive']);self.assertEqual(len([r for r in result['trace'] if r['stage']=='component']),2)
 def test_rule_priority_conflict_and_cycle(self):
  rows=[prose('p','Scene.',enabled=False)]
  rules=[dict(id='a',target='p',action='enable',priority=1),dict(id='b',target='p',action='disable',priority=2)]
  self.assertEqual(compile_hybrid(doc(*rows,rules=rules))['positive'],'')
  rules[1]['priority']=1
  with self.assertRaisesRegex(ValueError,'equal priority'):compile_hybrid(doc(*rows,rules=rules))
  with self.assertRaisesRegex(ValueError,'cycle'):compile_hybrid(doc(*rows,rules=[dict(id='cycle',target='p',action='enable',unless=['p'])]))
 def test_reusable_nested_preset_activation_rules_and_globals(self):
  component={'id':'preset','name':'Identity','type':'group','children':[tags('hair','red hair'),prose('skin','Skin catches the light.',enabled=False)],'rules':[dict(id='skin-on',target='skin',action='enable',tags=['red hair'])]}
  lib={**LIB,'hybrid':{'version':1,'components':{'preset':component,'global':prose('global','Global style.',mode='global'),'off':prose('off','Never.',mode='disabled')}}}
  result=compile_hybrid(doc({'id':'ref','type':'reference','ref':'preset'},{'id':'off-ref','type':'reference','ref':'off'}),lib)
  self.assertIn('Skin catches',result['positive']);self.assertIn('Global style.',result['positive']);self.assertNotIn('Never.',result['positive'])
  result=compile_hybrid(doc({'id':'ref','type':'reference','ref':'preset','enabled':False}),lib);self.assertEqual(result['positive'],'Global style.')
 def test_global_nested_reference_is_not_automatically_added_twice(self):
  lib={**LIB,'hybrid':{'version':1,'components':{'g':prose('g','Global prose.',mode='global'),'preset':{'id':'preset','type':'group','children':[{'id':'r','type':'reference','ref':'g'}]}}}}
  self.assertEqual(compile_hybrid(doc({'id':'r','type':'reference','ref':'preset'}),lib)['positive'],'Global prose.')
 def test_sources_retrieve_image_components_and_preserve_attribution(self):
  lib={**LIB,'hybrid':{'version':1,'components':{'style':prose('style','Wet fabric reflects the light.')},'images':{'sha256:a':['style']}}}
  result=compile_hybrid(doc({'id':'image','type':'source','input':'source_text','format':'prose','image_keys':['sha256:a']}),lib,{'source_text':'She sits, silently.\n\nThe room is dim.'})
  self.assertIn('Wet fabric',result['positive']);self.assertEqual(result['components'][0]['image_keys'],['sha256:a']);self.assertTrue(result['components'][0]['source'])
 def test_seeded_alternatives_are_repeatable_and_prose_is_not_sampled(self):
  value=doc(tags('t','{red hair|blue hair}'),prose('p','Literal {a|b}.'),seed=42)
  self.assertEqual(compile_hybrid(value),compile_hybrid(value));self.assertIn('Literal {a|b}.',compile_hybrid(value)['positive'])
 def test_manual_override_keeps_compiled_structure(self):
  value=doc(tags('t','night'),override={'enabled':True,'positive':'My final words.','negative':''});result=compile_hybrid(value)
  self.assertEqual(result['positive'],'My final words.');self.assertEqual(result['compiled']['positive'],'night');self.assertEqual(value['components'][0]['text'],'night')
 def test_mixed_group_activation_is_seeded_and_keeps_prose_literal(self):
  group={'id':'g','type':'group','selection':'one','children':[prose('p','Literal {a|b}, first.'),prose('q','Second description.'),tags('t','night')]}
  value=doc(group,seed=17);result=compile_hybrid(value);self.assertEqual(result,compile_hybrid(value));self.assertEqual(len(result['components']),1)
  group['selection']='optional';group['chance']=0;self.assertEqual(compile_hybrid(doc(group))['positive'],'')
  group['chance']=1;self.assertIn('Literal {a|b}, first.',compile_hybrid(doc(group))['positive'])
 def test_reference_errors_are_actionable_and_bounded(self):
  lib={**LIB,'hybrid':{'version':1,'components':{'loop':{'id':'loop','type':'reference','ref':'loop'}}}}
  with self.assertRaisesRegex(ValueError,'Circular'):compile_hybrid(doc({'id':'r','type':'reference','ref':'loop'}),lib)
  with self.assertRaisesRegex(ValueError,'Missing reusable'):compile_hybrid(doc({'id':'r','type':'reference','ref':'missing'}),LIB)
 def test_portable_subset_keeps_nested_references_without_unrelated_content(self):
  lib={**LIB,'hybrid':{'version':1,'components':{'p':{'id':'p','type':'prefix','ref':'nested'},'unused':prose('unused','Unrelated.')}}}
  value=doc({'id':'r','type':'reference','ref':'p'});subset=library_subset(value,lib)
  self.assertEqual(set(subset['hybrid']['components']),{'p'});self.assertEqual({p['id'] for p in subset['prefixes']},{'p','nested'});self.assertEqual(compile_hybrid(value,subset)['positive'],'night')
 def test_node_string_schema_and_generation_metadata_are_model_independent(self):
  node=GalleryHybridPrompt();metadata={};result=node.compose(json.dumps(doc(prose('p','A scene, in moonlight.'),prose('neg','No caption.',side='negative'))),json.dumps(LIB),extra_pnginfo=metadata,unique_id='5')['result']
  self.assertEqual(node.RETURN_TYPES,('STRING','STRING','STRING'));self.assertEqual(result[:2],('A scene, in moonlight.','No caption.'))
  metadata['prompt']={'5':{'class_type':'GalleryHybridPrompt','inputs':{}},'6':{'class_type':'CLIPTextEncode','inputs':{'text':['5',0]}},'7':{'class_type':'CLIPTextEncode','inputs':{'text':['5',1]}},'8':{'class_type':'KSampler','inputs':{'positive':['6',0],'negative':['7',0]}}}
  self.assertEqual(prompts(metadata),{'positive':result[0],'negative':result[1]})
 def test_live_global_policy_is_applied_to_tags_only(self):
  box={**rulebox('require',['moon']),'origin':'global'}
  result=GalleryHybridPrompt().compose(json.dumps(doc(tags('t','night'),prose('p','A sentence, unchanged.'))),json.dumps(LIB),rules_policy=json.dumps({'globals':[box],'disabled':[]}))['result'][0]
  self.assertIn('moon',result);self.assertIn('A sentence, unchanged.',result)
 def test_referenced_source_presets_receive_current_image_associations(self):
  lib={**LIB,'hybrid':{'version':1,'components':{'source':{'id':'source','type':'source','input':'source_text'},'style':prose('style','Rain runs down the glass.')},'images':{'sha256:a':['style']}}}
  value=doc({'id':'r','type':'reference','ref':'source'},source_images={'source_text':['sha256:a']})
  result=compile_hybrid(value,lib,{'source_text':'night'});self.assertIn('Rain runs',result['positive']);self.assertTrue(all(row['source'] for row in result['components']));self.assertIn('style',library_subset(value,lib)['hybrid']['components'])
 def test_source_prefix_and_snapshot_rules_inherit_without_promoting_globals(self):
  id='a'*64;global_box={**rulebox('require',['global_tag']),'id':'global','origin':'global'};prefix_box={**rulebox('require',['prefix_tag']),'id':'prefix','origin':'prefix'};snapshot_box={**rulebox('require',['snapshot_tag']),'id':'snapshot','origin':'snapshot'}
  lib={**LIB,'snapshots':{id:{'id':id,'prefix_id':'p','terms':['night'],'negative_terms':[],'rules':[snapshot_box,global_box],'members':{'sha256:a':{'hash':'a'}}}}}
  value=doc({'id':'source','type':'source','input':'source_text'},source_prefixes={'source_text':['p']},source_snapshots={'source_text':[id]});rules={'globals':[global_box],'prefixes':{'p':[prefix_box]}}
  result=compile_hybrid(value,lib,{'source_text':'night'},rules);self.assertIn('snapshot_tag',result['positive']);self.assertNotIn('global_tag',result['positive']);self.assertNotIn('prefix_tag',result['positive']);self.assertEqual(library_subset(value,lib)['snapshots'][id]['members'],{})
  rules['prefixes']['snapshot:'+id]=[];self.assertIn('prefix_tag',compile_hybrid(value,lib,{'source_text':'night'},rules)['positive'])
  value['components'][0]['inherit_rules']=False;result=compile_hybrid(value,lib,{'source_text':'night'},rules);self.assertIn('global_tag',result['positive']);self.assertNotIn('prefix_tag',result['positive'])
 def test_native_anima_api_example_compiles_and_feeds_native_conditioning(self):
  api=json.loads((Path(__file__).resolve().parents[1]/'examples/anima-hybrid-api.json').read_text(encoding='utf-8'));inputs=api['4']['inputs'];result=GalleryHybridPrompt().compose(**inputs)['result']
  self.assertIn('Warm interior light',result[0]);self.assertEqual(api['5']['inputs']['text'],['4',0]);self.assertEqual(api['6']['inputs']['text'],['4',1]);self.assertEqual(api['2']['inputs']['clip_name'],'qwen_3_06b_base.safetensors')
  # Exercise the installed native encoding method without loading weights or importing torch.
  import ast,os
  root=Path(os.environ.get('COMFYUI_ROOT','D:/ComfyUI_windows_portable/ComfyUI'))
  if not (root/'nodes.py').exists():return
  tree=ast.parse((root/'nodes.py').read_text(encoding='utf-8'));cls=next(row for row in tree.body if isinstance(row,ast.ClassDef) and row.name=='CLIPTextEncode');method=next(row for row in cls.body if isinstance(row,ast.FunctionDef) and row.name=='encode');namespace={};exec(compile(ast.Module(body=[method],type_ignores=[]),'native-encode','exec'),namespace)
  class Encoder:
   def tokenize(self,text):return text
   def encode_from_tokens_scheduled(self,tokens):return {'encoded_text':tokens}
  self.assertEqual(namespace['encode'](None,Encoder(),result[0])[0]['encoded_text'],result[0])
 def test_hybrid_archives_restore_in_python_without_mutating_the_export(self):
  import gzip,base64
  from workflow_serialization import restore_workflow_node
  widgets=[json.dumps(doc(prose('p','A paragraph.\n\nAnother, literal paragraph.'))),json.dumps(LIB)]
  raw=json.dumps({'properties':{},'hybridWidgets':widgets}).encode();node={'type':'GalleryHybridPrompt','widgets_values':['{}','{}'],'properties':{'gallery_workflow_archive':{'version':1,'codec':'gzip-base64','bytes':len(raw),'data':base64.b64encode(gzip.compress(raw)).decode()}}};before=copy.deepcopy(node)
  self.assertEqual(restore_workflow_node(node)['widgets_values'],widgets);self.assertEqual(node,before)

class HybridPersistenceTests(unittest.TestCase):
 def test_first_write_backup_and_legacy_updates_preserve_hybrid_data(self):
  with tempfile.TemporaryDirectory() as directory:
   path=Path(directory)/'prompt-library.json';path.write_text(json.dumps(LIB),encoding='utf-8');original=path.read_bytes();revision=read(path)[1]
   result=update(path,{'action':'hybrid_save','component':prose('p','Prose, unchanged.'),'revision':revision});backup=path.with_name(path.name+'.pre-hybrid.bak');self.assertEqual(backup.read_bytes(),original)
   result=update(path,{'action':'save','name':'New legacy prefix','terms':['smile'],'revision':result['revision']});self.assertIn('p',result['library']['hybrid']['components'])
   result=update(path,{'action':'hybrid_save','component':prose('p','Revised prose.'),'revision':result['revision']});self.assertEqual(backup.read_bytes(),original)
 def test_import_collision_is_atomic_and_image_associations_roundtrip(self):
  with tempfile.TemporaryDirectory() as directory:
   path=Path(directory)/'p.json';result=update(path,{'action':'hybrid_import','hybrid':{'version':1,'components':{'p':prose('p','Prose.')}},'library':LIB,'revision':read(path)[1]})
   result=update(path,{'action':'hybrid_associate','image_keys':['sha256:a'],'components':['p'],'revision':result['revision']});self.assertEqual(read(path)[0]['hybrid']['images']['sha256:a'],['p'])
   before=path.read_bytes()
   with self.assertRaisesRegex(ValueError,'collision'):update(path,{'action':'hybrid_import','hybrid':{'version':1,'components':{'p':prose('p','Different.')}},'revision':result['revision']})
   self.assertEqual(path.read_bytes(),before)
 def test_invalid_or_future_schema_does_not_discard_legacy_data(self):
  with self.assertRaises(ValueError):validate({**LIB,'hybrid':{'version':2,'components':{}}})
  with self.assertRaises(ValueError):validate_document(doc(tags('t','night'),tags('t','day')))
  self.assertEqual(validate(LIB),LIB)

if __name__=='__main__':unittest.main()
