"""Explicit source roles, attribution and compatibility, without language inference."""
import copy,json,sys,tempfile,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from hybrid_prompt import compile_hybrid,validate_document,library_subset,GalleryHybridPrompt
from prefix_library import read,update
from test_hybrid_prompt import doc,prose,tags,rulebox,LIB

def fixture(**source_options):
    preset={'id':'preset','type':'group','subject':'subject A','children':[
        prose('identity','A woman with red hair.',role='identity'),
        {'id':'motion','type':'group','role':'pose','children':[prose('pose','Her hand rests over her forehead.')]},
        prose('clothes','She wears a blue shirt.',role='clothing')]}
    library={**copy.deepcopy(LIB),'hybrid':{'version':1,'components':{'preset':preset},'images':{'sha256:a':['preset']}}}
    source={'id':'source','type':'source','input':'source_text','format':'prose','image_keys':['sha256:a'],**source_options}
    return doc(source),library

class HybridContributionTests(unittest.TestCase):
    def test_old_documents_keep_every_contribution_and_are_not_modified(self):
        document,library=fixture();before=copy.deepcopy((document,library))
        result=compile_hybrid(document,library,{'source_text':'Raw, literal {a|b}.'})
        self.assertEqual(result['positive'],'Raw, literal {a|b}.\n\nA woman with red hair.\n\nHer hand rests over her forehead.\n\nShe wears a blue shirt.')
        self.assertEqual((document,library),before)
    def test_pose_only_filters_raw_and_identity_before_compilation(self):
        document,library=fixture(source_roles=['pose'])
        result=compile_hybrid(document,library,{'source_text':'Raw identity and pose.'})
        self.assertEqual(result['positive'],'Her hand rests over her forehead.')
        included=[row for row in result['inspection'] if row['status']=='included']
        self.assertEqual(len(included),1);self.assertEqual(included[0]['role'],'pose');self.assertEqual(included[0]['subject'],'subject A');self.assertEqual(included[0]['editor_id'],'source')
        self.assertEqual(included[0]['input'],'source_text');self.assertEqual(included[0]['image_keys'],['sha256:a'])
        self.assertTrue(all(row['reason']=='Role excluded by source' for row in result['inspection'] if row['status']=='suppressed'))
    def test_raw_and_associations_have_independent_toggles(self):
        document,library=fixture(source_text_enabled=False)
        result=compile_hybrid(document,library,{'source_text':'Raw.'});self.assertNotIn('Raw.',result['positive']);self.assertIn('blue shirt',result['positive'])
        document['components'][0].update(source_text_enabled=True,source_components_enabled=False)
        result=compile_hybrid(document,library,{'source_text':'Raw.'});self.assertEqual(result['positive'],'Raw.')
        self.assertTrue(all(row['reason']=='Associated components excluded' for row in result['inspection'][1:]))
    def test_unassigned_and_explicit_source_role_and_no_roles(self):
        document,library=fixture(source_roles=['unassigned'])
        self.assertEqual(compile_hybrid(document,library,{'source_text':'Raw.'})['positive'],'Raw.')
        document['components'][0].update(role='pose',source_roles=['pose'],subject='subject B')
        result=compile_hybrid(document,library,{'source_text':'Raw.'});self.assertTrue(result['positive'].startswith('Raw.'))
        self.assertEqual(result['components'][0]['subject'],'subject B')
        document['components'][0]['source_roles']=[]
        self.assertEqual(compile_hybrid(document,library,{'source_text':'Raw.'})['positive'],'')
    def test_filtered_alternatives_do_not_consume_the_shared_choice(self):
        document,library=fixture(source_roles=['pose'])
        library['hybrid']['components']['preset'].update(selection='one')
        for seed in range(12):
            document['seed']=seed
            self.assertEqual(compile_hybrid(document,library)['positive'],'Her hand rests over her forehead.')
    def test_excluded_component_rules_and_tags_cannot_leak_back(self):
        document,library=fixture(source_roles=['pose'])
        identity=library['hybrid']['components']['preset']['children'][0]
        identity['tag_rules']=[rulebox('require',['red hair'])]
        identity['rules']=[dict(id='leak',target='manual',action='enable')]
        document['components'].append(prose('manual','Must remain off.',enabled=False))
        result=compile_hybrid(document,library)
        self.assertEqual(result['positive'],'Her hand rests over her forehead.')
        # Rules on an entirely excluded group must not leak either.
        library['hybrid']['components']['preset']['children'][1]['role']='clothing'
        library['hybrid']['components']['preset']['tag_rules']=[rulebox('require',['red hair'])]
        self.assertEqual(compile_hybrid(document,library)['positive'],'')
    def test_two_sources_use_independent_filters_and_polarities(self):
        document,library=fixture(source_roles=['pose'])
        document['components'].append({**document['components'][0],'id':'other','input':'source_text_2','side':'negative','source_roles':['clothing']})
        result=compile_hybrid(document,library)
        self.assertEqual(result['positive'],'Her hand rests over her forehead.');self.assertEqual(result['negative'],'She wears a blue shirt.')
    def test_restricted_roles_default_to_no_prefix_rules_but_explicit_opt_in_wins(self):
        document,library=fixture(source_roles=['pose']);document['source_prefixes']={'source_text':['p']}
        policy={'prefixes':{'p':[rulebox('require',['red hair'])]}}
        result=compile_hybrid(document,library,rule_library=policy)
        self.assertNotIn('red hair',result['positive'])
        self.assertFalse(next(row for row in result['trace'] if row['stage']=='source-policy')['inherit_rules'])
        document['components'][0]['inherit_rules']=True
        self.assertIn('red hair',compile_hybrid(document,library,rule_library=policy)['positive'])
        del document['components'][0]['source_roles'];del document['components'][0]['inherit_rules']
        self.assertIn('red hair',compile_hybrid(document,library,rule_library=policy)['positive'])
    def test_inspector_retains_duplicates_suppression_rules_and_override(self):
        document=doc(tags('a','night'),tags('b','night'),prose('off','Hidden.',enabled=False),tag_rules=[rulebox('exclude',['night'])],override={'enabled':True,'positive':'Final.','negative':''})
        result=compile_hybrid(document)
        self.assertEqual(result['positive'],'Final.');self.assertEqual(result['compiled']['positive'],'')
        rows={row['id']:row for row in result['inspection']}
        self.assertEqual(rows['a']['status'],'included');self.assertIn('before final tag rules',rows['a']['reason'])
        self.assertIn('duplicate',rows['b']['reason']);self.assertEqual(rows['off']['status'],'suppressed')
        self.assertTrue(all(row['overridden'] for row in rows.values()))
    def test_validation_rejects_malformed_scope_without_changing_schema_version(self):
        for field,value in [('role','unknown'),('role',[]),('subject',42),('source_roles','pose'),('source_roles',[[]]),('source_text_enabled',1),('source_components_enabled','no')]:
            with self.subTest(field=field,value=value),self.assertRaises(ValueError):validate_document(doc({'id':'s','type':'source','input':'source_text',field:value}))
    def test_roles_and_controls_roundtrip_library_portable_and_metadata(self):
        document,library=fixture(source_roles=['pose'],source_text_enabled=False)
        portable=json.loads(json.dumps(library_subset(document,library)))
        self.assertEqual(compile_hybrid(document,portable)['positive'],'Her hand rests over her forehead.')
        metadata={};GalleryHybridPrompt().compose(json.dumps(document),json.dumps(portable),extra_pnginfo=metadata)
        self.assertEqual(metadata['gallery_prompts']['hybrid']['components'][0]['role'],'pose')
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'library.json'
            result=update(path,{'action':'hybrid_save','revision':read(path)[1],'component':document['components'][0]})
            self.assertEqual(result['library']['hybrid']['components']['source']['source_roles'],['pose'])
            self.assertFalse(read(path)[0]['hybrid']['components']['source']['source_text_enabled'])

if __name__=='__main__':unittest.main()
