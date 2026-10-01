// World's Pit arena stills (Lead 2026-09-30, Dom's phone test item 1): behind the Pit's gate the player sees the ARENA of his next fight, not a flat
// cream box. One baked still per arena, shot from the arena gate looking into the ring, shipped as public/pit/arena/<arena key>.webp. No new
// live scene: the Pit texture-maps a plane with the still (plane = ROOM.gate's opening + 0.4 m, 2.2 x 2.7 m since the gate's round arch narrowed the opening to 1.8 x 2.3 m, so the stills are
// 496 x 608, the same aspect) and dresses it with the light shaft, dust, parallax and shimmer in its own code.
//   node scripts/pit-arena-stills.mjs [outDir]        (default public/pit/arena; run on the VPS: SwiftShader, heavy for the shared Mac)
// The page is this repo's own buildArena() and arena-themes, lit as scene.ts lights them (theme fog, hemisphere, sun, exposure, the arena's own
// sky as the environment), the camera in the gateway at eye height. Rendered at 2x, downsampled, encoded by Chromium at the highest WebP quality
// that stays under BUDGET bytes (the whole pit/ is held to 2.5 MB gzip by check-budget.mjs).
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const out = process.argv[2] ?? 'public/pit/arena', W = 512, CW = 496, H = 608, BUDGET = 46_000;   // the frame is shot 512 wide (the framing Dom and Pit saw) and its central CW columns kept: 2.2 x 2.7 m = 496 x 608
const PAGE = `<!doctype html><html><body style="margin:0;background:#000"><script type="module">
import * as THREE from 'three';
import { buildArena, LAYOUT } from '/src/arena.ts';
import { ARENA_THEMES } from '/src/arena-themes.ts';
const W = ${W}, H = ${H}, SS = 2, BUDGET = ${BUDGET};
const canvas = document.createElement('canvas'); document.body.append(canvas);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W * SS, H * SS, false);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; renderer.toneMapping = THREE.ACESFilmicToneMapping;
const results = {};
for (const key of Object.keys(ARENA_THEMES)) {
  const theme = ARENA_THEMES[key];
  renderer.toneMappingExposure = theme.exposure;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(theme.fog); scene.fog = new THREE.FogExp2(theme.fog, theme.fogDensity);
  const arena = buildArena(scene, theme); await arena.ready;
  const pmrem = new THREE.PMREMGenerator(renderer), env = pmrem.fromEquirectangular(arena.sky); scene.environment = env.texture; scene.environmentIntensity = 1;
  scene.add(new THREE.HemisphereLight(...theme.hemisphere));
  const sun = new THREE.DirectionalLight(...theme.sun); sun.position.set(...(theme.light?.sun ?? [-15, 26, -18])); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 70 }); sun.shadow.normalBias = 0.04; scene.add(sun);
  // The gate is at angle LAYOUT.gate (PI) on the wall's inner radius, and the portcullis stands 0.45 m inside it: the camera stands just past
  // the bars on the ring side (0.3 m in from the wall's foot), eye height, looking across the ring. The Pit's own bars are drawn in front of it.
  const camera = new THREE.PerspectiveCamera(58, W / H, 0.1, 180);
  camera.position.set(0, 1.62, -(LAYOUT.wall.inner - 0.3)); camera.lookAt(0, 1.7, 0);
  for (let i = 0; i < 40; i++) arena.update(1 / 60, [], camera);   // the flames, motes and weather settle into a frame
  renderer.render(scene, camera);
  const small = document.createElement('canvas'); small.width = CW; small.height = H;
  const k = canvas.width / W;
  const g = small.getContext('2d'); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(canvas, (W - CW) / 2 * k, 0, CW * k, canvas.height, 0, 0, CW, H);
  let best = null;
  for (const q of [0.86, 0.8, 0.74, 0.68, 0.62, 0.56, 0.5, 0.44, 0.38, 0.32]) {
    const url = small.toDataURL('image/webp', q), bytes = Math.floor((url.length - url.indexOf(',') - 1) * 3 / 4);
    best = { key, name: theme.name, q, bytes, url }; if (bytes <= BUDGET) break;
  }
  results[key] = best; env.dispose(); pmrem.dispose(); arena.dispose?.();
}
document.body.dataset.results = JSON.stringify(results); document.body.dataset.done = '1';
</script></body></html>`;
const server = await createServer({ root: process.cwd(), configFile: false, server: { host: '127.0.0.1', port: 0 }, logLevel: 'error', plugins: [{ name: 'pit-arena-stills', configureServer(s) { s.middlewares.use(async (req, res, next) => { if (req.url.split('?')[0] !== '/pit-arena-stills.html') return next(); res.setHeader('Content-Type', 'text/html'); res.end(await s.transformIndexHtml('/pit-arena-stills.html', PAGE)); }); } }] });
await server.listen();
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
page.on('pageerror', (e) => console.log('PAGEERROR', String(e).slice(0, 300)));
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 300)); });
await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/pit-arena-stills.html`);
await page.waitForSelector('body[data-done="1"]', { timeout: 600_000 });
const results = JSON.parse(await page.evaluate(() => document.body.dataset.results));
mkdirSync(out, { recursive: true });
for (const [key, r] of Object.entries(results)) {
  writeFileSync(`${out}/${key}.webp`, Buffer.from(r.url.slice(r.url.indexOf(',') + 1), 'base64'));
  console.log(`${key}.webp  ${r.name}  q ${r.q}  ${r.bytes} B`);
}
await browser.close(); await server.close();
