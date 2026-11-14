const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');

(async () => {
    const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, headless: true });
    try {
        const page = await browser.newPage({ viewport: { width: 1500, height: 1100 } });
        const errors = [], removed = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('**/Gallery/delete', async route => {
            removed.push(route.request().postDataJSON().image_path);
            await route.fulfill({ json: {} });
        });
        await page.goto(process.env.GALLERY_QA_URL || 'http://127.0.0.1:8191');
        await page.getByRole('tab', { name: 'Gallery workspace', exact: true }).click();
        for (const name of ['study-2.png', 'study-3.png']) {
            await page.getByRole('checkbox', { name: 'Select ' + name, exact: true }).check();
        }
        await page.getByRole('button', { name: 'Workflow', exact: true }).click();
        await page.evaluate(() => {
            const host = document.createElement('div');
            host.style.cssText = 'position:fixed;left:0;top:64px;width:280px;height:900px;z-index:2000';
            document.body.append(host);
            window.qaSidebar.render(host);
            window.qaListeners.executed({ detail: { output: { images: [
                { filename: 'study-1.png', type: 'output' },
                { filename: 'study-2.png', type: 'output' },
            ] } } });
        });
        const pane = page.getByRole('region', { name: 'Gallery assets', exact: true });
        await pane.getByRole('button', { name: 'View study-2.png', exact: true }).click();
        const viewer = page.locator('[data-panel-key="workflow-viewer"]');
        await viewer.getByAltText('Viewing study-2.png').waitFor();
        assert.equal(await viewer.getByRole('checkbox', { name: 'Selected', exact: true }).isChecked(), false);
        await viewer.getByRole('button', { name: 'Delete', exact: true }).click();
        const confirmation = page.getByRole('dialog', { name: 'Delete 1 local file(s)?', exact: true });
        await confirmation.getByRole('button', { name: 'Delete permanently', exact: true }).click();
        await viewer.getByAltText('Viewing study-1.png').waitFor();
        await pane.getByRole('button', { name: 'View study-2.png', exact: true }).waitFor({ state: 'detached' });
        assert.deepEqual(removed, ['/static_gallery/study-2.png']);
        assert.equal(await viewer.getByRole('button', { name: 'View study-2.png', exact: true }).count(), 0);
        await viewer.getByRole('button', { name: 'Delete', exact: true }).click();
        await confirmation.getByRole('button', { name: 'Delete permanently', exact: true }).click();
        await viewer.waitFor({ state: 'detached' });
        await confirmation.waitFor({ state: 'hidden' });
        await pane.getByRole('button', { name: 'View study-1.png', exact: true }).waitFor({ state: 'detached' });
        await page.getByRole('tab', { name: 'Gallery workspace', exact: true }).click();
        await page.getByRole('checkbox', { name: 'Select study-3.png', exact: true }).waitFor();
        assert.equal(await page.getByRole('checkbox', { name: 'Select study-3.png', exact: true }).isChecked(), true);
        assert.deepEqual(removed, ['/static_gallery/study-2.png', '/static_gallery/study-1.png']);
        assert.deepEqual(errors, []);
        console.log('PASS: detached deletion isolates workspace selection, advances, removes session cards, and closes on the final image.');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
