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
const server = await createServer({ logLevel: 'error', server: { host: '127.0.0.1', port: 0 } });
await server.listen();
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
// The room is 8 x 6 (x -4..4, z -3..3), the gate in the far wall (z -3) 2.2 wide, the rack on the left wall, the table and trophies on the right.
// [file, x, z, rotation.y]: floor-centred origins, metres, Y-up; the machinery sits in gate-base coordinates (the gate's own origin, in its wall opening).
const PLACEMENTS = [
  ['coal-brazier', -1.85, -2.35, 0], ['chained-manacles', -2.6, -2.75, 0], ['whetstone-wheel', -3.3, -1.4, Math.PI / 2], ['broken-weapons', -3.2, 1.7, 0.4],
  ['straw-bedding', 3.0, -1.9, -Math.PI / 2], ['water-bucket', 3.3, 0.1, 0], ['gate-machinery', 0, -3, 0],
];
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
        const added = await page.evaluate(async (placements) => {
          const { GLTFLoader } = await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
          const { MeshoptDecoder } = await import('/node_modules/three/examples/jsm/libs/meshopt_decoder.module.js');
          const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder), scene = globalThis.__view.scene, names = [];
          for (const [file, x, z, ry] of placements) {
            const { scene: model } = await loader.loadAsync(`/pit/extra/${file}.glb`);
            model.name = `extra ${file}`; model.position.set(x, 0, z); model.rotation.y = ry;
            model.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
            scene.add(model); names.push(file);
          }
          return names;
        }, PLACEMENTS);
        console.log(`${pose}: placed ${added.join(', ')}`);
        await page.waitForTimeout(2500);
      }
      const path = `${out}/${pose}-${phase}.png`; await page.screenshot({ path }); shots.push(path);
    }
    await context.close();
  }
} finally {
  await fs.writeFile(`${out}/receipt.json`, JSON.stringify({ origin, placements: PLACEMENTS, shots, errors, engine: 'Chromium (Playwright), 375x812 touch, dev server' }, null, 2));
  await browser.close(); await server.close();
}
if (errors.length) throw new Error(`page errors: ${errors.join('; ')}`);
console.log(`pit-extra-stills: ${shots.length} stills in ${out}`);
