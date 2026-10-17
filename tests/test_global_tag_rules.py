import copy
import importlib.util
import json
from pathlib import Path
import sqlite3
import unittest

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('gallery_tag_rules',ROOT/'tag_rules.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)


class GlobalRuleCatalogTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pack=json.loads((ROOT/'data/global-tag-rules.json').read_text(encoding='utf-8'))
        cls.vocabulary=module.load_vocabulary()

    def test_pack_is_reproducible_from_the_pinned_vocabulary(self):
        spec=importlib.util.spec_from_file_location('build_rules',ROOT/'tools/build_tag_rules.py')
        builder=importlib.util.module_from_spec(spec);spec.loader.exec_module(builder)
        self.assertEqual(builder.build(),self.pack)
        self.assertEqual(module.validate_pack(self.pack,self.vocabulary),self.pack)
        self.assertTrue(self.pack['unmapped_proposals'])

    def test_invalid_references_and_enforcement_are_rejected(self):
        mutations=[lambda p:p['rules'][0].update(policy='enforce'),
                   lambda p:p['rules'][0].update(status='reviewed'),
                   lambda p:p['rules'][0].update(facets=['missing']),
                   lambda p:p['facets'][0]['members'][0].update(tag='not_in_vocabulary'),
                   lambda p:p['rules'][0].update(scope=['arbitrary_code']),
                   lambda p:p['rules'][0].update(exceptions=['nonexistent']),
                   lambda p:p['rules'][0].update(kind='execute_python')]
        for change in mutations:
            invalid=copy.deepcopy(self.pack);change(invalid)
            with self.assertRaises(ValueError):module.validate_pack(invalid,self.vocabulary)

    def test_catalog_has_integrity_search_and_separate_topic_membership(self):
        with sqlite3.connect(':memory:') as connection:
            stats=module.populate_database(connection,self.pack)
            self.assertEqual(stats['tag'],len(self.vocabulary));self.assertGreater(stats['topic_member'],9000)
            self.assertEqual(connection.execute('PRAGMA integrity_check').fetchone()[0],'ok')
            self.assertEqual(connection.execute('PRAGMA foreign_key_check').fetchall(),[])
            self.assertTrue(connection.execute("SELECT name FROM tag_search WHERE tag_search MATCH 'sidelocks'").fetchall())
            self.assertEqual(connection.execute('SELECT count(*) FROM rule WHERE policy="enforce"').fetchone()[0],0)
            self.assertEqual(connection.execute('SELECT count(*) FROM rule_facet WHERE facet_id LIKE "tag_group:%"').fetchone()[0],0)
            self.assertTrue(connection.execute('SELECT r.id FROM rule r JOIN rule_facet f ON f.rule_id=r.id WHERE f.facet_id=?',('hair.length',)).fetchall())


if __name__=='__main__':unittest.main()
