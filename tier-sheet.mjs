// Scratch: the tier-dressing sheet. The game's own rigs, loot cut and grading (src/characters.ts), rendered 375 px wide per panel.
// node tier-sheet.mjs <repoRoot> <out.png>
import { createServer } from 'vite';
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
const [root, out] = process.argv.slice(2);
const PAGE = `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;background:#1d1f21;color:#e9ddc5;font:15px Arial}#grid{display:flex;flex-wrap:wrap;gap:8px;padding:8px}figure{margin:0;width:375px}img{display:block;width:375px;height:640px}figcaption{padding:6px 2px 0;letter-spacing:.5px}h1{font-size:17px;margin:10px 10px 0}</style></head>
<body><h1 id="title">Tier dressing: loading…</h1><div id="grid"></div><script type="module">
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { loadWarriors, loadLoot, lootWorn, lootId } from '/src/characters.ts';
import { kitWorn } from '/src/loot.ts';
const W = 375, H = 640, renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(2); renderer.setSize(W, H); renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
const pmrem = new THREE.PMREMGenerator(renderer), env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
const urls = { hero: new URL('/src/assets/warrior.glb', location.href).href, veteran: new URL('/src/assets/veteran.glb', location.href).href, loot: new URL('/src/assets/loot.glb', location.href).href, carriers: new URL('/src/assets/loot/carriers-veteran.glb', location.href).href };
function shot(anchor, caption) {
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#5d5a54'); scene.environment = env; scene.environmentIntensity = .45;
  scene.add(new THREE.HemisphereLight('#d9d2c4', '#3a342c', 1.4)); const sun = new THREE.DirectionalLight('#fff1dc', 2.2); sun.position.set(-2, 4, 3); scene.add(sun);
  scene.add(anchor); anchor.position.set(0, 0, 0); anchor.rotation.y = 0.35;
  const camera = new THREE.PerspectiveCamera(34, W / H, .1, 50); camera.position.set(0, 1.15, 4.1); camera.lookAt(0, 1.0, 0);
  renderer.render(scene, camera); scene.remove(anchor);
  const fig = document.createElement('figure'); fig.innerHTML = '<img><figcaption></figcaption>'; fig.querySelector('img').src = renderer.domElement.toDataURL('image/png'); fig.querySelector('figcaption').textContent = caption; document.getElementById('grid').append(fig);
}
const settle = rig => { for (let i = 0; i < 40; i++) rig.update(0, 1 / 60, 'ready', 1); };
const [carriers, loot] = await Promise.all([loadLoot(urls.carriers), loadLoot(urls.loot)]);
{ const { opponent } = await loadWarriors(urls.hero, urls.veteran, ['longsword', 'trident']); settle(opponent); shot(opponent.anchor, 'Centurion — trunk today (own body, no kit)'); }
for (const tier of ['Recruit', 'Legionary', 'Gladiator']) {
  const { opponent } = await loadWarriors(urls.hero, urls.veteran, ['longsword', 'trident']);
  opponent.wear(carriers.filter(p => lootWorn(p, kitWorn('veteran', true, tier))), undefined, tier); settle(opponent);
  shot(opponent.anchor, 'Centurion met at ' + tier + ' — his kit graded ' + tier);
}
for (const tier of ['Recruit', 'Legionary', 'Gladiator']) {
  const { player } = await loadWarriors(urls.hero);
  player.wear(loot.filter(p => lootWorn(p, ['veteran.Body'])), undefined, () => tier); settle(player);
  shot(player.anchor, 'Player — Centurion BODY piece only, taken at ' + tier);
}
document.getElementById('title').textContent = 'Tier dressing (world/tier-dressing): v3 grades — Centurion at three rungs (no crest at Recruit), the taken body piece at three tiers';
document.body.dataset.done = '1';
</script></body></html>`;
const server = await createServer({ root, server: { host: '127.0.0.1', port: 0 }, logLevel: 'silent', plugins: [{ name: 'tier-sheet', configureServer(s) { s.middlewares.use(async (req, res, next) => { if (req.url.split('?')[0] !== '/tier-sheet.html') return next(); res.setHeader('Content-Type', 'text/html'); res.end(await s.transformIndexHtml('/tier-sheet.html', PAGE)); }); } }] });
await server.listen();
const { port } = server.httpServer.address();
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 3 * 375 + 32, height: 2200 } });
page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 300)); });
page.on('pageerror', e => console.log('PAGEERROR', String(e).slice(0, 300)));
await page.goto(`http://127.0.0.1:${port}/tier-sheet.html`);
await page.waitForSelector('body[data-done="1"]', { timeout: 180000 });
await page.screenshot({ path: out, fullPage: true });
await browser.close(); await server.close();
console.log('wrote', out);
