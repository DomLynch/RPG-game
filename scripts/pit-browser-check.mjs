// The Pit in the built game (docs/pit-design.md §5, §7; PR3 #1122), Chromium at 375x812 touch, a seeded guest fighter with gear (not
// Dom's device). Two parts:
//  1. Memory row: open and close the Pit ten times on one page (?debug's __pit hook, no fight needed) and assert the GPU's live
//     geometries, textures and programs after the tenth visit equal those after the first: repeated visits allocate nothing.
//  2. Stills at 375: the look poses (rack, trophies, gate) and the walking Pit after a win: arrival, walked to the rack, the rack sheet,
//     a Wear tap, walked to the gate, the gate sheet. Plus what sits at the hero's left shoulder (Lead's white quad on the look stills).
//   node scripts/pit-browser-check.mjs        receipt + stills: artifacts/pit/
import { chromium } from 'playwright';
import { build, preview } from 'vite';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const outDir = 'artifacts/pit/build', out = 'artifacts/pit';
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
const profile = { version: 1, id: 'pit-check-fighter-0001', name: 'Wanderer', career: { victoryMarks: 30 }, loot };
const receipt = { origin, profile: 'seeded guest fighter, not Dom\'s device', engine: 'Chromium (Playwright), 375x812 touch', memory: [], stills: [], errors: [] };
// PIT_GL=swiftshader: the VPS capture queue has no GPU (Auditer, 2026-09-30); the look is fine on SwiftShader, ~5x slower.
const args = process.env.PIT_GL === 'swiftshader' ? ['--use-angle=swiftshader', '--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] : [];
const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath(), args });
const page = async (query) => {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await context.addInitScript((p) => { localStorage.setItem('frankendom.fighter.v1', JSON.stringify(p)); }, profile);
  const p = await context.newPage();
  p.on('pageerror', (e) => receipt.errors.push(`${query}: ${e.message}`));
  await p.goto(`${origin}/${query}`);
  return p;
};
const still = async (p, name) => { const path = `${out}/${name}.png`; await p.screenshot({ path }); receipt.stills.push(path); };
try {
  // 1. The memory row. PIT_MEMORY_ROW=skip is for the GPU-less VPS look box only (2026-09-30: on SwiftShader the renderer's geometry count
  // steps once by 9, off-scene and at a random visit, on trunk a570b54e as on the branch, and a 12-visit probe with no step named nothing);
  // the row stays the Mac gate's. The stills and the flow still run.
  const p = await page('?debug=1');
  await p.waitForFunction(() => document.querySelector('#art-status')?.textContent === '' && !!globalThis.__pit, null, { timeout: 120000 });
  // Into the arena first, as a player is: main.ts paused() (the welcome card) gates the canvas drag the look reads.
  if (await p.locator('#welcome').isVisible()) await p.getByRole('button', { name: 'Enter the arena' }).tap();
  await p.waitForFunction(() => document.querySelector('#welcome').hidden);
  const visits = process.env.PIT_MEMORY_ROW === 'skip' ? 0 : 10;
  if (!visits) receipt.memoryRow = 'SKIPPED (PIT_MEMORY_ROW=skip: the VPS look box)';
  for (let visit = 1; visit <= visits; visit++) {
    await p.evaluate((v) => globalThis.__pit.open(v % 2 ? 'win' : 'defeat'), visit);   // settles once the pieces are placed (main.ts __pit)
    await p.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(done)))));   // and drawn
    await p.waitForTimeout(600);
    receipt.memory.push({ visit, open: await p.evaluate(() => globalThis.__pit.memory()) });
    await p.evaluate(() => globalThis.__pit.close());
    await p.waitForTimeout(500);   // a few fight frames draw with the arena back
    receipt.memory.at(-1).closed = await p.evaluate(() => globalThis.__pit.memory());
  }
  // Visit 1 is the warm-up: its closed sample is the first fight frames after a visit, still allocating, so the baseline is visit 2 and
  // every later visit must equal it (a leak grows per visit; a warm-up does not). The open samples wait for the pieces (above), so the
  // +9 step seen at a random visit on a slow box (2026-09-30: the Mac at load 15, the VPS on SwiftShader) is not sampled any more.
  const first = receipt.memory[1];
  if (visits) for (const m of receipt.memory.slice(2)) for (const key of ['geometries', 'textures', 'programs']) {
    assert.equal(m.open[key], first.open[key], `${key} with the Pit open: visit ${m.visit} ${m.open[key]} vs visit 2 ${first.open[key]}`);
    assert.equal(m.closed[key], first.closed[key], `${key} after leaving: visit ${m.visit} ${m.closed[key]} vs visit 2 ${first.closed[key]}`);
  }
  // 2. The walking Pit after a win: arrival, the walk to the rack, a Wear, the walk to the gate.
  await p.evaluate(() => globalThis.__pit.open('win'));
  await p.waitForTimeout(2000);
  await still(p, 'walk-1-arrival');
  const hold = async (key, ms) => { await p.keyboard.down(key); await p.waitForTimeout(ms); await p.keyboard.up(key); await p.waitForTimeout(900); };
  await p.locator('#world').focus();
  await hold('KeyA', 1600);
  await still(p, 'walk-2-rack');
  // The right-finger look: a drag on the canvas turns the camera round him (a half-screen drag ≈ 0.9 rad), and the room stays whole.
  const before = await p.evaluate(() => globalThis.__view.pitStage(() => ({ owned: [], equipped: {} })).camera.position.toArray());
  await p.mouse.move(300, 300); await p.mouse.down(); for (let i = 1; i <= 12; i++) { await p.mouse.move(300 - i * 15, 300 - i * 4); await p.waitForTimeout(30); } await p.mouse.up();
  await p.waitForTimeout(900);
  receipt.look = { before, after: await p.evaluate(() => globalThis.__view.pitStage(() => ({ owned: [], equipped: {} })).camera.position.toArray()) };
  await still(p, 'walk-2b-look');
  receipt.joystick = await p.evaluate(() => getComputedStyle(document.getElementById('joystick')).visibility);   // shown: it is how he walks
  receipt.rackSheet = await p.evaluate(() => ({ shown: !document.getElementById('pit-ui')?.hidden, title: document.querySelector('#pit-ui h2')?.textContent, rows: document.querySelectorAll('#pit-ui [data-wear]').length }));
  const wear = p.locator('#pit-ui [data-wear]').filter({ hasText: 'Wear' }).first();
  if (await wear.count()) { receipt.wore = await wear.getAttribute('data-wear'); await wear.click(); await p.waitForTimeout(1500); }
  await still(p, 'walk-3-worn');
  await hold('KeyD', 1600); await hold('KeyW', 1500);
  await still(p, 'walk-4-gate');
  receipt.gateSheet = await p.evaluate(() => ({ title: document.querySelector('#pit-ui h2')?.textContent, button: document.querySelector('#pit-ui .pit-go')?.textContent }));
  await p.evaluate(() => globalThis.__pit.close());
  // The look poses, and what is at the hero's left shoulder.
  for (const pose of ['rack', 'trophies', 'gate']) {
    const look = await page(`?look=pit&pose=${pose}&debug=1`);
    await look.waitForFunction(() => document.body.dataset.pit === 'look', null, { timeout: 120000 });
    await look.waitForTimeout(5000);
    await still(look, `look-${pose}`);
    if (pose === 'rack') receipt.shoulder = await look.evaluate(() => {
      const view = globalThis.__view, scene = view?.pitStage?.(() => ({ owned: [], equipped: {} })).scene;
      const names = [];
      scene?.traverse((o) => { if (o.isMesh && o.visible && /sheath|scabbard|shield|cloth|cape|quad|plane/i.test(`${o.name} ${o.material?.name ?? ''}`)) names.push(`${o.name}|${o.material?.name ?? ''}|${o.parent?.name ?? ''}`); });
      return names.slice(0, 40);
    });
    await look.context().close();
  }
} finally {
  await fs.writeFile(`${out}/receipt.json`, JSON.stringify(receipt, null, 2));
  await browser.close(); server.httpServer.close();
}
assert.ok(Math.hypot(receipt.look.after[0] - receipt.look.before[0], receipt.look.after[2] - receipt.look.before[2]) > 0.5, `the drag turned the camera: ${JSON.stringify(receipt.look)}`);
assert.deepEqual(receipt.errors, [], 'no page errors');
console.log(`pit-browser-check PASS: ${receipt.memoryRow ?? `memory flat over visits 2-10 (${JSON.stringify(receipt.memory[1].open)}; warm-up visit 1 ${JSON.stringify(receipt.memory[0].open)})`}; stills: ${receipt.stills.join(', ')}`);
