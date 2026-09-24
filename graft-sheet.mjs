// Scratch: graft slice 1 studio sheet — each direction in a ¾ view, and the seam close up in stab / slash / heavy contact poses.
// node graft-sheet.mjs <repoRoot> <out.png>
import { createServer } from 'vite';
import { chromium } from 'playwright';
const [root, out] = process.argv.slice(2);
const PAGE = `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;background:#1d1f21;color:#e9ddc5;font:14px Arial}#grid{display:grid;grid-template-columns:repeat(4,375px);gap:8px;padding:8px}figure{margin:0}img{display:block;width:375px}figcaption{padding:5px 2px 0}h1{font-size:17px;margin:10px}</style></head>
<body><h1 id="title">Graft: loading…</h1><div id="grid"></div><script type="module">
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { loadWarriors } from '/src/characters.ts';
import { graftArm } from '/src/graft-preview.ts';
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(2); renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
const env = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
const url = f => new URL('/src/assets/' + f + '.glb', location.href).href;
function shot(anchor, caption, cam, look, h = 640) {
  renderer.setSize(375, h);
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#5d5a54'); scene.environment = env; scene.environmentIntensity = .45;
  scene.add(new THREE.HemisphereLight('#d9d2c4', '#3a342c', 1.4)); const sun = new THREE.DirectionalLight('#fff1dc', 2.2); sun.position.set(-2, 4, 3); scene.add(sun);
  scene.add(anchor);
  const camera = new THREE.PerspectiveCamera(34, 375 / h, .05, 50); camera.position.set(...cam); camera.lookAt(...look);
  renderer.render(scene, camera); scene.remove(anchor);
  const fig = document.createElement('figure'); fig.innerHTML = '<img><figcaption></figcaption>'; fig.querySelector('img').src = renderer.domElement.toDataURL('image/png'); fig.querySelector('figcaption').textContent = caption; document.getElementById('grid').append(fig);
}
const NAMES = { a: 'A — raw, stitched on', b: 'B — bound in bandage', c: 'C — witch-fire in the veins' };
const reports = {};
for (const style of ['a', 'b', 'c']) {
  const { player, opponent } = await loadWarriors(url('warrior'), url('witch'), ['longsword', 'trident']);
  for (let i = 0; i < 40; i++) player.update(0, 1 / 60, 'ready', 1);
  reports[style] = graftArm(player.anchor, opponent.anchor, style);
  player.anchor.rotation.y = -0.6;   // ¾, her arm (his left) toward camera
  shot(player.anchor, 'Skill: Witch-fire · ' + NAMES[style] + ' · studio ¾', [0, 1.2, 3.4], [0, 1.05, 0]);
  for (const [attack, label] of [['thrust', 'stab'], ['light', 'slash'], ['heavy', 'heavy']]) {
    for (let i = 0; i < 10; i++) player.update(0, 1 / 60, 'attack', .35 * i / 9, attack, .35);
    player.anchor.updateMatrixWorld(true);
    const sh = new THREE.Vector3(); player.anchor.getObjectByName('upperarm_l').getWorldPosition(sh);
    const dir = new THREE.Vector3(Math.sin(-0.6 + 0.9), 0.1, Math.cos(-0.6 + 0.9)).normalize();
    shot(player.anchor, NAMES[style].slice(0, 1) + ' seam · ' + label + ' contact pose', sh.clone().addScaledVector(dir, 0.75).toArray(), sh.toArray(), 300);
  }
}
document.getElementById('title').textContent = 'Graft slice 1 — the Witch\\'s casting arm on the player (skill: Witch-fire). Studio; the in-pit stills are separate.';
document.body.dataset.reports = JSON.stringify(reports); document.body.dataset.done = '1';
</script></body></html>`;
const server = await createServer({ root, server: { host: '127.0.0.1', port: 0 }, logLevel: 'silent', plugins: [{ name: 'graft-sheet', configureServer(s) { s.middlewares.use(async (req, res, next) => { if (req.url.split('?')[0] !== '/graft-sheet.html') return next(); res.setHeader('Content-Type', 'text/html'); res.end(await s.transformIndexHtml('/graft-sheet.html', PAGE)); }); } }] });
await server.listen();
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 4 * 375 + 40, height: 1200 } });
page.on('pageerror', e => console.log('PAGEERROR', String(e).slice(0, 300)));
page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 300)); });
await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/graft-sheet.html`);
await page.waitForSelector('body[data-done="1"]', { timeout: 240000 });
console.log('REPORTS', await page.evaluate(() => document.body.dataset.reports));
await page.screenshot({ path: out, fullPage: true });
await browser.close(); await server.close();
