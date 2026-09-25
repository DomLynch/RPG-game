// Kill-screen thumbnails for the weapon pieces (Lead, 2026-09-25: the Nightborn's Estoc tile showed its name alone beside armour with
// pictures). scripts/loot-layers.mjs renders the armour from loot.glb over the figure; a weapon has no loot.glb draw, its look is the
// player's equip file (src/assets/weapons/player/<weapon>.glb, the WeaponDrawn part the hand holds). So: that part alone, laid on the
// diagonal, under loot-layers' own lights and exposure, then loot-layers' thumbnail crop (alpha bounds, squared at 1.12, 96 px, webp .82)
// to public/game/img/loot/<id>.thumb.webp for every weapon id in src/loot.ts LOOT. Run after an equip file changes:
// `node scripts/weapon-thumbs.mjs` (Playwright's Chromium, a few seconds).
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { LOOT, isWeaponLoot, weaponOf } from '../src/loot.ts';

const ROOT = new URL('..', import.meta.url).pathname, OUT = join(ROOT, 'public/game/img/loot'), THUMB = 96, QUALITY = 0.82, SIZE = 512;
const ids = Object.values(LOOT).flat().filter(isWeaponLoot).sort();

const PAGE = `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:transparent}</style>
<script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script>
<script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setSize(${SIZE}, ${SIZE}); renderer.setPixelRatio(1); renderer.setClearColor(0x000000, 0);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05; renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene(), pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.28;
scene.add(new THREE.HemisphereLight('#8d938e', '#2a2521', 0.55));
for (const [c, i, p] of [['#ffd6a6', 3.4, [-2.2, 3.4, 2.6]], ['#9db2c9', 2.6, [2.6, 2.4, -2.4]], ['#c9773a', 1.1, [2.2, 0.4, 2.2]]]) { const l = new THREE.DirectionalLight(c, i); l.position.set(...p); scene.add(l); }
const loader = new GLTFLoader(), holder = new THREE.Group(); scene.add(holder);
window.show = async (weapon) => {
  holder.clear();
  const gltf = await loader.loadAsync('/assets/weapons/player/' + weapon + '.glb');
  const part = gltf.scene.getObjectByName('WeaponDrawn') ?? gltf.scene.getObjectByName('SwordDrawn');
  if (!part) throw new Error(weapon + ': no WeaponDrawn/SwordDrawn in its equip file');
  // The part in its own frame (local +Y runs butt to tip), laid tip up-right and turned about its shaft to the yaw that shows the most of
  // it (the scythe's blade seen edge-on is a line), then a little further so it is not quite flat.
  part.removeFromParent(); part.position.set(0, 0, 0); part.quaternion.identity(); part.scale.setScalar(1); part.visible = true;
  const lay = new THREE.Group(); lay.add(part); lay.rotation.z = -Math.PI / 4; holder.add(lay);
  const gl = renderer.getContext(), pixels = new Uint8Array(${SIZE} * ${SIZE} * 4);
  const shown = () => { frame(); gl.readPixels(0, 0, ${SIZE}, ${SIZE}, gl.RGBA, gl.UNSIGNED_BYTE, pixels); let a = 0; for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 8) a++; return a; };
  let best = 0, most = -1;
  // The scythe's blade lies flat across the top of the haft (perpendicular to it): no turn about the shaft shows its face, so it alone is
  // tipped toward the camera (radians about x, after the turn).
  part.rotation.x = ({ scythe: 0.95 })[weapon] ?? 0;
  for (let k = 0; k < 18; k++) { part.rotation.y = k * Math.PI / 18; const a = shown(); if (a > most) { most = a; best = part.rotation.y; } }
  part.rotation.y = best + 0.35;
  frame();
};
function frame() {
  holder.updateMatrixWorld(true);
  const sphere = new THREE.Box3().setFromObject(holder).getBoundingSphere(new THREE.Sphere()), r = sphere.radius * 1.05;
  const camera = new THREE.OrthographicCamera(-r, r, r, -r, 0.01, 100);
  camera.position.copy(sphere.center).add(new THREE.Vector3(0, 0, 10)); camera.lookAt(sphere.center); camera.updateProjectionMatrix();
  renderer.render(scene, camera);
}
window.ready = true;
</script>`;

const types = { '.js': 'text/javascript', '.glb': 'model/gltf-binary' };
const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://x').pathname;
  if (path === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(PAGE); }
  const file = path.startsWith('/three/') ? join(ROOT, 'node_modules/three', path.slice(7)) : path.startsWith('/assets/') ? join(ROOT, 'src/assets', path.slice(8)) : null;
  try { res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' }); res.end(await readFile(file)); } catch { res.writeHead(404); res.end(); }
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const browser = await chromium.launch(), page = await browser.newPage({ viewport: { width: SIZE, height: SIZE }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => { console.error('page error:', e.message); process.exitCode = 1; });
try {
  await page.goto(`http://127.0.0.1:${server.address().port}/`); await page.waitForFunction(() => window.ready, null, { timeout: 90000 });
  await mkdir(OUT, { recursive: true });
  const shots = new Map();   // one render per weapon: the Veteran's and the Witch's tridents are the same equip file
  for (const id of ids) {
    const weapon = weaponOf(id);
    if (!shots.has(weapon)) { await page.evaluate((w) => window.show(w), weapon); shots.set(weapon, await page.screenshot({ omitBackground: true })); }
    // loot-layers' thumb(): the piece's alpha bounds, squared at 1.12, drawn to 96 px.
    const data = await page.evaluate(async ([b64, T, Q]) => {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
      const p = g.getImageData(0, 0, c.width, c.height).data; let top = c.height, bottom = -1, left = c.width, right = -1;
      for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (p[(y * c.width + x) * 4 + 3] > 8) { top = Math.min(top, y); bottom = Math.max(bottom, y); left = Math.min(left, x); right = Math.max(right, x); }
      if (bottom < 0) return null;
      const w = right - left + 1, h = bottom - top + 1, side = Math.max(w, h) * 1.12, f = document.createElement('canvas'); f.width = f.height = T;
      const fg = f.getContext('2d'); fg.imageSmoothingQuality = 'high';
      fg.drawImage(img, left + w / 2 - side / 2, top + h / 2 - side / 2, side, side, 0, 0, T, T);
      return f.toDataURL('image/webp', Q).split(',')[1];
    }, [shots.get(weapon).toString('base64'), THUMB, QUALITY]);
    if (!data) throw new Error(`${id}: the ${weapon} rendered nothing`);
    const buf = Buffer.from(data, 'base64'), file = join(OUT, `${id}.thumb.webp`);
    await writeFile(file, buf); console.log(`${file.slice(ROOT.length)} ${THUMB}x${THUMB} ${(buf.length / 1024).toFixed(1)} KB`);
  }
} finally { await browser.close(); server.close(); }
