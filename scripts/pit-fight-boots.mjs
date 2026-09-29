// The fight rig wearing goblin.Boots at the fight camera, 375×812 (Lead's #1122 ask): the rack's material fix moved wear()'s Wrap swap into
// characters.ts rigMaterials/sourceMaterial, so the worn boots must read exactly as before in a fight. Run it on this tree and on the live
// site (trunk) and compare the two stills. A guest ledger is seeded (worn-loot-check.mjs's way: `equipped` by paperdoll key), nothing sent.
//   node scripts/pit-fight-boots.mjs                               this tree's build → artifacts/pit/boots/fight-boots-tree.png
//   QA_URL=https://frankendom.com node scripts/pit-fight-boots.mjs  the live site  → artifacts/pit/boots/fight-boots-live.png
import { chromium } from 'playwright';
import { build, preview } from 'vite';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const out = 'artifacts/pit/boots', live = !!process.env.QA_URL;
await fs.mkdir(out, { recursive: true });
let server = null;
if (!live) { await build({ logLevel: 'error', build: { outDir: 'artifacts/pit/build' } }); server = await preview({ build: { outDir: 'artifacts/pit/build' }, preview: { host: '127.0.0.1', port: 0 } }); }
const origin = process.env.QA_URL || `http://127.0.0.1:${server.httpServer.address().port}`;
const profile = { version: 1, id: 'pit-boots-fighter-0001', name: 'Wanderer', career: { victoryMarks: 5 }, loot: { owned: ['goblin.Boots'], equipped: { feet: 'goblin.Boots' } } };
const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
const errors = [];
try {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await context.addInitScript((p) => { localStorage.setItem('frankendom.fighter.v1', JSON.stringify(p)); }, profile);
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/*sentry.io/**', (r) => r.abort());
  await page.goto(`${origin}/?opponent=veteran&debug=1`);
  await page.waitForFunction(() => document.querySelector('#art-status')?.textContent === '' && document.querySelector('#attack-button')?.getAttribute('aria-disabled') === 'false', null, { timeout: 120000 });
  await page.waitForFunction(() => (JSON.parse(document.querySelector('#debug').dataset.worn || '{}').worn ?? []).some((w) => w.startsWith('goblin.Boots') && !w.endsWith('(hidden)')), null, { timeout: 60000 });
  if (await page.locator('#welcome').isVisible()) await page.getByRole('button', { name: 'Enter the arena' }).tap();
  await page.waitForTimeout(1500);
  const worn = await page.evaluate(() => JSON.parse(document.querySelector('#debug').dataset.worn).worn);
  const path = `${out}/fight-boots-${live ? 'live' : 'tree'}.png`;
  await page.screenshot({ path });
  assert.deepEqual(errors, [], 'no page errors');
  console.log(`pit-fight-boots PASS (${origin}): worn ${JSON.stringify(worn)}; still ${path}`);
} finally {
  await browser.close(); server?.httpServer.close();
}
