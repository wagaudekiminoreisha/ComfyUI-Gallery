import unittest
from prefix_export import image_associations
class ExportTests(unittest.TestCase):
 def test_only_matching_image_associations_are_portable(self):
  library={'tags':[{'id':'t','text':'{blonde hair|brown hair}'}],'prefixes':[{'id':'p','name':'Hair','tags':['t']}],'associations':{'sha256:abc':{'prefix_id':'p'}},'snapshots':{'s':{'id':'s','prefix_id':'p','terms':['short hair'],'members':{'sha256:abc':{}},'rules':[]}}}
  rows=image_associations(library,'abc','/static_gallery/a.png')
  self.assertEqual(rows[0]['name'],'Hair');self.assertEqual(rows[0]['terms'],['{blonde hair|brown hair}']);self.assertEqual(rows[1]['snapshot_id'],'s')
  self.assertEqual(image_associations(library,'other','/static_gallery/b.png'),[])
