import unittest
from hydrus import spaced_tags

class SpacingTests(unittest.TestCase):
    def test_namespace_is_preserved_and_values_deduplicated(self):
        tags=['positive_prompt:blue_hair','positive_prompt:blue hair','custom_tag']
        self.assertEqual(spaced_tags(tags,{'tag_spacing':'spaces'}),['positive_prompt:blue hair','custom tag'])
        self.assertEqual(spaced_tags(tags,{'tag_spacing':'underscores'}),['positive_prompt:blue_hair','custom_tag'])
        self.assertEqual(spaced_tags(tags,{}),tags)

    def test_hybrid_metadata_matches_only_complete_used_tags(self):
        import json
        from hydrus_sync import matches,NOTE
        record={'hash':'a'*64,'notes':{NOTE:json.dumps({'positive':'(blue_hair:1.2), {red hair|green hair}, short hair','negative':'watermark'})}}
        self.assertTrue(matches(record,'positive',['blue hair']))
        self.assertFalse(matches(record,'all',['hair']))
        self.assertFalse(matches(record,'all',['green hair']))
        self.assertTrue(matches(record,'all',['-green hair']))
