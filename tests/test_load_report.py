import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from load_report import GalleryLoadReport, token_load, upstream_nodes, model_assessment, auxiliary_load
from prefix_library import GalleryPromptEncode, RESOLVED_KEY


class Tensor:
    shape = (1, 512, 768, 3)
    def numel(self): return 512 * 768 * 3
    def element_size(self): return 4


class LoadReportTests(unittest.TestCase):
    def test_token_streams_keep_actual_content_separate_from_padding(self):
        tokens = {'l': [[(1, 1, 0), (10, 1, 1), (11, 1, 1), (2, 1, 0)], [(1, 1, 0), (12, 1, 2), (2, 1, 0)]],
                  't5': [[(20, 1), (21, 1)]]}
        rows = token_load(tokens)
        self.assertEqual(rows[0]['content_tokens'], 3)
        self.assertEqual(rows[0]['encoded_slots'], 7)
        self.assertEqual(rows[0]['chunks'], 2)
        self.assertNotIn('content_tokens', rows[1])
        self.assertEqual(token_load('unsupported'), [])

    def test_upstream_only_traversal_is_cycle_safe_and_deduplicated(self):
        prompt = {'1': {'inputs': {'x': ['2', 0], 'y': ['2', 1]}},
                  '2': {'inputs': {'cycle': ['1', 0]}}, '3': {'inputs': {}}}
        self.assertEqual(set(upstream_nodes(prompt, '1')), {'1', '2'})

    def test_model_estimate_is_relative_to_device_and_uses_real_latent_shape(self):
        class Model:
            def model_size(self): return 800
            def model_dtype(self): return 'float16'
            def memory_required(inner, shape):
                self.assertEqual(shape, [1, 512, 768, 3])
                return 400
        result = model_assessment(Model(), {'samples': Tensor()}, {'device_total_bytes': 1000})
        self.assertEqual(result['base_estimate_bytes'], 1200)
        self.assertEqual(result['capacity_fraction'], 1.2)
        self.assertIn('exceeds', result['assessment'])
        self.assertNotIn('base_estimate_bytes', model_assessment(Model(), None, {}))
        self.assertIn('Connect MODEL', model_assessment(None, None, {})['note'])

    def test_encoder_counts_effective_prompt_and_cached_conditioning_retains_measurement(self):
        class Clip:
            def tokenize(inner, text, return_word_ids=False):
                self.assertEqual(text, 'kept, source')
                return {'l': [[(1, 1, 0), (10, 1, 1), (11, 1, 2), (2, 1, 0)]] if return_word_ids else [[(1, 1), (10, 1), (11, 1), (2, 1)]]}
            def encode_from_tokens_scheduled(inner, tokens): return [[Tensor(), {}]]
        metadata = {}
        result = GalleryPromptEncode().encode(Clip(), 'kept, ⟦source -["removed"]⟧',
                    source_text='removed, source', source_mode='boxes', extra_pnginfo=metadata, unique_id='2')
        self.assertEqual(metadata[RESOLVED_KEY]['2']['token_load'][0]['content_tokens'], 2)
        images = Tensor()
        prompt = {'9': {'class_type': 'GalleryLoadReport', 'inputs': {'positive': ['2', 0]}},
                  '2': {'class_type': 'GalleryPromptEncode', 'inputs': {}},
                  '3': {'class_type': 'IPAdapterAdvanced', 'inputs': {}}}
        # Fresh EXTRA_PNGINFO simulates a cached encoder not executing this queue.
        with patch('load_report.hardware_snapshot', return_value={'device': 'test GPU'}):
            report = GalleryLoadReport().report(images, positive=result['result'][0], prompt=prompt, unique_id='9')
        self.assertIs(report['result'][0], images)
        payload = json.loads(report['result'][1])
        self.assertEqual(payload['encoders'][0]['token_streams'][0]['content_tokens'], 2)
        self.assertEqual(payload['encoders'][0]['side'], 'positive')
        self.assertEqual(payload['encoders'][0]['rules_applied'], 0)
        self.assertIn('same CLIP', payload['encoders'][0]['diagnostics']['note'])
        self.assertFalse(any(row['type'] == 'IPAdapterAdvanced' for row in payload['processes']))
        self.assertEqual(payload['output_images']['bytes'], images.numel() * 4)

    def test_cfg_branch_estimate_includes_two_conditioning_batches(self):
        class Model:
            def model_size(self): return 800
            def model_dtype(self): return 'float16'
            def memory_required(inner, shape):
                self.assertEqual(shape[0], 2)
                return 400
        result = model_assessment(Model(), {'samples': Tensor()}, {}, 2)
        self.assertEqual(result['conditioning_batch_factor'], 2)
        self.assertEqual(result['base_estimate_bytes'], 1200)

    def test_source_layout_and_control_settings_are_inventory_not_text_tokens(self):
        prompt = {'9': {'class_type': 'GalleryLoadReport', 'inputs': {'images': ['1', 0]}},
                  '1': {'class_type': 'ControlNetApplyAdvanced', 'inputs': {'image': ['2', 0], 'strength': 0.75}},
                  '2': {'class_type': 'GalleryImageSource', 'inputs': {'sources': json.dumps({'layout': 'single', 'active_index': 1, 'images': [{'input_name': 'a.png'}, {'input_name': 'b.png'}]})}}}
        with patch('load_report.hardware_snapshot', return_value={}):
            payload = GalleryLoadReport().report(Tensor(), prompt=prompt, unique_id='9')['ui']['load_report'][0]
        self.assertEqual(payload['source_images'][0]['names'], ['b.png'])
        self.assertEqual(payload['processes'][0]['parameters']['strength'], 0.75)
        self.assertEqual(payload['encoders'], [])

    def test_live_auxiliary_weights_and_image_contexts_are_deduplicated(self):
        class Wrapped:
            def model_size(self): return 2048
        wrapped = Wrapped()
        class Control:
            def get_models(self): return [wrapped]
        class Adapter:
            def parameters(self): return [tensor]
            def buffers(self): return []
        tensor = Tensor()
        class Patch:
            kwargs = [{'ipadapter': Adapter(), 'cond': tensor, 'uncond': tensor}]
        patch = Patch()
        class Model:
            model_options = {'transformer_options': {'patches_replace': {'attn2': {'a': patch, 'b': patch}}}}
        condition = [[tensor, {'control': Control()}]]
        result = auxiliary_load(Model(), condition, condition)
        self.assertEqual(len(result['auxiliary_models']), 2)
        self.assertEqual(result['auxiliary_models'][0]['weight_bytes'], 2048)
        self.assertEqual(len(result['image_contexts']), 1)


if __name__ == '__main__': unittest.main()
