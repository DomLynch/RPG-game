// The fight rig wearing goblin.Boots at the fight camera, 375×812 (Lead's #1122 ask): the rack's material fix moved wear()'s Wrap swap into
// characters.ts rigMaterials/sourceMaterial, so the worn boots must read exactly as before in a fight. Run it on this tree and on a local
// build of trunk (never the live site: automated checks write nothing to production) and compare the two stills. A guest ledger is seeded
// (worn-loot-check.mjs's way: `equipped` by paperdoll key), nothing sent.
//   node scripts/pit-fight-boots.mjs                                  this tree   → artifacts/pit/boots/fight-boots-tree.png
//   BOOTS_ROOT=<trunk checkout> BOOTS_LABEL=trunk node scripts/pit-fight-boots.mjs  → artifacts/pit/boots/fight-boots-trunk.png
import { chromium } from 'playwright';
import { build, preview } from 'vite';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const out = 'artifacts/pit/boots', root = path.resolve(process.env.BOOTS_ROOT ?? '.'), label = process.env.BOOTS_LABEL ?? 'tree';
const outDir = path.resolve(`artifacts/pit/build-${label}`);
await fs.mkdir(out, { recursive: true });
await build({ root, logLevel: 'error', build: { outDir, emptyOutDir: true } });
const server = await preview({ root, build: { outDir }, preview: { host: '127.0.0.1', port: 0 } });
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
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
  await page.waitForFunction(() => (JSON.parse(document.querySelector('#debug').dataset.worn || '{}').worn ?? []).some((w) => w.startsWith('goblinBoots') && !w.endsWith('(hidden)')), null, { timeout: 60000 });
  if (await page.locator('#welcome').isVisible()) await page.getByRole('button', { name: 'Enter the arena' }).tap();
  await page.waitForTimeout(1500);
  const worn = await page.evaluate(() => JSON.parse(document.querySelector('#debug').dataset.worn).worn);
  const still = `${out}/fight-boots-${label}.png`;
  await page.screenshot({ path: still });
  assert.deepEqual(errors, [], 'no page errors');
  console.log(`pit-fight-boots PASS (${origin}): worn ${JSON.stringify(worn)}; still ${still}`);
} finally {
  await browser.close(); server.httpServer.close();
}
