#!/usr/bin/env node
// Hero Look raw-vs-fitted sheet (docs/state/herolook.md): several GLBs, each alone on the same stage, at six matched angles (front, front ¾,
// right, back ¾, back, left), same camera distance, same light. A raw converter mesh is stood 1.90 m tall with its soles on the floor; a
// fitted rig is frozen in its rest pose (no clip), scutum and swords hidden, so only the body the fit produced is compared.
// Lights stay fixed in the world while the camera orbits, as a phone photo walking round a statue in the arena would see it.
//   node scripts/herolook-sheet.mjs --label sheet-d A=public/herolook/raw-tmax.glb B=public/herolook/raw-d.glb C=public/herolook/legionary-d-noshield.glb
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { join, resolve, extname } from 'node:path';

const argv = process.argv.slice(2), arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const ROOT = new URL('..', import.meta.url).pathname, OUT = join(ROOT, 'artifacts/herolook', arg('--label', 'sheet'));
const COLS = argv.filter((a) => /^[A-Za-z0-9]+=/.test(a)).map((a) => { const [k, ...v] = a.split('='); return { key: k, file: resolve(v.join('=')) }; });
const ANGLES = [['front', 0], ['front34', 45], ['right', 90], ['back34', 135], ['back', 180], ['left', 270]];
const W = 600, H = 1100;
const PAGE = `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:#2a2521}</style>
<script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script>
<script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(${W}, ${H}); renderer.setClearColor(0x2a2521, 1);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05; renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene(), pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.28;   // the Profile frame's light (herolook-stills.mjs)
scene.add(new THREE.HemisphereLight('#8d938e', '#2a2521', 0.55));
for (const [c, i, p] of [['#ffd6a6', 3.4, [-2.2, 3.4, 2.6]], ['#9db2c9', 2.6, [2.6, 2.4, -2.4]], ['#c9773a', 1.1, [2.2, 0.4, 2.2]]]) { const l = new THREE.DirectionalLight(c, i); l.position.set(...p); scene.add(l); }
const fov = 18, fit = 1.9 * 1.12, dist = (fit / 2) / Math.tan(THREE.MathUtils.degToRad(fov / 2)), target = new THREE.Vector3(0, 0.95, 0);
const camera = new THREE.PerspectiveCamera(fov, ${W} / ${H}, 0.05, 100);
const loader = new GLTFLoader(); let current;
window.load = async (url) => {
  if (current) scene.remove(current);
  const g = await loader.loadAsync(url), root = g.scene, rigged = g.animations.length > 0;
  root.traverse((o) => { if (/Sword|HeroScutum/.test(o.name)) o.visible = false; });
  root.updateMatrixWorld(true);
  // A fitted rig rests in T; put its arms back down to the source's A-pose (the angle creatures.py posed the donor to), same pose as the raw.
  if (rigged) for (const [side, sgn] of [['l', 1], ['r', -1]]) { const b = root.getObjectByName('upperarm_' + side); if (!b) continue;
    const wq = b.getWorldQuaternion(new THREE.Quaternion()), pq = b.parent.getWorldQuaternion(new THREE.Quaternion());
    const turn = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), ${JSON.stringify(Number(arg('--arm', 62)))} * Math.PI / 180 * sgn * ${JSON.stringify(Number(arg('--arm-sign', -1)))});
    b.quaternion.copy(pq.invert().multiply(turn.multiply(wq))); root.updateMatrixWorld(true); }
  const box = new THREE.Box3(); root.traverse((o) => { if (o.isMesh && o.visible) { o.geometry.computeBoundingBox(); box.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld)); } });
  if (!rigged) { const k = 1.9 / (box.max.y - box.min.y); root.scale.setScalar(k); root.position.set(-((box.min.x + box.max.x) / 2) * k, -box.min.y * k, -((box.min.z + box.max.z) / 2) * k); }
  scene.add(root); current = root;
  let tris = 0; const tex = new Set(); root.traverse((o) => { if (o.isMesh && o.visible) { const q = o.geometry; tris += (q.index ? q.index.count : q.attributes.position.count) / 3; for (const k of ['map', 'normalMap', 'metalnessMap', 'roughnessMap']) if (o.material?.[k]?.image) tex.add(k + ' ' + o.material[k].image.width); } });
  const failed = []; root.traverse((o) => { if (o.isMesh && o.material?.map === null && o.visible && !rigged) failed.push(o.name); });
  return { rigged, tris: Math.round(tris), textures: [...tex], untextured: failed.length };
};
window.shot = (deg) => { const a = THREE.MathUtils.degToRad(deg); camera.position.set(target.x + Math.sin(a) * dist, target.y, target.z + Math.cos(a) * dist); camera.lookAt(target); camera.updateProjectionMatrix(); renderer.render(scene, camera); };
window.ready = true;
</script>`;
const types = { '.js': 'text/javascript', '.glb': 'model/gltf-binary' };
const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://x').pathname;
  if (path === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(PAGE); }
  const col = COLS.find((c) => path === `/col/${c.key}.glb`);
  const file = col ? col.file : path.startsWith('/three/') ? join(ROOT, 'node_modules/three', path.slice(7)) : null;
  try { res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' }); res.end(await readFile(file)); } catch { res.writeHead(404); res.end(); }
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const browser = await chromium.launch(), page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
page.setDefaultTimeout(300000);
const errors = []; page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); }); page.on('pageerror', (e) => errors.push(e.message));
await mkdir(OUT, { recursive: true });
await page.goto(`http://127.0.0.1:${server.address().port}/`); await page.waitForFunction(() => window.ready);
const stats = {};
for (const c of COLS) {
  const before = errors.length;
  stats[c.key] = { file: c.file.slice(ROOT.length), ...(await page.evaluate((u) => window.load(u), `/col/${c.key}.glb`)) };
  stats[c.key].errors = errors.slice(before);
  for (const [name, deg] of ANGLES) { await page.evaluate((d) => window.shot(d), deg); await page.screenshot({ path: join(OUT, `${c.key}-${name}.png`) }); }
  console.log(c.key, JSON.stringify(stats[c.key]));
}
await writeFile(join(OUT, 'stats.json'), JSON.stringify(stats, null, 2) + '\n');
await browser.close(); server.close();
