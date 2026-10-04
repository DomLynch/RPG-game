// Opponent portraits (Web design): the transparent 900×1200 cutouts in public/game/img/<id>.webp — the /game page's opponent tiles and
// the arena draw's roster strip. The first five (ec8d3f97, 2026-09-20) came from an uncommitted scratchpad rig; this is that rig, checked in, unchanged
// in look: the shipped body GLB at its fighting idle (weapon drawn), camera at 32° azimuth / −4° elevation / fov 26, ACES at 1.05, a warm
// key, a cool rim and an ember kick over a dim room environment, on a transparent clear. One change: the frame is cropped to the drawn
// figure and fitted into 900×1200 (centred, feet on a 30 px bottom margin), because a height-only camera fit clipped the Dwarf's hammer
// and shrank wide crouches. Usage: `node scripts/opponent-portraits.mjs dwarf knight …` (ids = src/assets/<id>.glb; no ids = every roster
// body missing a portrait; PORTRAIT_OUT renders elsewhere). Playwright's Chromium with the Mac GPU (software GL stalls on these bodies).
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname, OUT = process.env.PORTRAIT_OUT || join(ROOT, 'public/game/img'), QUALITY = 0.82;
// The clip each body stands in: its weapon family's idle where the GLB carries one, else Guard (the five shipped portraits' choice).
const CLIP = { veteran: 'Trident_Idle', executioner: 'Scythe_Idle', dwarf: 'Warhammer_Idle', knight: 'Maul_Idle', witch: 'Trident_Idle' };
const ROSTER = ['veteran', 'pitborn', 'goblin', 'nightborn', 'executioner', 'dwarf', 'knight', 'shieldmaiden', 'plaguedoctor', 'witch'];
const ids = process.argv.slice(2).length ? process.argv.slice(2) : ROSTER.filter((id) => !existsSync(join(OUT, `${id}.webp`)));

const PAGE = `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:transparent}canvas{display:block}</style>
<script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script>
<script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
const P = new URLSearchParams(location.search), W = 1800, H = 2400, fov = 26, az = 32, el = -4, pad = 1.12, lookY = 0.5, t = 0.5;
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setSize(W, H); renderer.setPixelRatio(1); renderer.setClearColor(0x000000, 0);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05; renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene(), pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.28;
scene.add(new THREE.HemisphereLight('#8d938e', '#2a2521', 0.55));
for (const [c, i, p] of [['#ffd6a6', 3.4, [-2.2, 3.4, 2.6]], ['#9db2c9', 2.6, [2.6, 2.4, -2.4]], ['#c9773a', 1.1, [2.2, 0.4, 2.2]]]) { const l = new THREE.DirectionalLight(c, i); l.position.set(...p); scene.add(l); }
const camera = new THREE.PerspectiveCamera(fov, W / H, 0.05, 100);
const asset = await new GLTFLoader().loadAsync('/src/assets/' + P.get('glb') + '.glb'), root = asset.scene; scene.add(root);
const want = P.get('clip'), pick = asset.animations.find((c) => c.name === want) || asset.animations.find((c) => c.name === 'Guard') || asset.animations[0];
const mixer = new THREE.AnimationMixer(root); if (pick) { mixer.clipAction(pick).play(); mixer.setTime(t % pick.duration); }
const drawn = root.getObjectByName('SwordDrawn'), sheathed = root.getObjectByName('SwordSheathed');
if (drawn && sheathed) { drawn.visible = true; sheathed.visible = false; }
root.updateMatrixWorld(true);
const box = new THREE.Box3(); root.traverse((o) => { if (o.isSkinnedMesh) { o.computeBoundingBox(); box.union(o.boundingBox.clone().applyMatrix4(o.matrixWorld)); } });
// Pulled back to 1.6× the height fit so no pose (the Dwarf's raised hammer, the Goblin's crouch) leaves the frame; the crop below
// then frames what was actually drawn, so every body fills the portrait the same way whatever its pose or weapon.
const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3()), dist = 1.6 * (size.y * pad / 2) / Math.tan(THREE.MathUtils.degToRad(fov / 2));
const rad = THREE.MathUtils.degToRad(az), elr = THREE.MathUtils.degToRad(el), target = new THREE.Vector3(center.x, box.min.y + size.y * lookY, center.z);
camera.position.set(target.x + Math.sin(rad) * dist * Math.cos(elr), target.y + Math.sin(elr) * dist, target.z + Math.cos(rad) * dist * Math.cos(elr));
camera.lookAt(target); camera.updateProjectionMatrix(); renderer.render(scene, camera);
// Crop to the drawn pixels (alpha > 8), then fit into 900×1200 with a 30 px margin: centred across, feet on the bottom margin.
const src = document.createElement('canvas'); src.width = W; src.height = H; src.getContext('2d').drawImage(renderer.domElement, 0, 0);
const px = src.getContext('2d').getImageData(0, 0, W, H).data; let x0 = W, y0 = H, x1 = 0, y1 = 0;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (px[(y * W + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
const cw = x1 - x0 + 1, ch = y1 - y0 + 1, k = Math.min((900 - 60) / cw, (1200 - 60) / ch), dw = cw * k, dh = ch * k;
const out = document.createElement('canvas'); out.width = 900; out.height = 1200;
const g = out.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(src, x0, y0, cw, ch, (900 - dw) / 2, 1200 - 30 - dh, dw, dh);
window.done = { clip: pick?.name, webp: out.toDataURL('image/webp', ${QUALITY}) };
</script>`;

const TYPES = { '.js': 'text/javascript', '.glb': 'model/gltf-binary', '.html': 'text/html' };
const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://x').pathname;
  if (path === '/') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(PAGE); return; }
  const file = path.startsWith('/three/') ? join(ROOT, 'node_modules', path) : join(ROOT, path);
  try { res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' }); res.end(await readFile(file)); } catch { res.writeHead(404); res.end(); }
}).listen(0, '127.0.0.1');
await new Promise((resolve) => server.once('listening', resolve));
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
try {
  for (const id of ids) {
    const page = await browser.newPage({ viewport: { width: 1200, height: 1600 } });
    page.on('pageerror', (e) => console.error(id, 'pageerror', e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/?${new URLSearchParams({ glb: id, clip: CLIP[id] ?? 'Guard' })}`);
    const { clip, webp } = await (await page.waitForFunction(() => window.done, null, { timeout: 60000 })).jsonValue();
    const bytes = Buffer.from(webp.split(',')[1], 'base64');
    await writeFile(join(OUT, `${id}.webp`), bytes);
    console.log(`${id}.webp 900x1200 ${clip} ${Math.round(bytes.length / 1024)} KB`);
    await page.close();
  }
} finally { await browser.close(); server.close(); }
