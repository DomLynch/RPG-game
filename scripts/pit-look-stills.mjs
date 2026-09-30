// The Pit room's look stills for a PR body (the visual-PR rule): the rack, trophy and gate poses of `?look=pit` at 375×812, with a seeded
// guest fighter who owns pieces, so the rack and the plinths are dressed. Runs on the GPU-less VPS look box with PIT_GL=swiftshader.
//   node scripts/pit-look-stills.mjs      stills: artifacts/pit/look/<pose>-375.png + receipt.json
import { chromium } from 'playwright';
import { build, preview } from 'vite';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const outDir = 'artifacts/pit/build', out = 'artifacts/pit/look';
await fs.mkdir(out, { recursive: true });
await build({ logLevel: 'error', build: { outDir } });
const server = await preview({ build: { outDir }, preview: { host: '127.0.0.1', port: 0 } });
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
const loot = {
  owned: ['veteran.Trident', 'goblin.Knife', 'nightborn.Estoc', 'knight.Helmet', 'knight.Body', 'veteran.Helmet', 'nightborn.Helmet', 'dwarf.Helmet', 'goblin.Helmet', 'pitborn.Arms', 'witch.Helmet', 'shieldmaiden.Shield', 'goblin.Boots'],
  equipped: { head: 'knight.Helmet', chest: 'knight.Body' },
  taken: {
    'veteran.Helmet': { opponent: 'veteran', attempt: 2, healthLeft: 40, recordId: null, day: '2026-09-28', tier: 7 },
    'nightborn.Helmet': { opponent: 'nightborn', attempt: 1, healthLeft: 12, recordId: null, day: '2026-09-27', tier: 5 },
    'dwarf.Helmet': { opponent: 'dwarf', attempt: 3, healthLeft: 60, recordId: null, day: '2026-09-29', tier: 4 },
  },
  // The skull wall (PR B): beaten legends, one per panel row and a few ranks apart. On trunk before Backend's #1156 the profile loader
  // strips this field, so the wall shows its hundred niches only; once #1156 is in, the same seed lights these slots.
  defeats: ['veteran-1', 'veteran-7', 'pitborn-3', 'goblin-10', 'nightborn-5', 'executioner-2', 'dwarf-4', 'shieldmaiden-9', 'plaguedoctor-6', 'witch-8', 'knight-1', 'knight-10'],
};
const profile = { version: 1, id: 'pit-look-fighter-0001', name: 'Wanderer', career: { victoryMarks: 30 }, loot };
const receipt = { origin, profile: 'seeded guest fighter, not Dom\'s device', engine: 'Chromium (Playwright), 375x812 touch', stills: [], draws: {}, errors: [] };
// PIT_GL=swiftshader: the VPS capture queue has no GPU (Auditer, 2026-09-30); a look test is fine on SwiftShader, ~5x slower.
const args = process.env.PIT_GL === 'swiftshader' ? ['--use-angle=swiftshader', '--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] : [];
const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath(), args });
try {
  for (const pose of ['rack', 'trophies', 'gate', 'wall']) {
    const context = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await context.addInitScript((p) => { localStorage.setItem('frankendom.fighter.v1', JSON.stringify(p)); }, profile);
    const page = await context.newPage();
    page.on('pageerror', (e) => receipt.errors.push(`${pose}: ${e.message}`));
    await page.goto(`${origin}/?look=pit&pose=${pose}&debug=1`);
    await page.waitForFunction(() => document.body.dataset.pit === 'look', null, { timeout: 120000 });
    await page.evaluate(() => globalThis.__pit.ready());   // the pieces and the props (GPT's GLBs decode slowly on a cold SwiftShader page) are placed
    await page.waitForTimeout(1500);   // the lights settle
    const path = `${out}/${pose}-375.png`; await page.screenshot({ path }); receipt.stills.push(path);
    if (pose === 'rack') receipt.draws = await page.evaluate(() => { const v = globalThis.__view; v.pitStage(() => ({ owned: [], equipped: {} })).draw(); return v.renderer.info.render.calls; });
    await context.close();
  }
} finally {
  await fs.writeFile(`${out}/receipt.json`, JSON.stringify(receipt, null, 2));
  await browser.close(); server.httpServer.close();
}
assert.deepEqual(receipt.errors, [], 'no page errors');
console.log(`pit-look-stills PASS: draws ${JSON.stringify(receipt.draws)}; stills: ${receipt.stills.length}`);
