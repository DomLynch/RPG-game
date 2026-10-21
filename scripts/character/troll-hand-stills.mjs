// Before/after stills of the Cave Troll's claw with a two-handed weapon in hand (Characters & Art, 2026-10-18): each PNG is 750x812, two 375x812 phone
// panels side by side, LEFT = the "before" body, RIGHT = the "after" body, same pose, same camera, same light. The weapon is the warhammer equip file's
// WeaponDrawn placed under hand_r exactly as src/fight/characters.ts equipWeapon does; the pose is the equip file's Warhammer_* clips on the troll's rig.
// It also prints, per pose, how far the WEAPON sits from the troll's own fist skin (the centroid of the right-fist vertices, skinned): a weapon that rides
// the claw keeps that distance as the arm moves; a weapon on a claw that does not follow hand_r drifts away from it ("slip" = change from the ready pose).
//   node scripts/character/troll-hand-stills.mjs <before.glb> <after.glb> <out dir>
// Serves three from node_modules; Chromium with software GL (works on the VPS).
import { launchBrowser } from '../lib/browser-launch.mjs';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const [before, after, out] = process.argv.slice(2);
if (!out) throw new Error('usage: troll-hand-stills.mjs <before.glb> <after.glb> <out dir>');
const root = process.cwd(), weapon = path.join(root, 'src/assets/weapons/warhammer/warhammer.glb');
fs.mkdirSync(out, { recursive: true });
const files = { '/f/before.glb': before, '/f/after.glb': after, '/f/weapon.glb': weapon };
const html = `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:#2b2d2f}canvas{display:block;float:left}</style>
<script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script>
<div id="w"></div>
<script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const SCALE = 1.52;   // Dom's ruling 2026-10-18: the troll is drawn x1.52 everywhere (the catalogue row still says 1.9 until Combat changes it)
const sides = [];
async function build(url, weaponAsset) {
  const asset = await loader.loadAsync(url), scene = asset.scene, hand = scene.getObjectByName('hand_r');
  const carried = []; scene.traverse((o) => { if (/^(SwordSheathed|SwordDrawn|WeaponDrawn|WeaponSheathed)(_\\d+)?$/.test(o.name)) carried.push(o); });
  for (const n of carried) n.removeFromParent();
  const held = clone(weaponAsset.scene.getObjectByName('WeaponDrawn')); hand.add(held);
  scene.scale.multiplyScalar(SCALE);
  let mesh; scene.traverse((o) => { if (o.isSkinnedMesh) mesh = o; });
  const canvas = document.createElement('canvas'); document.getElementById('w').appendChild(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true }); renderer.setPixelRatio(1); renderer.setSize(375, 812);
  const sc = new THREE.Scene(); sc.background = new THREE.Color(0x3a3d40);
  sc.add(new THREE.HemisphereLight(0xffffff, 0x555555, 1.6)); const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.position.set(3, 6, 5); sc.add(sun);
  sc.add(scene);
  const clips = new Map([...weaponAsset.animations, ...asset.animations].map((c) => [c.name, c]));
  // The fist: right-hand vertices of the bind pose (x < -0.40 m, y 0.55..0.90 m); the same set in both bodies.
  const pos = mesh.geometry.attributes.position, fist = [];
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), y = pos.getY(i); if (x < -0.40 && y > 0.55 && y < 0.90) fist.push(i); }
  return { scene, sc, renderer, mixer: new THREE.AnimationMixer(scene), clips, mesh, hand, held, fist, cam: new THREE.PerspectiveCamera(32, 375 / 812, 0.1, 100) };
}
window.setup = async () => {
  const weaponAsset = await loader.loadAsync('/f/weapon.glb');
  sides.push(await build('/f/before.glb', weaponAsset), await build('/f/after.glb', weaponAsset));
  return { clips: [...sides[0].clips.keys()].filter((n) => /Warhammer/.test(n)).map((n) => [n, sides[0].clips.get(n).duration]), fist: sides.map((s) => s.fist.length) };
};
const v = new THREE.Vector3(), c = new THREE.Vector3();
window.shot = (clipName, frac, view) => {
  const out = [];
  for (const s of sides) {
    const clip = s.clips.get(clipName);
    s.mixer.stopAllAction(); const a = s.mixer.clipAction(clip); a.play(); a.time = clip.duration * frac; s.mixer.update(0);
    s.scene.updateMatrixWorld(true); s.mesh.skeleton.update();
    c.set(0, 0, 0); for (const i of s.fist) { s.mesh.getVertexPosition(i, v); v.applyMatrix4(s.mesh.matrixWorld); c.add(v); } c.multiplyScalar(1 / s.fist.length);
    const w = s.held.getWorldPosition(new THREE.Vector3()), h = s.hand.getWorldPosition(new THREE.Vector3());
    // Tearing: triangle edges that grow more than 2.5x between the bind pose and this pose (a seam pulled between two bones), with where the worst sit in bind space.
    if (!s.edges) { const ix = s.mesh.geometry.index.array, set = new Set(); for (let t = 0; t < ix.length; t += 3) for (let k = 0; k < 3; k++) { const a = ix[t + k], b = ix[t + (k + 1) % 3]; set.add(a < b ? a * 65536 * 4 + b : b * 65536 * 4 + a); } s.edges = [...set].map((e) => [Math.floor(e / 262144), e % 262144]); }
    const P = s.mesh.geometry.attributes.position, pa = new THREE.Vector3(), pb = new THREE.Vector3(), ba = new THREE.Vector3(), bb = new THREE.Vector3(); let torn = 0; const worst = [];
    for (const [a, b] of s.edges) { const l0 = ba.fromBufferAttribute(P, a).distanceTo(bb.fromBufferAttribute(P, b)); if (l0 < 1e-5) continue; s.mesh.getVertexPosition(a, pa); s.mesh.getVertexPosition(b, pb); const r = pa.distanceTo(pb) / l0; if (r > 2.5) { torn++; if (worst.length < 400) worst.push([ba.x, ba.y, ba.z]); } }
    const wc = worst.length ? worst.reduce((q, p) => [q[0] + p[0] / worst.length, q[1] + p[1] / worst.length, q[2] + p[2] / worst.length], [0, 0, 0]).map((x) => +x.toFixed(2)) : null;
    out.push({ weaponToFist: +w.distanceTo(c).toFixed(3), fistToHandBone: +c.distanceTo(h).toFixed(3), stretchedEdges: torn, stretchedAtBind: wc });
    if (view === 'full') { s.cam.position.set(0, 1.7, 10.5); s.cam.lookAt(0, 1.55, 0); }
    else { const t = h.clone(); s.cam.position.set(t.x, t.y + 0.3, t.z + 4.6); s.cam.lookAt(t.x, t.y - 0.2, t.z); }
    s.cam.updateProjectionMatrix(); s.renderer.render(s.sc, s.cam);
  }
  return out;
};
window.ready = true;
</script>`;
const mime = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.glb': 'model/gltf-binary', '.html': 'text/html', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  if (u === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(html); }
  let hit = files[u] ?? (u.startsWith('/three/') ? path.join(root, 'node_modules/three', u.slice(7)) : null);
  if (!hit || !fs.existsSync(hit)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': mime[path.extname(hit)] ?? 'application/octet-stream' }); fs.createReadStream(hit).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await launchBrowser(chromium, { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 750, height: 812 } });
  const errors = []; page.on('pageerror', (e) => errors.push(String(e).slice(0, 300))); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.waitForFunction(() => window.ready, null, { timeout: 60000 });
  const info = await page.evaluate(() => window.setup());
  console.log('setup', JSON.stringify(info));
  const idle = process.env.IDLE_CLIP ?? 'Warhammer_Idle', swing = process.env.SWING_CLIP ?? 'Warhammer_Heavy';
  const poses = [['ready', idle, 0], ['swing-a', swing, 0.3], ['swing-b', swing, 0.45], ['swing-c', swing, 0.6]];
  for (const [id, clip, frac] of poses) for (const view of ['full', 'close']) {
    const m = await page.evaluate(([c, f, vw]) => window.shot(c, f, vw), [clip, frac, view]);
    const file = path.join(out, `${id}-${view}.png`);
    await page.screenshot({ path: file });
    console.log(file, clip, frac, 'before', JSON.stringify(m[0]), 'after', JSON.stringify(m[1]));
  }
  if (errors.length) { console.error('page errors', errors); process.exitCode = 1; }
} finally { await browser.close(); server.close(); }
