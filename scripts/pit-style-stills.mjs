// D3 look mocks for Dom (Lead, 2026-09-30): the three Pit room dressings (src/pit/styles.ts) as stills at 375×812, each in the rack, trophy
// and gate poses of the `?look=pit` look test, plus v1 for the side-by-side. Stills only; nothing is merged for them. Seeded guest fighter.
//   node scripts/pit-style-stills.mjs [a b c]      stills: artifacts/pit/styles/<style>-<pose>-375.png + receipt.json
import { chromium } from 'playwright';
import { build, preview } from 'vite';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const styles = process.argv.slice(2).length ? process.argv.slice(2) : ['v1', 'a', 'b', 'c'];
const outDir = 'artifacts/pit/build', out = 'artifacts/pit/styles';
await fs.mkdir(out, { recursive: true });
await build({ logLevel: 'error', build: { outDir } });
const server = await preview({ build: { outDir }, preview: { host: '127.0.0.1', port: 0 } });
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
const loot = {
  owned: ['knight.Helmet', 'knight.Body', 'veteran.Helmet', 'nightborn.Helmet', 'dwarf.Helmet', 'goblin.Helmet', 'pitborn.Arms', 'witch.Helmet', 'shieldmaiden.Shield', 'goblin.Boots'],
  equipped: { head: 'knight.Helmet', chest: 'knight.Body' },
  taken: {
    'veteran.Helmet': { opponent: 'veteran', attempt: 2, healthLeft: 40, recordId: null, day: '2026-09-28', tier: 7 },
    'nightborn.Helmet': { opponent: 'nightborn', attempt: 1, healthLeft: 12, recordId: null, day: '2026-09-27', tier: 5 },
    'dwarf.Helmet': { opponent: 'dwarf', attempt: 3, healthLeft: 60, recordId: null, day: '2026-09-29', tier: 4 },
  },
};
const profile = { version: 1, id: 'pit-style-fighter-0001', name: 'Wanderer', career: { victoryMarks: 30 }, loot };
const receipt = { origin, profile: 'seeded guest fighter, not Dom\'s device', engine: 'Chromium (Playwright), 375x812 touch', stills: [], draws: {}, errors: [] };
// PIT_GL=swiftshader: the VPS capture queue has no GPU (Auditer, 2026-09-30); a look test is fine on SwiftShader, ~5x slower.
const args = process.env.PIT_GL === 'swiftshader' ? ['--use-angle=swiftshader', '--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] : [];
const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath(), args });
try {
  for (const style of styles) for (const pose of ['rack', 'trophies', 'gate']) {
    const context = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await context.addInitScript((p) => { localStorage.setItem('frankendom.fighter.v1', JSON.stringify(p)); }, profile);
    const page = await context.newPage();
    page.on('pageerror', (e) => receipt.errors.push(`${style}/${pose}: ${e.message}`));
    await page.goto(`${origin}/?look=pit&pose=${pose}${style === 'v1' ? '' : `&style=${style}`}&debug=1`);
    await page.waitForFunction(() => document.body.dataset.pit === 'look', null, { timeout: 120000 });
    await page.waitForTimeout(5000);   // the pieces land and the lights settle
    const path = `${out}/${style}-${pose}-375.png`; await page.screenshot({ path }); receipt.stills.push(path);
    if (pose === 'rack') receipt.draws[style] = await page.evaluate(() => { const v = globalThis.__view; v.pitStage(() => ({ owned: [], equipped: {} })).draw(); return v.renderer.info.render.calls; });
    await context.close();
  }
} finally {
  await fs.writeFile(`${out}/receipt.json`, JSON.stringify(receipt, null, 2));
  await browser.close(); server.httpServer.close();
}
assert.deepEqual(receipt.errors, [], 'no page errors');
console.log(`pit-style-stills PASS: draws per style ${JSON.stringify(receipt.draws)}; stills: ${receipt.stills.length}`);
