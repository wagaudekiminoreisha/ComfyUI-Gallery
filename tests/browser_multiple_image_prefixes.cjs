const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
    const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, headless: true });
    try {
        const page = await browser.newPage({ viewport: { width: 1500, height: 1100 } });
        const base = process.env.GALLERY_QA_URL || 'http://127.0.0.1:8191';
        await page.goto(base);
        const pair = async (name, term) => {
            const { revision } = await (await page.request.get(base + '/Gallery/prefixes')).json();
            const response = await page.request.post(base + '/Gallery/prefixes', {
                data: { action: 'save', revision, name, terms: [term], image_keys: ['local:./:/static_gallery/study-1.png'] },
            });
            assert.equal(response.status(), 200);
        };
        await pair('QA Pose', 'standing');
        await pair('QA Look', 'red dress');
        await page.getByRole('tab', { name: 'Gallery workspace', exact: true }).click();
        await page.getByRole('checkbox', { name: 'Select study-1.png', exact: true }).click();
        await page.getByRole('checkbox', { name: 'Select study-2.png', exact: true }).click();
        await page.getByRole('button', { name: 'Append to Image Source (2)', exact: true }).click();
        const append = page.getByRole('dialog', { name: 'Append images and prompts', exact: true });
        if (!(await append.getByText('@QA Pose', { exact: true }).first().isVisible())) {
            await append.getByText('study-1.png', { exact: true }).first().click();
        }
        await append.getByText('@QA Pose', { exact: true }).first().waitFor();
        await append.getByText('@QA Look', { exact: true }).first().waitFor();
        await append.getByRole('button', { name: 'Append to workflow', exact: true }).click();
        const editor = page.getByRole('dialog', { name: 'Gallery Image Source', exact: true });
        await editor.getByRole('button', { name: 'Cancel', exact: true }).click();
        const outputs = await page.evaluate(() => {
            const node = window.qaNodes[0];
            const sources = JSON.parse(node.widgets[0].value);
            return sources.images.map(image => ({ name: image.title, label: node.outputs[8 + image.output_slot].label }));
        });
        assert.equal(outputs.length, 2);
        for (const image of outputs) assert.match(image.label, new RegExp('^Image [12] · ' + image.name + '$'));

        await page.evaluate(() => {
            const graph = window.comfyAPI.app.app.graph;
            const source = window.qaNodes[0];
            const manifest = JSON.parse(source.widgets[0].value);
            manifest.active_index = manifest.images.findIndex(image => image.title === 'study-1.png');
            source.widgets[0].value = JSON.stringify(manifest);
            graph.links = { 101: { origin_id: source.id, origin_slot: 4 } };
            const host = document.createElement('div');
            host.id = 'qa-live-encoder';
            document.body.append(host);
            const encoder = {
                comfyClass: 'GalleryPromptEncode', widgets: [{ name: 'text', value: '' }, { name: 'source_mode', value: 'after' }],
                inputs: [{ name: 'source_text', link: 101 }], properties: {}, setDirtyCanvas() {},
                addWidget(type, name, value, callback) { this.widgets.push({ type, name, value, callback }); },
                addDOMWidget(name, type, element) { host.append(element); return { name, type }; },
            };
            graph.add(encoder);
            window.qaExtension.nodeCreated(encoder);
        });
        const encoder = page.locator('#qa-live-encoder');
        await encoder.getByText('standing', { exact: true }).first().waitFor({ state: 'attached' });
        await page.evaluate(() => window.dispatchEvent(new CustomEvent('gallery-prefix-manager', {
            detail: { name: 'QA Pose', positive: ['sitting'] },
        })));
        await page.getByRole('button', { name: 'Save prefix', exact: true }).click();
        await encoder.getByText('sitting', { exact: true }).first().waitFor({ state: 'attached' });
        assert.ok(await encoder.getByText('red dress', { exact: true }).count());
        assert.equal(await encoder.getByText('standing', { exact: true }).count(), 0);
        console.log('PASS: numbered image outputs, multiple selected prefixes, and live encoder refresh.');
    } finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
