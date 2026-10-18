import json
from pathlib import Path
import sys
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from hair_policy import clean_policy, filter_hair_prompt
from prefix_library import GalleryPromptEncode
from media_archive import archive_update, register_archive_routes
from aiohttp import web
from aiohttp.test_utils import TestClient, TestServer


class HairTests(unittest.TestCase):
    def test_ambiguous_highlights_are_not_rewritten_to_hair(self):
        from tag_dictionary import format_terms, prompt_tags
        self.assertEqual(format_terms(['highlights']), ['highlights'])
        self.assertNotIn('streaked_hair', prompt_tags('highlights'))

    def test_shared_browser_backend_cases(self):
        for fixture in json.loads(Path(__file__).with_name('hair_policy_cases.json').read_text()):
            with self.subTest(text=fixture['text']):
                self.assertEqual(filter_hair_prompt(fixture['text'], fixture['policy']), fixture['expected'])

    def test_filtering_does_not_change_source_option_probabilities(self):
        from unittest.mock import patch
        class Clip:
            def tokenize(self, text): return text
            def encode_from_tokens_scheduled(self, value): return value
        def pick(options):
            self.assertEqual(options, ['long hair', 'short hair', 'blue eyes'])
            return options[0]
        with patch('random.choice', side_effect=pick):
            result = GalleryPromptEncode().encode(Clip(), '⟦source⟧', '{long hair|short hair|blue eyes}', 'boxes', hair_policy='{"mode":"natural"}')
        self.assertEqual(result['result'][1], '')

    def test_source_filter_runs_before_clip_and_records_effective_prompt(self):
        class Clip:
            def tokenize(self, text): self.text = text; return text
            def encode_from_tokens_scheduled(self, value): return value
        clip, metadata = Clip(), {}
        result = GalleryPromptEncode().encode(clip, 'long hair, ⟦source⟧', '(red hair:1.2), blue eyes, {fiery hair|snake hair}', 'boxes', metadata, '7', json.dumps({'mode': 'natural'}))
        self.assertEqual(clip.text, 'blue eyes')
        self.assertEqual(result['result'][1], 'blue eyes')
        self.assertEqual(metadata['gallery_prompts']['7']['resolved'], 'blue eyes')
        self.assertEqual(metadata['gallery_prompts']['7']['hair_policy']['mode'], 'natural')


class ArchiveTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.path = self.root / 'user' / 'archive.json'

    def test_restore_roots_concurrency_and_unchanged_original(self):
        original = self.root / 'image.png'
        original.write_bytes(b'unchanged-original')
        with ThreadPoolExecutor(max_workers=4) as pool:
            list(pool.map(lambda i: archive_update(self.path, self.root, [f'/static_gallery/{i}.png']), range(20)))
        self.assertEqual(len(archive_update(self.path, self.root)['urls']), 20)
        self.assertEqual(archive_update(self.path, self.root / 'other')['urls'], [])
        self.assertEqual(len(archive_update(self.path, self.root, ['/static_gallery/0.png'], False)['urls']), 19)
        self.assertEqual(original.read_bytes(), b'unchanged-original')
        self.assertFalse(list(self.path.parent.glob('tmp*')))
        for urls in [['hydrus:abc'], ['/view?filename=preview.png'], ['https://example.test/file'], 'not a list']:
            with self.assertRaises(ValueError): archive_update(self.path, self.root, urls)

    async def test_routes_user_isolation_and_cross_origin(self):
        routes = web.RouteTableDef()
        register_archive_routes(routes, lambda request: self.root / request.headers.get('X-User', 'default') / 'archive.json', lambda request: self.root)
        app = web.Application(); app.add_routes(routes)
        async with TestClient(TestServer(app)) as client:
            response = await client.post('/Gallery/archive', json={'urls':['/static_gallery/image.png']})
            self.assertEqual(response.status, 200)
            response = await client.get('/Gallery/archive', headers={'X-User':'other'})
            self.assertEqual((await response.json())['urls'], [])
            response = await client.post('/Gallery/archive', json={'urls':[]}, headers={'Origin':'https://evil.example'})
            self.assertEqual(response.status, 403)
            response = await client.post('/Gallery/archive', json={})
            self.assertEqual(response.status, 400)
            response = await client.post('/Gallery/archive', json={'urls':['/static_gallery/image.png'],'archived':False})
            self.assertEqual((await response.json())['urls'], [])


if __name__ == '__main__': unittest.main()
