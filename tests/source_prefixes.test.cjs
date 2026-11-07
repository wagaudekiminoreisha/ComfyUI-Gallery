const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./ts_loader.cjs');
const { refreshSourcePrefix } = load('SourcePrefixes');
const { removeSourceImage, emptyImageSourceManifest } = load('ImageSourceGeometry');
const library = { version: 2, tags: [{ id: 't', name: 'New', text: 'new_tag' }], prefixes: [{ id: 'p', name: 'Pose', tags: ['t'], negative_terms: ['new_negative'] }] };
test('paired prefix edits update both source outputs and retain unrelated edits', () => {
    const image = { input_name: 'a.png', metadata: { gallery_prefix: { id: 'p', positive: ['old_tag'], negative: ['old_negative'] } }, prompt: { positive: 'custom, old tag', negative: 'old_negative, extra', tags: [] } };
    const updated = refreshSourcePrefix(image, library);
    assert.equal(updated.prompt.positive, 'custom, new_tag');
    assert.equal(updated.prompt.negative, 'extra, new_negative');
    assert.deepEqual(refreshSourcePrefix(updated, library), updated);
    assert.equal(image.prompt.positive, 'custom, old tag');
});
test('disabled prefix sides remain disabled; deletion unpairs without erasing workflow text', () => {
    const image = { input_name: 'a.png', metadata: { gallery_prefix: { id: 'p', positive: [], positive_enabled: false } }, prompt: { positive: '', negative: '', tags: [] } };
    assert.equal(refreshSourcePrefix(image, library).prompt.positive, '');
    const deleted = refreshSourcePrefix(image, { ...library, prefixes: [] });
    assert.equal(deleted.metadata.gallery_prefix, undefined);
    assert.deepEqual(deleted.prompt, image.prompt);
});
test('association by original URL adds current prefix and persists provenance', () => {
    const paired = { ...library, associations: { 'local:./:/static_gallery/example.png': { prefix_id: 'p', terms: ['outdated'] } } };
    const result = refreshSourcePrefix({ input_name: 'a.png' }, paired, '/static_gallery/example.png');
    assert.equal(result.prompt.positive, 'new_tag');
    assert.equal(result.metadata.gallery_url, '/static_gallery/example.png');
});
test('selected live recipes update independently and preserve shared terms, omissions and a frozen recipe', () => {
    const { sourcePrefixRefs } = load('SourcePrefixes');
    const image = {
        input_name: 'pose.png',
        metadata: { gallery_prefixes: [
            { id: 'p', positive: ['standing', 'silhouette', 'omit'], negative: ['old negative'] },
            { id: 'look', snapshot_id: 'frozen', positive: ['silhouette', 'red dress'], negative: ['frozen negative'] },
        ] },
        prompt: { positive: 'custom, standing, silhouette, red dress', negative: 'old negative, frozen negative', tags: [] },
    };
    const edited = {
        ...library,
        tags: [...library.tags, { id: 'omit', text: 'omit' }, { id: 'blue', text: 'blue dress' }],
        prefixes: [{ ...library.prefixes[0], tags: ['t', 'omit'] }, { id: 'look', name: 'Look', tags: ['blue'] }],
        snapshots: { frozen: { prefix_id: 'look', terms: ['silhouette', 'red dress'], negative_terms: ['frozen negative'] } },
    };
    const updated = refreshSourcePrefix(image, edited);
    assert.equal(updated.prompt.positive, 'custom, silhouette, red dress, new_tag');
    assert.equal(updated.prompt.negative, 'frozen negative, new_negative');
    assert.deepEqual(sourcePrefixRefs(updated.metadata).map(ref => ref.id), ['p', 'look']);
    assert.deepEqual(refreshSourcePrefix(updated, edited), updated);
});
test('removal remaps batch selection to the same surviving images', () => {
    const state = { ...emptyImageSourceManifest(), images: ['a', 'b', 'c'].map(input_name => ({ input_name })), batch_indices: [2, 1] };
    const result = removeSourceImage(state, 0);
    assert.deepEqual(result.batch_indices, [1, 0]);
    assert.deepEqual(result.batch_indices.map(i => result.images[i].input_name), ['c', 'b']);
});

test('saving a prefix refreshes serialized workflow sources, history and encoder notification', async () => {
    const fs = require('node:fs'), vm = require('node:vm'), ts = require('../web/node_modules/typescript');
    const image = { input_name: 'a.png', metadata: { gallery_prefix: { id: 'p', positive: ['old'], negative: [] } }, prompt: { positive: 'old', negative: '', tags: [] } };
    let callbacks = 0, changes = 0; const events = [];
    const widget = { name: 'sources', value: JSON.stringify({ ...emptyImageSourceManifest(), images: [image] }), callback: () => callbacks++ };
    const node = { type: 'GalleryImageSource', widgets: [widget], properties: { gallery_source_history: [image] } };
    const app = { canvas: { graph: { _nodes: [node], change: () => changes++ } } };
    const context = { exports: {}, Event, window: { comfyAPI: { api: { api: { fetchApi: async () => ({ ok: true, json: async () => ({ library, revision: 'new' }) }) } } }, dispatchEvent: event => events.push(event.type) }, localStorage: { setItem() {} }, require: name => name === './SourcePrefixes' ? { refreshSourcePrefix } : name === './PromptBoxes' ? load('PromptBoxes') : { getComfyApp: () => app } };
    const source = ts.transpileModule(fs.readFileSync('web/src/PrefixLibrary.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
    vm.runInNewContext(source, context);
    await context.exports.savePrefix('Pose', ['new_tag'], 'old', [], ['new_negative']);
    const state = JSON.parse(widget.value);
    assert.equal(load('ImageSourceGeometry').sourcePrompt(state, 'positive'), 'new_tag');
    assert.equal(state.images[0].prompt.negative, 'new_negative');
    assert.equal(node.properties.gallery_source_history[0].prompt.positive, 'new_tag');
    assert.equal(callbacks, 1); assert.equal(changes, 1);
    assert.ok(events.includes('gallery-source-changed'));
});
