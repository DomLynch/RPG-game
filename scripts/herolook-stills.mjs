// Hero Look pilot stills (docs/state/herolook.md): the pilot rig and today's Centurion kit through the SAME camera, frame, lights and
// tone mapping the Profile tab's figure is rendered with (scripts/loot-layers.mjs: fov 18, the fixed 800x1400 frame, ACES 1.05), so the
// pair differs only in what the hero wears. Writes the two renders, a 375-wide side-by-side strip and a 1280 one into artifacts/herolook/<label>/.
//   node scripts/herolook-stills.mjs --pilot public/herolook/legionary.glb --label profile-v1 [--kit veteran] [--pose Idle:0.5] [--look profile|closeup] [--ss 2]
//   node scripts/herolook-stills.mjs --pilot none --label interim --look closeup      the kit alone under the close-up budget (the interim pair)
// Never part of the build or the runtime; nothing in src/ reads its output.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const ROOT = new URL('..', import.meta.url).pathname, PILOT = resolve(arg('--pilot', 'public/herolook/legionary.glb')), LABEL = arg('--label', 'profile'), KIT = arg('--kit', 'veteran');
const [POSE, AT] = arg('--pose', 'Idle:0.5').split(':'), OUT = join(ROOT, 'artifacts/herolook', LABEL), LOOK = arg('--look', 'profile'), SS = Number(arg('--ss', '1'));
// --look closeup: the close-up budget the hero-moment cameras can afford (docs/state/herolook.md): a shadow-casting key, a cool fill, a warm rim,
// the environment up, and the kit's maps served from src/assets/source/materials at their SOURCE size instead of the carrier's downsized copies.
// Every map's size is printed so the cost line is measured, not guessed. --ss 2 supersamples the still (pixel ratio 2 on the same frame).

const PAGE = `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:transparent}</style>
<script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script>
<script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
const W = 800, H = 1400, renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setSize(W, H); renderer.setPixelRatio(${SS}); renderer.setClearColor(0x000000, 0);
const CLOSEUP = ${JSON.stringify(LOOK)} === 'closeup';
if (CLOSEUP) { renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; }
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05; renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene(), pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = CLOSEUP ? 0.55 : 0.28;
scene.add(new THREE.HemisphereLight('#8d938e', '#2a2521', CLOSEUP ? 0.35 : 0.55));
const LIGHTS = CLOSEUP
  ? [['#ffd9b0', 4.2, [-2.0, 3.6, 2.4], true], ['#8fa6c4', 1.6, [2.8, 2.0, -1.8], false], ['#ffb36b', 2.4, [2.6, 2.6, -2.6], false]]   // key (shadows), fill, rim
  : [['#ffd6a6', 3.4, [-2.2, 3.4, 2.6], false], ['#9db2c9', 2.6, [2.6, 2.4, -2.4], false], ['#c9773a', 1.1, [2.2, 0.4, 2.2], false]];
for (const [c, i, p, shadow] of LIGHTS) { const l = new THREE.DirectionalLight(c, i); l.position.set(...p); if (shadow) { l.castShadow = true; l.shadow.mapSize.set(2048, 2048); l.shadow.bias = -0.0004; l.shadow.normalBias = 0.01; l.shadow.radius = 3; const s = l.shadow.camera; s.near = 0.5; s.far = 12; s.left = s.bottom = -1.4; s.right = s.top = 1.4; } scene.add(l); }
// Source-size maps for the kit's material families (the carrier ships Bronze's normal at 512 and Steel/Wrap at 256 procedural tiles).
const SOURCE = { Bronze: ['bronze_color_polish_veteran.jpg', 'bronze_normal_polish_veteran.jpg', 'bronze_orm_polish_veteran.jpg'], Leather: ['leather_color_polish_veteran.jpg', 'leather_normal_polish_veteran.jpg', 'leather_orm_polish_veteran.jpg'], Heraldry: ['heraldry_color_veteran.jpg', 'heraldry_normal_veteran.jpg', 'heraldry_orm_veteran.jpg'], Wrap: ['wrap_color_veteran.jpg', 'wrap_normal_veteran.jpg', 'wrap_orm_veteran.jpg'] };
const tl = new THREE.TextureLoader(), mapCache = new Map(), sizes = {};
const upgrade = async (m) => { const set = SOURCE[m.name]; if (!CLOSEUP || !set) return; const [c, n, o] = await Promise.all(set.map(async (f) => { if (!mapCache.has(f)) mapCache.set(f, tl.loadAsync('/materials/' + f)); return mapCache.get(f); }));
  c.colorSpace = THREE.SRGBColorSpace; for (const t of [c, n, o]) { t.flipY = false; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (m.map) t.repeat.copy(m.map.repeat); }
  m.map = c; m.normalMap = n; m.metalnessMap = m.roughnessMap = o; m.metalness = m.name === 'Bronze' ? 1 : 0; m.roughness = 1; m.needsUpdate = true; sizes[m.name] = c.image.width + '/' + n.image.width + '/' + o.image.width; };
const loader = new GLTFLoader();
const pose = (rig) => { const root = rig.scene, clip = rig.animations.find((c) => c.name === ${JSON.stringify(POSE)}), mixer = new THREE.AnimationMixer(root); if (clip) { mixer.clipAction(clip).play(); mixer.setTime(${Number(AT)} % clip.duration); }
  const drawn = root.getObjectByName('SwordDrawn'), sheathed = root.getObjectByName('SwordSheathed'); if (drawn && sheathed) { drawn.visible = false; sheathed.visible = true; } root.updateMatrixWorld(true); return root; };
// The Profile frame, from the BARE hero (loot-layers.mjs): both renders share it, so the pilot is measured against the same canvas.
const bare = pose(await loader.loadAsync('/assets/warrior.glb'));
const box = new THREE.Box3(); bare.traverse((o) => { if (o.isSkinnedMesh) { o.computeBoundingBox(); box.union(o.boundingBox.clone().applyMatrix4(o.matrixWorld)); } });
const HEADROOM = 1.36, FOOT = 0.06, size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3()), fov = 18, fit = size.y * HEADROOM, dist = (fit / 2) / Math.tan(THREE.MathUtils.degToRad(fov / 2));
const camera = new THREE.PerspectiveCamera(fov, W / H, 0.05, 100), target = new THREE.Vector3(center.x, box.min.y - fit * FOOT + fit / 2, center.z);
camera.position.set(target.x, target.y, target.z + dist); camera.lookAt(target); camera.updateProjectionMatrix();
// Today: the hero wearing the kit, worn as characters.ts wear() and loot-layers.mjs wear it (replace hides the rig's own slot draws + Hair).
const loot = await loader.loadAsync('/assets/loot.glb'); let shared = {}; const pieces = [];
loot.scene.traverse((o) => { if (o.isSkinnedMesh && typeof o.userData.slot === 'string') pieces.push(o); if (o.userData?.pieces) shared = { ...shared, ...o.userData.pieces }; });
const idsOf = (p) => { const own = p.userData.opponent + '.' + p.userData.slot; const refs = Object.entries(shared).filter(([, t]) => t === own).map(([r]) => r); return refs.length ? refs : [own]; };
const kit = ${JSON.stringify(KIT)}, mine = pieces.filter((p) => idsOf(p).some((id) => id.startsWith(kit + '.')) && ['Helmet', 'Crest', 'Body', 'Arms', 'Gloves', 'Greaves', 'Boots', 'Shield'].includes(p.userData.slot));
let body; const materials = new Map(); bare.traverse((o) => { if (!o.isMesh) return; if (o.isSkinnedMesh && o.userData.slot === 'Body' && !body) body = o; if (o.material?.name && o.material.map) materials.set(o.material.name, o.material); });
const hide = new Set(mine.filter((p) => p.userData.layer === 'replace').map((p) => p.userData.slot)); if (hide.has('Helmet')) hide.add('Hair');
bare.traverse((o) => { if (o.isMesh && hide.has(String(o.userData.slot))) o.visible = false; });
for (const p of mine) { const m = p.material?.name && !p.material.map ? materials.get(p.material.name) ?? p.material : p.material, c = new THREE.SkinnedMesh(p.geometry, m); c.frustumCulled = false; if (p.userData.slot === 'Shield') m.side = THREE.DoubleSide; c.bind(body.skeleton, body.bindMatrix); body.parent.add(c); }
const seen = new Set(); bare.traverse((o) => { if (!o.isMesh) return; o.castShadow = o.receiveShadow = CLOSEUP; if (o.material && !seen.has(o.material)) { seen.add(o.material); } });
await Promise.all([...seen].map(upgrade));
scene.add(bare); renderer.render(scene, camera); window.sizes = sizes; window.todayReady = true;
await new Promise((ok) => { window.next = ok; });
scene.remove(bare);
const pilot = pose(await loader.loadAsync('/pilot.glb')); pilot.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = CLOSEUP; }); scene.add(pilot); renderer.render(scene, camera);
window.stats = (() => { let tris = 0, draws = 0; const tex = new Set(); pilot.traverse((o) => { if (o.isMesh) { draws++; const g = o.geometry; tris += (g.index ? g.index.count : g.attributes.position.count) / 3; for (const k of ['map', 'normalMap', 'metalnessMap', 'roughnessMap']) if (o.material?.[k]?.image) tex.add(k + ' ' + o.material[k].image.width + 'x' + o.material[k].image.height); } }); return { tris, draws, textures: [...tex] }; })();
window.pilotReady = true;
</script>`;
const types = { '.js': 'text/javascript', '.glb': 'model/gltf-binary', '.jpg': 'image/jpeg', '.png': 'image/png' };
const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://x').pathname;
  if (path === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(PAGE); }
  const file = path === '/pilot.glb' ? PILOT : path.startsWith('/materials/') ? join(ROOT, 'src/assets/source/materials', path.slice(11)) : path.startsWith('/three/') ? join(ROOT, 'node_modules/three', path.slice(7)) : path.startsWith('/assets/') ? join(ROOT, 'src/assets', path.slice(8)) : null;
  try { res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' }); res.end(await readFile(file)); } catch { res.writeHead(404); res.end(); }
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const port = server.address().port, browser = await chromium.launch(), page = await browser.newPage({ viewport: { width: 800, height: 1400 }, deviceScaleFactor: 1 });
page.setDefaultTimeout(240000);   // a loaded box (load 60 tonight) takes over 30 s for one 800x1400 WebGL screenshot
page.on('pageerror', (e) => { console.error('page error:', e.message); process.exitCode = 1; });
await mkdir(OUT, { recursive: true });
await page.goto(`http://127.0.0.1:${port}/`); await page.waitForFunction(() => window.todayReady, null, { timeout: 120000 });
const kitFile = LOOK === 'closeup' ? 'kit-closeup.png' : 'today.png';
await page.screenshot({ path: join(OUT, kitFile), omitBackground: true });
const sizes = await page.evaluate(() => window.sizes);
console.log(`${OUT.slice(ROOT.length)}/${kitFile} (${800 * SS}x${1400 * SS}, look ${LOOK})${Object.keys(sizes).length ? ' source maps colour/normal/orm: ' + Object.entries(sizes).map(([k, v]) => k + ' ' + v).join(', ') : ''}`);
if (arg('--pilot', 'public/herolook/legionary.glb') !== 'none') {
  await page.evaluate(() => window.next()); await page.waitForFunction(() => window.pilotReady, null, { timeout: 120000 });
  await page.screenshot({ path: join(OUT, 'pilot.png'), omitBackground: true });
  const stats = await page.evaluate(() => window.stats);
  await writeFile(join(OUT, 'pilot-stats.json'), JSON.stringify({ pilot: PILOT.slice(ROOT.length), pose: `${POSE}:${AT}`, kit: KIT, look: LOOK, ...stats }, null, 2) + '\n');
  console.log(`${OUT.slice(ROOT.length)}/pilot.png: ${stats.tris} tris, ${stats.draws} draws, textures ${stats.textures.join(', ') || 'none'}`);
}
await browser.close(); server.close();
