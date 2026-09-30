// Web's `?look=pit-stone` look test (Lead 2026-09-30): before (`?look=pit`) and after (`?look=pit-stone`) stills at the gate and the trophy
// wall, 375×812, the same seeded guest fighter and framing as pit-look-stills.mjs; then the stone maps' generation time with the CPU
// throttled 4× (the phone tier) and their GPU bytes. Runs on the VPS capture queue with PIT_GL=swiftshader.
//   node scripts/pit-stone-stills.mjs      stills: artifacts/pit/stone/<look>-<pose>-375.png + receipt.json
import { chromium } from 'playwright';
import { build, preview } from 'vite';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import fs from 'node:fs/promises';

const outDir = 'artifacts/pit/build', out = 'artifacts/pit/stone';
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
};
const profile = { version: 1, id: 'pit-look-fighter-0001', name: 'Wanderer', career: { victoryMarks: 30 }, loot };
const head = execSync('git rev-parse --short=8 HEAD').toString().trim();
const receipt = { head, origin, profile: 'seeded guest fighter', engine: `Chromium (Playwright), 375x812 touch, ${process.env.PIT_GL ?? 'gpu'}`, stills: [], stone: {}, errors: [] };
const args = process.env.PIT_GL === 'swiftshader' ? ['--use-angle=swiftshader', '--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] : [];
const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath(), args });
async function open(look, pose, throttle = 1) {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await context.addInitScript((p) => { localStorage.setItem('frankendom.fighter.v1', JSON.stringify(p)); }, profile);
  const page = await context.newPage();
  page.on('pageerror', (e) => receipt.errors.push(`${look}/${pose}: ${e.message}`));
  if (throttle > 1) await (await context.newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: throttle });
  await page.goto(`${origin}/?look=${look}&pose=${pose}&debug=1`);
  await page.waitForFunction(() => document.body.dataset.pit === 'look', null, { timeout: 180000 });
  if (look.startsWith('pit-stone')) await page.waitForFunction(() => globalThis.__pitStone, null, { timeout: 180000 });
  return { context, page };
}
try {
  for (const pose of ['gate', 'trophies', 'vault']) for (const look of ['pit', 'pit-stone', 'pit-stone-proc', 'pit-stone-sand']) {
    const { context, page } = await open(look, pose);
    await page.waitForTimeout(5000);   // the pieces land and the lights settle
    const path = `${out}/${look}-${pose}-375.png`; await page.screenshot({ path }); receipt.stills.push(path);
    if (look === 'pit-stone' && pose === 'gate') receipt.stone.unthrottled = await page.evaluate(() => globalThis.__pitStone);
    await context.close();
  }
  // The phone tier: the worker's generation time with the CPU throttled 4× (CDP throttles the page's workers too).
  const { context, page } = await open('pit-stone', 'gate', 4);
  receipt.stone.throttled4x = await page.evaluate(() => globalThis.__pitStone);
  await context.close();
} finally {
  await fs.writeFile(`${out}/receipt.json`, JSON.stringify(receipt, null, 2));
  await browser.close(); server.httpServer.close();
}
assert.deepEqual(receipt.errors, [], 'no page errors');
console.log(`pit-stone-stills PASS at ${head}: ${JSON.stringify(receipt.stone)}; stills: ${receipt.stills.length}`);
