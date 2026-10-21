import { chromium } from 'playwright';
import fs from 'node:fs';
const root = process.cwd() + '/artifacts/camp-front/';
const html = `<body style="margin:0;background:#111;font:600 38px -apple-system,sans-serif;color:#fff"><div style="display:flex;gap:20px;padding:20px;width:1540px">
<div><div style="padding:0 0 12px">this PR (camp-dress 689a1c2a3)</div><img src="m6-a1.png" width="750"></div>
<div><div style="padding:0 0 12px">sandbox (zone 90, 5da7b0388)</div><img src="sbx2/sbx-a1.png" width="750"></div></div></body>`;
fs.writeFileSync(root + 'compose.html', html);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1580, height: 1780 } });
await page.goto('file://' + root + 'compose.html'); await page.waitForTimeout(1500);
await page.screenshot({ path: root + 'camp-goblin-front-vs-sandbox.png', fullPage: true });
process.exit(0);
