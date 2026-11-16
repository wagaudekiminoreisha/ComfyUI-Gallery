import base64
import copy
import gzip
import json
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from workflow_serialization import restore_workflow_node
from prompt_load import prompt_groups
from catalogue_metadata import compact_metadata


def archive(node, payload):
    raw = json.dumps(payload, ensure_ascii=False).encode('utf-8')
    node['properties']['gallery_workflow_archive'] = {
        'version': 1, 'codec': 'gzip-base64', 'bytes': len(raw),
        'data': base64.b64encode(gzip.compress(raw)).decode('ascii')}
    return node


class WorkflowSerializationTests(unittest.TestCase):
    def encoder(self):
        boxes = {'boxes': [{'kind': 'group', 'name': 'Identity', 'chips': [
            {'kind': 'tag', 'text': 'blue eyes', 'enabled': True}]}]}
        return archive({'id': 2, 'type': 'GalleryPromptEncode', 'widgets_values': ['blue eyes'],
                        'properties': {'gallery_encoder_widgets': {'version': 2, 'fields': {'text': 0}}}},
                       {'properties': {'prompt_boxes': boxes}})

    def test_backend_reports_and_catalogue_keep_groups(self):
        node = self.encoder()
        before = copy.deepcopy(node)
        workflow = {'workflow': {'nodes': [node]}}
        self.assertEqual(prompt_groups(workflow, 2, '')[0]['name'], 'Identity')
        projected = compact_metadata(workflow)
        self.assertEqual(projected['workflow']['nodes'][0]['properties']['prompt_boxes']['boxes'][0]['name'], 'Identity')
        restored = restore_workflow_node(node)
        self.assertEqual(restored['properties']['gallery_encoder_widgets']['values']['text'], 'blue eyes')
        self.assertEqual(node, before)

    def test_source_metadata_and_history_roundtrip_without_aliasing(self):
        metadata = {'workflow': {'nodes': []}, 'gallery_prefixes': [{'id': 'pose'}]}
        node = archive({'type': 'GalleryImageSource', 'properties': {}, 'widgets_values': [
            json.dumps({'images': [{'input_name': 'a.png', 'metadata': {}}]})]}, {
            'properties': {'gallery_source_history': [{'metadata': {'__gallery_archive_metadata': 0}}, {'metadata': None}]},
            'metadata': [metadata], 'sourceMetadata': [[0, 0]]})
        before = copy.deepcopy(node)
        restored = restore_workflow_node(node)
        self.assertEqual(json.loads(restored['widgets_values'][0])['images'][0]['metadata'], metadata)
        self.assertEqual(restored['properties']['gallery_source_history'][0]['metadata'], metadata)
        self.assertEqual(node, before)
        self.assertNotIn('gallery_workflow_archive', restored['properties'])

    def test_legacy_untouched_and_corruption_rejected(self):
        legacy = {'type': 'GalleryPromptEncode', 'properties': {'prompt_boxes': {}}}
        self.assertIs(restore_workflow_node(legacy), legacy)
        for field, value in [('version', 2), ('bytes', 100000000), ('data', 'broken')]:
            node = self.encoder()
            node['properties']['gallery_workflow_archive'][field] = value
            with self.assertRaises(ValueError):
                restore_workflow_node(node)
        node = self.encoder()
        data = bytearray(base64.b64decode(node['properties']['gallery_workflow_archive']['data']))
        data[-8] ^= 1
        node['properties']['gallery_workflow_archive']['data'] = base64.b64encode(data).decode('ascii')
        with self.assertRaises(ValueError):
            restore_workflow_node(node)


if __name__ == '__main__':
    unittest.main()
