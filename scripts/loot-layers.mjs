// Paperdoll layers for the journal's Profile tab (Web design, owner 2026-09-22: "the player image should dynamically update with the
// gear"). Renders the player rig front-on once bare (public/game/img/fighter.webp) and once per loot id in src/assets/loot.glb with the
// body as a depth-only occluder (public/game/img/loot/<opponent>.<Slot>.webp), all cropped to the SAME frame as the bare render so the
// layers stack pixel-for-pixel over the figure. Then rewrites the marked block in src/style.css: one rule per id that shows its layer
// when the loader has put that id on the slot (`#slot-<key>[data-loot=...]`). Pieces are worn the way src/characters.ts wears them: a
// `replace` piece hides the rig's own draws in that slot (a helmet hides the hair too), a mapless palette material takes the rig's
// material of the same name. Run after every loot.glb change: `node scripts/loot-layers.mjs` (Playwright's Chromium, ~40 s).
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { extname, join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname, OUT = join(ROOT, 'public/game/img'), HEIGHT = 720, QUALITY = 0.82;
const PAPERDOLL = { head: ['Helmet', 'Crest'], chest: ['Body'], arms: ['Arms'], hands: ['Gloves'], legs: ['Greaves'], feet: ['Boots'] };
const keyOf = (slot) => Object.keys(PAPERDOLL).find((key) => PAPERDOLL[key].includes(slot));

const PAGE = `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:transparent}</style>
<script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script>
<script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
const W = 700, H = 1400, renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setSize(W, H); renderer.setPixelRatio(1); renderer.setClearColor(0x000000, 0);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05; renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene(), pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.28;
scene.add(new THREE.HemisphereLight('#8d938e', '#2a2521', 0.55));
for (const [c, i, p] of [['#ffd6a6', 3.4, [-2.2, 3.4, 2.6]], ['#9db2c9', 2.6, [2.6, 2.4, -2.4]], ['#c9773a', 1.1, [2.2, 0.4, 2.2]]]) { const l = new THREE.DirectionalLight(c, i); l.position.set(...p); scene.add(l); }
const loader = new GLTFLoader(), rig = await loader.loadAsync('/assets/warrior.glb'), loot = await loader.loadAsync('/assets/loot.glb');
const root = rig.scene; scene.add(root);
const idle = rig.animations.find((c) => c.name === 'Idle'), mixer = new THREE.AnimationMixer(root); mixer.clipAction(idle).play(); mixer.setTime(0.5 % idle.duration);
const drawn = root.getObjectByName('SwordDrawn'), sheathed = root.getObjectByName('SwordSheathed'); if (drawn && sheathed) { drawn.visible = false; sheathed.visible = true; }
root.updateMatrixWorld(true);
const box = new THREE.Box3(); root.traverse((o) => { if (o.isSkinnedMesh) { o.computeBoundingBox(); box.union(o.boundingBox.clone().applyMatrix4(o.matrixWorld)); } });
const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3()), fov = 18, dist = (size.y * 1.04 / 2) / Math.tan(THREE.MathUtils.degToRad(fov / 2));
const camera = new THREE.PerspectiveCamera(fov, W / H, 0.05, 100), target = new THREE.Vector3(center.x, box.min.y + size.y * 0.5, center.z);
camera.position.set(target.x, target.y, target.z + dist); camera.lookAt(target); camera.updateProjectionMatrix();
// The rig's draws and materials, as characters.ts wear() finds them.
let body; const own = [], materials = new Map();
root.traverse((o) => { if (!o.isMesh) return; own.push(o); if (o.isSkinnedMesh && o.userData.slot === 'Body' && !body) body = o; if (o.material?.name && o.material.map) materials.set(o.material.name, o.material); });
const pieces = []; let shared = {};
loot.scene.traverse((o) => { if (o.isSkinnedMesh && typeof o.userData.slot === 'string') pieces.push(o); if (o.userData?.pieces) shared = { ...shared, ...o.userData.pieces }; });
// A shared draw (brief 14) is ONE mesh worn by several opponents. The GLB stores it once — that is the whole saving — but a layer is a
// 1.5 KB thumbnail the panel looks up by opponent.slot.webp, so here we render a copy per wearer instead of making every consumer
// of these files learn to resolve the map. Seven kilobytes buys the UI staying exactly as it was.
const idsOf = (p) => { const own = p.userData.opponent + '.' + p.userData.slot;
  const refs = Object.entries(shared).filter(([, target]) => target === own).map(([ref]) => ref); return refs.length ? refs : [own]; };
const ARMOUR = ['Helmet', 'Crest', 'Body', 'Arms', 'Gloves', 'Greaves', 'Boots'];   // weapon draws (Weapons' equip files) are a separate render path
const ids = [...new Set(pieces.filter((p) => ARMOUR.includes(p.userData.slot)).flatMap(idsOf))].sort();
const occluder = new THREE.MeshBasicMaterial({ colorWrite: false });
let worn = [];
window.show = (id) => {   // null = bare figure; an id = that piece over a depth-only body
  for (const w of worn) w.removeFromParent(); worn = [];
  for (const o of own) { o.visible = true; o.userData.__m ??= o.material; o.material = id ? occluder : o.userData.__m; }
  if (!id) { renderer.render(scene, camera); return; }
  const mine = pieces.filter((p) => idsOf(p).includes(id)), hide = new Set(mine.filter((p) => p.userData.layer === 'replace').map((p) => p.userData.slot));
  if (hide.has('Helmet')) hide.add('Hair');
  for (const o of own) if (hide.has(String(o.userData.slot))) o.visible = false;
  for (const p of mine) { const m = p.material?.name && !p.material.map ? materials.get(p.material.name) ?? p.material : p.material, c = new THREE.SkinnedMesh(p.geometry, m); c.frustumCulled = false; c.bind(body.skeleton, body.bindMatrix); body.parent.add(c); worn.push(c); }
  renderer.render(scene, camera);
};
window.show(null); window.ready = { ids, layers: Object.fromEntries(pieces.flatMap((p) => idsOf(p).map((id) => [id, p.userData.layer]))) };
</script>`;

const types = { '.js': 'text/javascript', '.glb': 'model/gltf-binary' };
const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://x').pathname;
  if (path === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(PAGE); }
  const file = path.startsWith('/three/') ? join(ROOT, 'node_modules/three', path.slice(7)) : path.startsWith('/assets/') ? join(ROOT, 'src/assets', path.slice(8)) : null;
  try { res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' }); res.end(await readFile(file)); } catch { res.writeHead(404); res.end(); }
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const port = server.address().port, browser = await chromium.launch(), page = await browser.newPage({ viewport: { width: 700, height: 1400 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => { console.error('page error:', e.message); process.exitCode = 1; });
await page.goto(`http://127.0.0.1:${port}/`); await page.waitForFunction(() => window.ready, null, { timeout: 90000 });
const ready = await page.evaluate(() => window.ready);
// One frame for all: the union of the bare figure's and every layer's alpha bounds (a crown rises above the head), so the layers stack
// pixel-for-pixel over the figure and nothing is clipped.
const shots = [[null, await page.screenshot({ omitBackground: true })]];
for (const id of ready.ids) { await page.evaluate((id) => window.show(id), id); shots.push([id, await page.screenshot({ omitBackground: true })]); }
const bounds = (png) => page.evaluate(async (b64) => {
  const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  const p = g.getImageData(0, 0, c.width, c.height).data; let top = c.height, bottom = -1, left = c.width, right = -1;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (p[(y * c.width + x) * 4 + 3] > 8) { top = Math.min(top, y); bottom = Math.max(bottom, y); left = Math.min(left, x); right = Math.max(right, x); }
  return bottom < 0 ? null : { top, bottom, left, right };
}, png.toString('base64'));
const pad = 6; let frame = null; const own = new Map();   // each layer's own bounds, for the kill screen's thumbnails
for (const [id, png] of shots) {
  const b = await bounds(png); if (!b) { if (id) console.error(`${id} rendered nothing`); continue; }
  if (id) own.set(id, b);
  frame = frame ? { top: Math.min(frame.top, b.top), bottom: Math.max(frame.bottom, b.bottom), left: Math.min(frame.left, b.left), right: Math.max(frame.right, b.right) } : b;
}
frame = { x: frame.left - pad, y: frame.top - pad, w: frame.right - frame.left + 1 + pad * 2, h: frame.bottom - frame.top + 1 + pad * 2 };
const crop = (png) => page.evaluate(async ([b64, H, Q, frame]) => {
  const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
  const s = Math.min(1, H / frame.h), f = document.createElement('canvas'); f.width = Math.round(frame.w * s); f.height = Math.round(frame.h * s);
  const fg = f.getContext('2d'); fg.imageSmoothingQuality = 'high'; fg.drawImage(img, frame.x, frame.y, frame.w, frame.h, 0, 0, f.width, f.height);
  return { webp: f.toDataURL('image/webp', Q).split(',')[1], w: f.width, h: f.height };
}, [png.toString('base64'), HEIGHT, QUALITY, frame]);
const save = async (file, data) => { const buf = Buffer.from(data.webp, 'base64'); await writeFile(file, buf); console.log(`${file.slice(ROOT.length)} ${data.w}x${data.h} ${(buf.length / 1024).toFixed(1)} KB`); return data; };
await mkdir(join(OUT, 'loot'), { recursive: true });
let base;
for (const [id, png] of shots) { const data = await save(id ? join(OUT, 'loot', `${id}.webp`) : join(OUT, 'fighter.webp'), await crop(png)); if (!id) base = data; }
// Thumbnails for the kill screen's Take-one panel (src/loot-panel.ts): the piece alone, cropped to its own bounds, squared, 96 px.
const THUMB = 96;
const thumb = (png, b) => page.evaluate(async ([b64, b, T, Q]) => {
  const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
  const w = b.right - b.left + 1, h = b.bottom - b.top + 1, side = Math.max(w, h) * 1.12, f = document.createElement('canvas'); f.width = f.height = T;
  const fg = f.getContext('2d'); fg.imageSmoothingQuality = 'high';
  fg.drawImage(img, b.left + w / 2 - side / 2, b.top + h / 2 - side / 2, side, side, 0, 0, T, T);
  return { webp: f.toDataURL('image/webp', Q).split(',')[1], w: T, h: T };
}, [png.toString('base64'), b, THUMB, QUALITY]);
for (const [id, png] of shots) if (id && own.has(id)) await save(join(OUT, 'loot', `${id}.thumb.webp`), await thumb(png, own.get(id)));
// index.html: the figure's intrinsic size, so the wrapper and the layers share the frame before the image loads.
const html = join(ROOT, 'index.html'), markup = await readFile(html, 'utf8');
const sized = markup.replace(/(<img src="\/game\/img\/fighter\.webp" alt="Your fighter" width=")\d+(" height=")\d+(")/, `$1${base.w}$2${base.h}$3`);
if (sized === markup && !markup.includes(`width="${base.w}" height="${base.h}"`)) throw new Error('index.html: fighter img not found');
await writeFile(html, sized);
await browser.close(); server.close();
// style.css: one rule per id inside the marked block.
const css = join(ROOT, 'src/style.css'), text = await readFile(css, 'utf8'), start = '/* loot-layers:start (generated by scripts/loot-layers.mjs, do not edit) */', end = '/* loot-layers:end */';
const rules = ready.ids.map((id) => `.doll:has(#slot-${keyOf(id.split('.')[1])}[data-loot='${id}']) .doll-layer[data-layer='${keyOf(id.split('.')[1])}'] { background-image: url(/game/img/loot/${id}.webp); }`).join('\n');
const a = text.indexOf(start), b = text.indexOf(end);
if (a < 0 || b < 0) throw new Error('style.css has no loot-layers block');
await writeFile(css, text.slice(0, a) + start + '\n' + rules + '\n' + text.slice(b));
console.log(`${ready.ids.length} layers, ${base.w}x${base.h} frame; style.css block rewritten`);
