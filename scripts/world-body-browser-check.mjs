// World body browser check (Lead 2026-10-07): every public/world/<kind>.glb loads in a real Chromium page through the game's loader pair
// (GLTFLoader + MeshoptDecoder), plays Idle then Walk on an AnimationMixer, and the skinned mesh visibly moves between two Walk times
// (a body that ignores its rig fails: the unskinned knight/witch of the first world_body.py would). Prints one line per body; exit 1 on any miss.
//   node scripts/world-body-browser-check.mjs [--dir public/world] [--shot artifacts/world-bodies.png]
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, readdir, mkdir } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const dir = arg('dir', 'public/world'), shot = arg('shot', ''), root = resolve('.');
const kinds = (await readdir(dir)).filter((n) => n.endsWith('.glb')).map((n) => n.slice(0, -4)).sort();
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm' };
const page = `<!doctype html><script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js","three/addons/":"/node_modules/three/examples/jsm/"}}</script>
<canvas id="c" width="750" height="250"></canvas><script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('c'), preserveDrawingBuffer: true }), scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(35, 3, 0.1, 100);
scene.background = new THREE.Color(0xc8c9cd); scene.add(new THREE.HemisphereLight(0xffffff, 0x555566, 2.2)); const sun = new THREE.DirectionalLight(0xffffff, 2); sun.position.set(2, 4, 3); scene.add(sun);
window.run = async (dir, kinds) => {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder), out = [];
  for (const [i, kind] of kinds.entries()) {
    const t0 = performance.now(), gltf = await loader.loadAsync('/' + dir + '/' + kind + '.glb'), root = gltf.scene, ms = performance.now() - t0;
    let skinned = null, tris = 0, maps = 0; root.traverse((o) => { if (o.isSkinnedMesh) skinned = o; if (o.isMesh) { tris += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3; if (o.material.map) maps++; } });
    const mixer = new THREE.AnimationMixer(root), clip = (n) => gltf.animations.find((a) => a.name === n);
    const at = (name, t) => { mixer.stopAllAction(); mixer.clipAction(clip(name)).play(); mixer.setTime(t); root.updateMatrixWorld(true); skinned.skeleton.update(); return skinned.skeleton.bones.map((b) => b.getWorldPosition(new THREE.Vector3()).toArray()).flat(); };
    const idle = at('Idle', 0.2), w0 = at('Walk', 0), w1 = at('Walk', 0.35);
    const moved = Math.max(...w0.map((v, k) => Math.abs(v - w1[k]))), size = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());
    root.position.x = (i - (kinds.length - 1) / 2) * 1.6 * Math.max(1, size.y / 2); scene.add(root); out.push({ kind, ms: Math.round(ms), tris, maps, bones: skinned.skeleton.bones.length, idleOk: idle.every(Number.isFinite), walkMoved: +moved.toFixed(3), height: +size.y.toFixed(2), clips: gltf.animations.length });
  }
  const box = new THREE.Box3().setFromObject(scene), c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
  cam.position.set(c.x, c.y, c.z + Math.max(s.x / 3 / Math.tan(THREE.MathUtils.degToRad(17.5)), 3) * 1.3); cam.lookAt(c); renderer.render(scene, cam);
  const gl = renderer.getContext(), px = new Uint8Array(4); gl.readPixels(375, 125, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); return { out, drew: px[3] > 0 };
};
</script>`;
const server = createServer(async (req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(page); }
  try { const body = await readFile(join(root, p)); res.writeHead(200, { 'content-type': types[extname(p)] ?? 'application/octet-stream' }); res.end(body); } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = []; let failed = false;
try {
  const tab = await (await browser.newContext({ viewport: { width: 750, height: 250 } })).newPage();
  tab.on('pageerror', (e) => errors.push(e.message)); tab.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await tab.goto(`http://127.0.0.1:${server.address().port}/`);
  const { out, drew } = await tab.evaluate(([d, k]) => window.run(d, k), [dir, kinds]);
  for (const r of out) { const ok = r.idleOk && r.walkMoved > 0.01 && r.tris > 0 && r.tris < 10000 && r.maps === 1; failed ||= !ok; console.log(`${ok ? 'ok  ' : 'FAIL'} ${r.kind}: loaded in ${r.ms} ms, ${r.tris} tris, ${r.maps} map, ${r.bones} bones, ${r.clips} clips, ${r.height} m tall, Walk moves the skeleton by ${r.walkMoved} m`); }
  console.log(`canvas drew: ${drew}; page errors: ${errors.length ? errors.join(' | ') : 'none'}`); failed ||= !drew || errors.length > 0;
  if (shot) { await mkdir(dirname(shot), { recursive: true }); await tab.locator('#c').screenshot({ path: shot }); console.log(`shot ${shot}`); }
} finally { await browser.close(); server.close(); }
process.exit(failed ? 1 : 0);
