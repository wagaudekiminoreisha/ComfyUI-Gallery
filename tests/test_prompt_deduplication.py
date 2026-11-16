import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from prompt_deduplication import deduplicate_prompt
from prefix_library import GalleryPromptEncode, RESOLVED_KEY, compose_shared_prompt


class Clip:
    def tokenize(self, text):
        self.text = text
        return text

    def encode_from_tokens_scheduled(self, tokens):
        return tokens


class PromptDeduplicationTests(unittest.TestCase):
    def test_exact_tags_across_nested_weighted_groups(self):
        text = '(blue eyes, (smile:1.1):1.2), (blue eyes, long hair, (smile:1.1):1.2)'
        self.assertEqual(deduplicate_prompt(text), '(blue eyes, (smile:1.1):1.2), (long hair:1.2)')
        self.assertEqual(deduplicate_prompt('(blue eyes:1.2), (blue eyes:1.2)'), '(blue eyes:1.2)')
        self.assertEqual(deduplicate_prompt('[blue eyes], [blue eyes, smile]'), '[blue eyes], [smile]')

    def test_distinct_attention_spelling_and_syntax_survive(self):
        text = 'blue eyes, blue_eyes, Blue eyes, (blue eyes), [blue eyes], (blue eyes:1.2), (blue eyes:1.3), ((blue eyes))'
        self.assertEqual(deduplicate_prompt(text), text)
        self.assertEqual(deduplicate_prompt('a,  (b:1.2), c'), 'a,  (b:1.2), c')

    def test_empty_duplicate_wrappers_disappear_and_order_is_stable(self):
        self.assertEqual(deduplicate_prompt('a, b, a, ((c)), ((c)), b, d'), 'a, b, ((c)), d')
        self.assertEqual(deduplicate_prompt('((a, a):1.2), ((a):1.2)'), '((a):1.2)')
        self.assertEqual(deduplicate_prompt(''), '')

    def test_escaped_delimiters_schedules_and_breaks(self):
        self.assertEqual(deduplicate_prompt(r'tag\(x\), tag\(x\), other'), r'tag\(x\), other')
        self.assertEqual(deduplicate_prompt('a, BREAK, a, a'), 'a, BREAK, a')
        self.assertEqual(deduplicate_prompt('(a:1.2), BREAK, (a:1.2)'), '(a:1.2), BREAK, (a:1.2)')
        self.assertEqual(deduplicate_prompt('[a:b:0.5], a'), '[a:b:0.5], a')
        self.assertEqual(deduplicate_prompt('(broken, a, a'), '(broken, a, a')

    def test_different_optional_contexts_keep_independent_choices_and_occurrences(self):
        clip, metadata = Clip(), {}
        template = '{blue eyes|green eyes}, {{blue eyes|red eyes}, smile|}'
        with patch('random.choice', side_effect=lambda options: options[0]):
            result = GalleryPromptEncode().encode(clip, template, extra_pnginfo=metadata, unique_id='1')
        self.assertEqual(result['result'], ('blue eyes, blue eyes, smile', 'blue eyes, blue eyes, smile'))
        self.assertEqual(clip.text, 'blue eyes, blue eyes, smile')
        record = metadata[RESOLVED_KEY]['1']
        self.assertEqual(record['text'], template)
        self.assertEqual(len(record['choices']), 3)
        self.assertEqual(record['resolved'], clip.text)
        self.assertEqual(result['ui']['effective_prompt'], [clip.text])
        with patch('random.choice', side_effect=['blue eyes', 'red eyes', 'red eyes, smile']):
            result = GalleryPromptEncode().encode(clip, template)
        self.assertEqual(result['result'][1], 'blue eyes, red eyes, smile')

    def test_matching_optional_groups_share_one_roll_and_source_owns_the_tag(self):
        self.assertEqual(compose_shared_prompt('blue eyes, style', 'blue eyes, pose'), 'style, blue eyes, pose')
        self.assertEqual(compose_shared_prompt('{blue eyes|}, style', '{blue eyes|}, pose'), 'style, {blue eyes|}, pose')
        self.assertEqual(compose_shared_prompt('blue eyes, {blue eyes|}'), 'blue eyes, {blue eyes|}')
        self.assertEqual(compose_shared_prompt('({a|b}:1.2), ⟦source⟧', '({a|b}:1.2)', 'boxes'), '({a|b}:1.2)')
        with patch('random.choice', side_effect=lambda options: options[0]) as choose:
            metadata={}
            result=GalleryPromptEncode().encode(Clip(), '{blue eyes|}, style', source_text='{blue eyes|}, pose',extra_pnginfo=metadata,unique_id='1')
        self.assertEqual(result['result'][1], 'style, blue eyes, pose')
        self.assertEqual(choose.call_count, 1)
        self.assertEqual(metadata[RESOLVED_KEY]['1']['sampling_template'],'style, {blue eyes|}, pose')
        with patch('random.choice', return_value='blue eyes') as choose:
            result=GalleryPromptEncode().encode(Clip(), 'blue eyes, {blue eyes|}')
        self.assertEqual(result['result'][1], 'blue eyes, blue eyes')
        self.assertEqual(choose.call_count, 1)
        self.assertFalse(GalleryPromptEncode.INPUT_TYPES()['required']['text'][1]['dynamicPrompts'])

    def test_sources_rules_and_metadata_use_the_same_final_prompt(self):
        clip, metadata = Clip(), {}
        rules = [{'id': 'safety', 'definition': {'version': 1, 'id': 'safety', 'name': 'Safety', 'family': 'safety',
                  'rules': [{'op': 'exclude', 'tags': ['gore']}]}}]
        result = GalleryPromptEncode().encode(clip, '(blue eyes:1.2), ⟦source⟧, ⟦source:source_text_2⟧',
            source_mode='boxes', source_text='(blue eyes, smile:1.2), gore',
            source_text_2='(blue eyes, long hair:1.2)', rules_state=json.dumps(rules),
            extra_pnginfo=metadata, unique_id='1')
        self.assertEqual(result['result'][1], '(blue eyes, smile:1.2), (long hair:1.2)')
        self.assertEqual(metadata[RESOLVED_KEY]['1']['diagnostic_context']['effective'], clip.text)
        self.assertIn('gore', metadata[RESOLVED_KEY]['1']['diagnostic_context']['before_rules'])
        self.assertEqual(metadata[RESOLVED_KEY]['1']['source_text'], '(blue eyes, smile:1.2), gore, (blue eyes, long hair:1.2)')


if __name__ == '__main__':
    unittest.main()
