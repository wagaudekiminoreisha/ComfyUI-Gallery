import re
from pathlib import Path
import sys
import unittest
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from prompt_load import diagnose_prompt, prompt_groups, leaf_names, project_text
from load_report import token_load
from load_report import GalleryLoadReport
from prefix_library import GalleryPromptEncode


class Clip:
    def encode_from_tokens_scheduled(self, tokens): return [['embedding', {}]]
    def tokenize(self, text, return_word_ids=False):
        words = re.findall(r'[a-z]+', text)
        chunks = [words[index:index+4] for index in range(0, len(words), 4)] or [[]]
        batches = []
        for chunk in chunks:
            tokens = [(0, 1, 0)] + [(index+10, 1, index+1) for index in range(len(chunk))] + [(1, 1, 0)]
            tokens += [(1, 1, 0)] * (6-len(tokens))
            batches.append(tokens if return_word_ids else [(token, weight) for token, weight, _ in tokens])
        return {'l': batches}


def rule(name, op, tags):
    return {'id': name, 'definition': {'version': 1, 'id': name, 'name': name, 'family': name,
                                      'rules': [{'op': op, 'tags': tags}]}}


class PromptLoadTests(unittest.TestCase):
    def diagnose(self, context):
        clip = Clip()
        return diagnose_prompt(context, clip, token_load(clip.tokenize(context['effective'], True)))

    def test_long_alternative_syntax_only_counts_selected_final_tags(self):
        group = {'name': 'Eyes', 'kind': 'group', 'syntax': '({blue eyes|green eyes|hazel eyes|}:1.2)'}
        context = {'effective': '(blue eyes:1.2), long hair, smile', 'before_rules': '', 'groups': [group], 'rules': []}
        result = self.diagnose(context)
        measured = result['groups'][0]
        self.assertEqual(measured['streams'][0]['content_tokens'], 2)
        self.assertEqual(measured['without_group_delta'][0]['token_delta'], 2)
        self.assertEqual(measured['without_group_delta'][0]['chunk_delta'], 1)
        self.assertNotIn('hazel', measured['resolved_text'])

    def test_rulesets_can_save_tokens_or_add_them(self):
        context = {'before_rules': 'blue eyes, gore', 'effective': 'blue eyes, long hair', 'groups': [],
                   'rules': [rule('Safety', 'exclude', ['gore']), rule('Look', 'require', ['long hair'])]}
        rows = self.diagnose(context)['rulesets']
        self.assertEqual(rows[0]['delta'][0]['token_delta'], -1)
        self.assertEqual(rows[1]['delta'][0]['token_delta'], 2)

    def test_shared_groups_are_marked_and_do_not_sum_to_a_total(self):
        group = {'name': 'Shared', 'kind': 'group', 'syntax': '{blue eyes|green eyes}'}
        context = {'effective': 'blue eyes', 'before_rules': '', 'rules': [], 'groups': [group, {**group, 'name': 'Other'}]}
        result = self.diagnose(context)
        self.assertEqual(result['groups'][0]['shared_tags'], ['blue_eyes'])
        self.assertIn('not additive', result['notes'][0])

    def test_workflow_names_and_source_groups_survive_provenance_capture(self):
        workflow = {'workflow': {'nodes': [{'id': 2, 'properties': {'prompt_boxes': {'boxes': [
            {'kind': 'group', 'name': 'Character', 'chips': [{'kind': 'or', 'options': ['blue eyes', 'green eyes']}]},
            {'kind': 'source'}]}}}]}}
        groups = prompt_groups(workflow, '2', '{standing|sitting}, smile')
        self.assertEqual([group['name'] for group in groups], ['Character · group 1', 'Character', 'Source tags', 'Source group 1'])
        self.assertEqual(leaf_names('({blue eyes|green eyes}:1.2)'), ['blue eyes', 'green eyes'])
        self.assertEqual(project_text('(blue eyes, long hair:1.2), smile', {'blue_eyes'}), '(blue eyes:1.2)')

    def test_mismatched_clip_and_bounded_analysis(self):
        context = {'effective': 'blue eyes', 'before_rules': '', 'rules': [], 'groups': []}
        self.assertIn('same CLIP', diagnose_prompt(context, Clip(), [])['note'])
        context['groups'] = [{'name': str(index), 'kind': 'group', 'syntax': 'blue eyes'} for index in range(70)]
        result = self.diagnose(context)
        self.assertEqual(result['coverage']['groups_analyzed'], 64)
        self.assertEqual(result['coverage']['groups_total'], 70)

    def test_cached_conditioning_carries_named_group_and_rule_provenance_to_report(self):
        clip = Clip()
        metadata = {'workflow': {'nodes': [{'id': 2, 'properties': {'prompt_boxes': {'boxes': [
            {'kind': 'group', 'name': 'Eyes recipe', 'chips': [{'kind': 'or', 'options': ['blue eyes', 'green eyes']}]}]}}}]}}
        encoded = GalleryPromptEncode().encode(clip, 'blue eyes, gore', rules_state=[rule('Safety', 'exclude', ['gore'])], extra_pnginfo=metadata, unique_id='2')
        with patch('load_report.hardware_snapshot', return_value={}):
            report = GalleryLoadReport().report('images', positive=encoded['result'][0], clip=clip)['ui']['load_report'][0]
        diagnosis = report['encoders'][0]['diagnostics']
        self.assertEqual(diagnosis['groups'][0]['name'], 'Eyes recipe · group 1')
        self.assertEqual(diagnosis['rulesets'][0]['delta'][0]['token_delta'], -1)
        self.assertEqual(report['encoders'][0]['rules_applied'], 1)

    def test_conflicting_counterfactual_is_reported_instead_of_assigning_a_cost(self):
        context = {'before_rules': 'a, b', 'effective': 'b', 'groups': [],
                   'rules': [rule('Remove a', 'exclude', ['a']), rule('Exclusive', 'exclusive', ['a', 'b'])]}
        result = self.diagnose(context)
        self.assertIn('conflict', result['rulesets'][0]['note'])
        self.assertNotIn('delta', result['rulesets'][0])


if __name__ == '__main__': unittest.main()
