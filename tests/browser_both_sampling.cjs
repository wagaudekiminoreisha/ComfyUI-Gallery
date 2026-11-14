const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');

(async () => {
    const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, headless: true });
    try {
        for (const mode of ['Both', 'Hydrus']) {
        const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
        const searches = [], errors = [];
        let releaseSettings;
        const settingsReady = new Promise(resolve => { releaseSettings = resolve; });
        await page.route('**/Gallery/hydrus/settings', async route => { await settingsReady; await route.continue(); });
        let sequence = 0;
        page.on('pageerror', error => errors.push(error.message));
        await page.route('**/Gallery/hydrus/search', async route => {
            const query = route.request().postDataJSON();
            searches.push(query);
            const offset = query.offset || 0, limit = query.limit || 100;
            const search = offset ? Number(query.search_id) : ++sequence;
            const ids = Array.from({ length: Math.min(limit, 235 - offset) }, (_, index) => search * 1000 + offset + index);
            await route.fulfill({ json: { items: ids.map(id => ({
                hash: id.toString(16).padStart(64, '0'), file_id: id, mime: 'image/png',
            })), total: 235, offset, limit, search_id: String(search), next_offset: offset + limit < 235 ? offset + limit : null } });
        });
        await page.goto(process.env.GALLERY_QA_URL || 'http://127.0.0.1:8191');
        await page.getByRole('tab', { name: 'Gallery workspace', exact: true }).click();
        await page.locator('.cg-header').getByText(mode, { exact: true }).click();
        assert.equal(await page.getByRole('button', { name: 'Search', exact: true }).isDisabled(), true, mode + ' waits for initial settings');
        releaseSettings();
        await page.waitForResponse(response => response.url().endsWith('/Gallery/hydrus/settings'));
        await page.getByRole('combobox', { name: 'Gallery order', exact: true }).press('ArrowDown');
        await page.getByTitle('Random', { exact: true }).click();
        const search = page.getByRole('button', { name: 'Search', exact: true });
        await search.click();
        await page.getByText('100 of 235 files loaded', { exact: true }).waitFor();
        assert.equal(searches[0].file_sort_type, 4);
        await page.locator('.cg-header').getByText(mode === 'Both' ? 'Hydrus' : 'Both', { exact: true }).click();
        await page.locator('.cg-header').getByText(mode, { exact: true }).click();
        await page.getByText('100 of 235 files loaded', { exact: true }).waitFor();
        assert.equal(searches.length, 1);
        await page.getByRole('button', { name: 'Load more · continues when scrolling', exact: true }).dispatchEvent('click');
        await page.getByText('200 of 235 files loaded', { exact: true }).waitFor();
        assert.equal(searches[1].offset, 100);
        assert.equal(searches[1].search_id, '1');
        await search.click();
        await page.getByText('100 of 235 files loaded', { exact: true }).waitFor();
        assert.equal(searches[2].file_sort_type, 4);
        assert.equal(searches[2].search_id, undefined);
        assert.equal(searches[2].offset, undefined);
        const count = searches.length;
        await page.getByRole('button', { name: 'Reshuffle', exact: true }).click();
        assert.equal(searches.length, count);
        await page.getByRole('combobox', { name: 'Gallery order', exact: true }).press('ArrowDown');
        await page.getByTitle('Search order', { exact: true }).click();
        const response = page.waitForResponse(result => result.url().endsWith('/Gallery/hydrus/search'));
        await search.click();
        await response;
        await page.waitForFunction(() => !document.querySelector('button[aria-label="Search"]').classList.contains('ant-btn-loading'));
        await page.locator('.ant-select-selection-item[title="Search order"]').waitFor();
        assert.deepEqual(errors, []);
        console.log(`PASS: ${mode} Random resamples Hydrus on each search, freezes pagination, and reshuffles loaded images locally.`);
        await page.close();
        }
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
