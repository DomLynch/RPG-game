// WebKit receipt for the weapon WebP re-encode (#3485): both weapon GLBs load in WebKit (Safari's engine), their textures decode (EXT_texture_webp), and a lit render of each is textured, not flat.
// Usage: PLAYWRIGHT_BROWSERS_PATH=~/Developer/.ms-playwright node scripts/webkit-weapon-receipt.mjs <out dir>   (light: one 640x320 canvas; run only when no deploy or release-checks is running)
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { webkit } from 'playwright';

const out = process.argv[2] ?? 'artifacts/webkit-weapon-receipt', root = process.cwd();
fs.mkdirSync(out, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm' };
const page = `<!doctype html><meta charset=utf-8><body style="margin:0;background:#222"><canvas id=c width=640 height=320></canvas>
<script type=importmap>{"imports":{"three":"/node_modules/three/build/three.module.js","three/addons/":"/node_modules/three/examples/jsm/"}}</script>
<script type=module>
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
const files = ['/public/weapons/shapes/gladius-crafted.glb', '/public/weapons/ranged/bow-v1.glb'];
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('c'), antialias: true, preserveDrawingBuffer: true });
renderer.setScissorTest(true); renderer.setClearColor(0x333333);
const results = [];
for (const [i, url] of files.entries()) {
  const scene = new THREE.Scene(); scene.add(new THREE.AmbientLight(0xffffff, 1.4)); const d = new THREE.DirectionalLight(0xffffff, 2); d.position.set(2, 3, 4); scene.add(d);
  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(url);
  gltf.scene.traverse((o) => { if (o.isMesh) for (const k of ['map', 'metalnessMap', 'roughnessMap']) { const t = o.material[k]; if (t) results.push({ file: url.split('/').pop(), slot: k, decoded: !!t.image && (t.image.width || t.image.naturalWidth) > 0, w: t.image?.width ?? t.image?.naturalWidth ?? 0, h: t.image?.height ?? t.image?.naturalHeight ?? 0 }); } });
  const box = new THREE.Box3().setFromObject(gltf.scene), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  gltf.scene.position.sub(c); scene.add(gltf.scene);
  const cam = new THREE.PerspectiveCamera(35, 1, 0.01, 100); const r = Math.max(size.x, size.y, size.z) * 1.9; cam.position.set(r * 0.6, r * 0.3, r); cam.lookAt(0, 0, 0);
  renderer.setViewport(i * 320, 0, 320, 320); renderer.setScissor(i * 320, 0, 320, 320); renderer.render(scene, cam);
}
const gl = renderer.getContext(), px = new Uint8Array(640 * 320 * 4); gl.readPixels(0, 0, 640, 320, gl.RGBA, gl.UNSIGNED_BYTE, px);
const colourful = (x0) => { const seen = new Set(); for (let y = 0; y < 320; y += 2) for (let x = x0; x < x0 + 320; x += 2) { const o = (y * 640 + x) * 4; seen.add((px[o] >> 3) << 10 | (px[o + 1] >> 3) << 5 | (px[o + 2] >> 3)); } return seen.size; };
window.__receipt = { results, distinctColours: [colourful(0), colourful(320)], renderer: gl.getParameter(gl.VERSION) };
</script>`;
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  if (u === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(page); }
  const file = path.join(root, u);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': mime[path.extname(file)] ?? 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await webkit.launch();
try {
  const p = await (await browser.newContext({ viewport: { width: 640, height: 320 } })).newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(String(e).slice(0, 200))); p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  await p.goto(`http://127.0.0.1:${server.address().port}/`);
  await p.waitForFunction(() => window.__receipt, null, { timeout: 60000 });
  const receipt = await p.evaluate(() => window.__receipt);
  await p.screenshot({ path: path.join(out, 'webkit-weapons.png') });
  console.log('WEBKIT', await p.evaluate(() => navigator.userAgent.slice(0, 80)), JSON.stringify({ ...receipt, errors }));
  const bad = receipt.results.filter((r) => !r.decoded), flat = receipt.distinctColours.filter((n) => n < 40);
  if (bad.length || flat.length || errors.length) { console.log('FAIL', JSON.stringify({ undecoded: bad, flatRenders: flat, errors })); process.exitCode = 1; } else console.log('PASS both weapons load, decode their WebP textures and render textured in WebKit');
} finally { await browser.close(); server.close(); }
