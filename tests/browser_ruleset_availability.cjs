const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');

(async () => {
    const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, headless: true });
    try {
        const page = await browser.newPage({ viewport: { width: 1500, height: 1100 } });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(process.env.GALLERY_QA_URL || 'http://127.0.0.1:8191');
        await page.getByRole('tab', { name: 'Gallery workspace', exact: true }).click();
        const panel = page.locator('[data-panel-key="prompt-rules"]');
        const title = 'Injury and gore filter', id = 'stock-injury-gore-filter';
        const open = async (mode) => {
            await page.evaluate(() => window.dispatchEvent(new CustomEvent('gallery-rules-open')));
            await panel.getByRole('combobox', { name: 'Edit ruleset' }).fill(title);
            await page.getByText(title + ' · ' + mode, { exact: true }).last().click();
        };
        const mode = label => panel.getByLabel('Ruleset availability').getByText(label, { exact: true }).click();
        const save = async () => {
            const response = page.waitForResponse(r => r.url().endsWith('/Gallery/rulesets') && r.request().method() === 'POST');
            await panel.getByRole('button', { name: 'Save rules library', exact: true }).click();
            assert.equal((await response).status(), 200);
            await panel.locator('button[aria-label="Save rules library"]:disabled').waitFor();
            await panel.getByRole('button', { name: 'Close', exact: true }).click();
        };
        const cardName = 'Ruleset box ' + title;
        await open('On demand');
        await mode('Global');
        const configured = panel.getByRole('group', { name: cardName });
        await configured.getByLabel('Gore and body horror', { exact: true }).selectOption('omit');
        const coverage = panel.getByLabel('Ruleset tag coverage', { exact: true }).first();
        await coverage.locator(':scope > summary').click();
        await coverage.getByLabel('Rule tag group', { exact: true }).selectOption(JSON.stringify(['gore', 'omit', 0]));
        await coverage.getByLabel('Search ruleset tags', { exact: true }).fill('gore');
        await coverage.getByRole('button', { name: 'Allow gore', exact: true }).click();
        await coverage.getByLabel('Block another tag', { exact: true }).fill('fog');
        await coverage.getByLabel('Block another tag', { exact: true }).press('Enter');
        await save();
        await open('Global');
        const saved = await page.evaluate(async () => (await (await fetch('/Gallery/rulesets')).json()).library);
        const goreRule = saved.globals.find(box => box.definition.id === 'stock-injury-gore-filter')
            .definition.choices.find(choice => choice.id === 'gore').options.find(option => option.id === 'omit').rules[0];
        assert(goreRule.except_tags.includes('gore'));
        assert(goreRule.tags.includes('fog'));
        await panel.getByRole('button', { name: 'Close', exact: true }).click();
        await page.evaluate(() => {
            const host = document.createElement('div');
            host.id = 'qa-rule-modes';
            host.style.cssText = 'position:fixed;left:20px;top:20px;width:500px;max-height:95vh;overflow:auto;z-index:2500;background:#222;color:white';
            document.body.append(host);
            const encoder = {
                comfyClass: 'GalleryPromptEncode', widgets: [{ name: 'text', value: 'portrait, gore, fog' }, { name: 'source_mode', value: 'after' }],
                inputs: [{ name: 'source_text', link: null }], properties: {}, setDirtyCanvas() {},
                addWidget(type, name, value, callback) { this.widgets.push({ type, name, value, callback }); },
                addDOMWidget(name, type, element) { host.append(element); return { name, type }; },
            };
            window.comfyAPI.app.app.graph.add(encoder);
            window.qaExtension.nodeCreated(encoder);
            window.qaRuleModes = encoder;
        });
        const encoder = page.locator('#qa-rule-modes');
        const rules = () => page.evaluate(async () => JSON.parse(await window.qaRuleModes.widgets.find(w => w.name === 'rules_state').serializeValue()));
        await encoder.locator('[data-rule-omitted="true"]').first().waitFor();
        assert.equal(await encoder.getByRole('group', { name: cardName }).count(), 0);
        assert.equal((await rules()).find(box => box.definition.id === id).preferences.gore, 'omit');
        assert.equal(await encoder.locator('[data-rule-omitted="true"]').count(), 1);
        await encoder.getByLabel('Add ruleset', { exact: true }).selectOption(id);
        const local = encoder.getByRole('group', { name: cardName });
        const localCoverage = local.getByLabel('Ruleset tag coverage', { exact: true });
        await localCoverage.locator(':scope > summary').click();
        await localCoverage.getByLabel('Rule tag group', { exact: true }).selectOption(JSON.stringify(['gore', 'omit', 0]));
        await localCoverage.getByLabel('Search ruleset tags', { exact: true }).fill('gore');
        await localCoverage.getByRole('button', { name: 'Block gore', exact: true }).click();
        await page.waitForFunction(() => document.querySelectorAll('#qa-rule-modes [data-rule-omitted="true"]').length === 2);
        await local.getByLabel('Gore and body horror', { exact: true }).selectOption('keep');
        await encoder.locator('[data-rule-omitted="true"]').first().waitFor({ state: 'detached' });

        await open('Global');
        await mode('Disabled');
        await save();
        await local.waitFor({ state: 'detached' });
        assert.equal((await rules()).some(box => box.definition.id === id), false);
        assert.equal(await encoder.getByLabel('Add ruleset', { exact: true }).locator('option[value="' + id + '"]').count(), 0);

        await open('Disabled');
        await mode('On demand');
        await save();
        await local.waitFor();
        assert.deepEqual((await rules()).filter(box => box.definition.id === id).map(box => box.origin), ['encoder']);
        assert.deepEqual(errors, []);
        console.log('PASS: saved tag exceptions, additional blocked tags, encoder overrides, and global/on-demand/disabled modes.');
    } finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
