from pathlib import Path
import sys
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from tag_dictionary import browse_vocabulary

def names(**filters):
    return {row['name'] for row in browse_vocabulary({'selection':True,'limit':10000,**filters})['items']}

class RefinementTests(unittest.TestCase):
    def test_child_browsing_and_union_are_canonical_and_unique(self):
        tops=names(refinements=['clothing-tops'])
        bottoms=names(refinements=['clothing-bottoms'])
        self.assertIn('shirt',tops);self.assertNotIn('skirt',tops)
        self.assertIn('skirt',bottoms)
        self.assertEqual(names(refinements=['clothing-tops','clothing-bottoms']),tops|bottoms)
        self.assertTrue(tops|bottoms <= names(refinements=['clothing']))
        self.assertEqual(names(refinements=['clothing','clothing-tops']),names(refinements=['clothing']))

    def test_search_wiki_favorites_and_bulk_share_the_same_subset(self):
        filters={'refinements':['clothing-tops'],'categories':['tag_group:attire'],'query':'shirt','sort':'alphabetical'}
        complete=browse_vocabulary({**filters,'selection':True,'limit':10000})
        paged=browse_vocabulary({**filters,'offset':2,'limit':3})
        self.assertEqual(paged['items'],complete['items'][2:5]);self.assertEqual(paged['total'],complete['total'])
        self.assertEqual(names(**filters,favorites=['shirt','skirt']),{'shirt'})
        self.assertEqual(names(refinements=['pose-motion'],favorites=['running','sitting']),{'running'})

    def test_tree_metadata_and_invalid_filters(self):
        data=browse_vocabulary({})
        nodes={node['value']:node for node in data['refinements']}
        self.assertEqual(nodes['tag_group:attire::clothing-tops']['parent'],'tag_group:attire')
        self.assertEqual(nodes['tag_group:attire::clothing-tops']['count'],len(names(refinements=['tag_group:attire::clothing-tops'])))
        for root in data['categories']:
            self.assertEqual(nodes[root['value']]['count'],root['count'])
            children=[node for node in nodes.values() if node.get('parent')==root['value']]
            if children:
                union=set().union(*(names(refinements=[child['value']]) for child in children))
                self.assertEqual(union,names(refinements=[root['value']]))
        for node in nodes.values():
            if node.get('parent'):self.assertIn(node['parent'],nodes)
        for value in ('clothing-tops',['missing'],[{}],['hair']*101,None):
            with self.assertRaises(ValueError):browse_vocabulary({'refinements':value})

if __name__=='__main__':unittest.main()
