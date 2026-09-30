// In-room stills of GPT's Pit dressing and gate machinery (public/pit/extra/, World's intake #3) for Dom and the Pit lane: the `?look=pit` poses at
// 375x812, each twice, without and with the extras dropped into the room at the placements below (this harness's own; the Pit lane places them
// for real). A dev server, not a build: the page imports three's GLTFLoader from /node_modules to load the GLBs whole (the game's prop() keeps only a
// GLB's first mesh, and the machinery is nine nodes). Runs on the GPU-less VPS stills box with PIT_GL=swiftshader, through the capture lock.
//   PIT_GL=swiftshader node scripts/pit-extra-stills.mjs      stills: artifacts/pit/extra/<pose>-{before,after}.png (PIT_EXTRA_OUT moves the folder)
/* global process, console, document, localStorage */
import { chromium } from 'playwright';
import { createServer } from 'vite';
import fs from 'node:fs/promises';

const out = process.env.PIT_EXTRA_OUT || 'artifacts/pit/extra';
await fs.mkdir(out, { recursive: true });
// optimizeDeps.include: the loader's imports are bundled up front, or vite finds them mid-run and reloads the page under the script.
const server = await createServer({ logLevel: 'error', server: { host: '127.0.0.1', port: 0 }, optimizeDeps: { include: ['three/examples/jsm/loaders/GLTFLoader.js', 'three/examples/jsm/libs/meshopt_decoder.module.js'] } });
await server.listen();
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
// The room is 8 x 6 (x -4..4, z -3..3), the gate in the far wall (z -3) 2.2 wide, the rack on the left wall, the table and trophies on the right.
// [file, x, z, rotation.y]: floor-centred origins, metres, Y-up; the machinery sits in gate-base coordinates (the gate's own origin, in its wall opening).
const PLACEMENTS = [
  ['coal-brazier', -1.25, -1.9, 0], ['chained-manacles', 1.3, -2.85, 0], ['whetstone-wheel', -3.3, -1.4, Math.PI / 2], ['broken-weapons', -2.9, 0.9, 0.4],
  ['straw-bedding', 3.0, -0.9, -Math.PI / 2], ['water-bucket', -1.4, -1.1, 0], ['gate-machinery', 0, -3, 0],
];
// One piece alone in front of the gate pose's camera (x, z, rotation.y), so each can be judged at the Pit camera wherever the room puts it.
const SOLO = { 'coal-brazier': [0.3, 0.3, 0.5], 'chained-manacles': [0.3, 0.3, 0.5], 'whetstone-wheel': [0.3, 0.3, 0.5], 'broken-weapons': [0.3, 0.6, 0.5], 'straw-bedding': [0.3, 0.6, 0.3], 'water-bucket': [0.3, 0.3, 0.5] };
const profile = { version: 1, id: 'pit-extra-fighter-0001', name: 'Wanderer', career: { victoryMarks: 30 }, loot: { owned: ['knight.Helmet', 'knight.Body'], equipped: { head: 'knight.Helmet', chest: 'knight.Body' } } };
const args = process.env.PIT_GL === 'swiftshader' ? ['--use-angle=swiftshader', '--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] : [];
const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath(), args });
const errors = [], shots = [];
try {
  for (const pose of ['rack', 'trophies', 'gate']) {
    const context = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await context.addInitScript((p) => { localStorage.setItem('frankendom.fighter.v1', JSON.stringify(p)); }, profile);
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(`${pose}: ${e.message}`));
    await page.goto(`${origin}/?look=pit&pose=${pose}&debug=1`);
    await page.waitForFunction(() => document.body.dataset.pit === 'look', null, { timeout: 600000 });
    await page.evaluate(() => globalThis.__pit.ready?.());
    await page.waitForTimeout(2000);
    for (const phase of ['before', 'after']) {
      if (phase === 'after') {
        const place = () => page.evaluate(async (placements) => {
          const { loadExtra } = await import('/scripts/lib/pit-extra-loader.mjs');
          const scene = globalThis.__view.pitStage(() => ({ owned: [], equipped: {} })).scene, names = [];
          for (const [file, x, z, ry] of placements) {
            const model = await loadExtra(file);
            model.name = `extra ${file}`; model.position.set(x, 0, z); model.rotation.y = ry;
            model.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
            scene.add(model); names.push(file);
          }
          return names;
        }, PLACEMENTS);
        const added = await place().catch(async () => {   // a reload under us (a late dependency optimisation): wait for the room again, once
          await page.waitForFunction(() => document.body.dataset.pit === 'look', null, { timeout: 600000 }); await page.evaluate(() => globalThis.__pit.ready?.()); await page.waitForTimeout(2000);
          return place();
        });
        console.log(`${pose}: placed ${added.join(', ')}`);
        await page.waitForTimeout(2500);
      }
      const path = `${out}/${pose}-${phase}.png`; await page.screenshot({ path }); shots.push(path);
    }
    if (pose === 'gate') {   // each piece alone, in front of the hero at the gate camera
      await page.evaluate(() => { for (const o of globalThis.__view.pitStage(() => ({ owned: [], equipped: {} })).scene.children.filter((c) => c.name.startsWith('extra '))) o.removeFromParent(); });
      for (const [file, [x, z, ry]] of Object.entries(SOLO)) {
        await page.evaluate(async ([name, at]) => {
          const { loadExtra } = await import('/scripts/lib/pit-extra-loader.mjs'), model = await loadExtra(name);
          model.name = `extra solo ${name}`; model.position.set(at[0], 0, at[1]); model.rotation.y = at[2];
          model.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
          globalThis.__view.pitStage(() => ({ owned: [], equipped: {} })).scene.add(model);
        }, [file, [x, z, ry]]);
        await page.waitForTimeout(1500);
        const path = `${out}/solo-${file}.png`; await page.screenshot({ path }); shots.push(path);
        await page.evaluate((name) => globalThis.__view.pitStage(() => ({ owned: [], equipped: {} })).scene.getObjectByName(`extra solo ${name}`)?.removeFromParent(), file);
      }
    }
    await context.close();
  }
} finally {
  await fs.writeFile(`${out}/receipt.json`, JSON.stringify({ origin, placements: PLACEMENTS, shots, errors, engine: 'Chromium (Playwright), 375x812 touch, dev server' }, null, 2));
  await browser.close(); await server.close();
}
if (errors.length) throw new Error(`page errors: ${errors.join('; ')}`);
console.log(`pit-extra-stills: ${shots.length} stills in ${out}`);
