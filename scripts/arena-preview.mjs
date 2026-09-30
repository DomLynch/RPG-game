// World lane review harness. Deterministic captures of the arena (src/arena.ts) under the game's own renderer settings, lights, fog and
// lock camera, with the two shipped rigs standing at the simulation's start positions, plus a resource table. Never part of the build.
//   node scripts/arena-preview.mjs --label baseline        capture into artifacts/world/<label>/
//   node scripts/arena-preview.mjs --against baseline      also print deltas against that label's stats
//   node scripts/arena-preview.mjs --moodboard             material swatches under the game lighting (direction proposal only)
//   node scripts/arena-preview.mjs --serve                 keep a dev server up for manual review
//   --phone                                                 capture at the phone tier (halved arena maps, 512 shadow map, prop maps capped)
// Every capture uses the same camera and exposure; changing them here to flatter the set is a failed iteration. The lock views settle
// the camera before capturing (the lead's 7.6 % lesson: an unsettled camera is not a before/after).
import { createServer } from 'vite';
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { execSync } from 'node:child_process';
const args = process.argv.slice(2), option = name => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const commit = execSync('git rev-parse --short HEAD').toString().trim();
const label = option('label') || commit, against = option('against');

const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Frankendom arena preview</title>
<style>html,body{margin:0;height:100%;background:#2b2d2f;color:#ddd;font:12px system-ui;overflow:hidden}#world{display:block;margin:auto}#status{position:fixed;top:6px;left:8px}</style></head>
<body><canvas id="world"></canvas><span id="status">Loading…</span><script type="module">
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildArena, PLAY_RADIUS, CAMERA_CLAMP } from '/src/arena.ts';
import { cameraPose } from '/src/camera.ts';
import { createFootDust } from '/src/foot-dust.ts';
import { loadWarriors } from '/src/characters.ts';
import { actorPose, initialPractice } from '/src/combat.ts';
import { OPPONENTS } from '/src/moves.ts';
import { TARGET, initialState } from '/src/sim.ts';
const status = t => document.getElementById('status').textContent = t;
const canvas = document.getElementById('world'), GAME_RATIO = 1.5, TICK = 1 / 60;
// Game renderer settings (src/scene.ts createScene): the lead's, frozen here.
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.3;
const scene = new THREE.Scene(); scene.background = new THREE.Color('#a9a89c'); scene.fog = new THREE.FogExp2('#a9a89c', 0.018);
{ const pmrem = new THREE.PMREMGenerator(renderer), room = new RoomEnvironment(); scene.environment = pmrem.fromScene(room, 0.04).texture; room.dispose(); pmrem.dispose(); }
scene.environmentIntensity = 0.45;
scene.add(new THREE.HemisphereLight('#c9cfc6', '#4a4238', 1.6));
const sun = new THREE.DirectionalLight('#ffe2b8', 4.2); sun.position.set(-15, 26, -18); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -15, right: 15, top: 15, bottom: -15, near: 1, far: 70 }); sun.shadow.normalBias = 0.04; scene.add(sun);
const camera = new THREE.PerspectiveCamera(51, 1, 0.1, 180);
const t0 = performance.now(), arena = buildArena(scene), buildMs = performance.now() - t0; let readyMs = 0;
// The two rigs at the simulation's start: the hero at initialState, the Veteran at TARGET, both in their ready pose.
const practice = initialPractice(731, OPPONENTS.veteran), state = initialState(), enemy = practice.enemy;
const player = new THREE.Group(), opponent = new THREE.Group(); scene.add(player, opponent);
player.position.set(state.x, 0, state.z); player.rotation.y = state.heading; opponent.position.set(enemy.x, 0, enemy.z); opponent.rotation.y = enemy.heading;
let warriors;
function settle(ticks) {   // rigs settle into their ready pose; the arena runs its idle motion (deterministic: fixed dt, no wall clock)
  const mine = actorPose(practice, 0), theirs = actorPose(practice, 1);
  for (let i = 0; i < ticks; i++) { warriors.player.update(0, TICK, mine.pose, mine.progress, mine.attack, mine.contact, 0, 0); warriors.opponent.update(0, TICK, theirs.pose, theirs.progress, theirs.attack, theirs.contact, 0, 0); arena.update(TICK, [], undefined, { tick: i, fighters: [mine.pose ? { x: state.x, z: state.z } : { x: state.x, z: state.z }, { x: enemy.x, z: enemy.z }] }); }
}
function frame(w, h, ratio) { renderer.setPixelRatio(ratio); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
// The game's lock camera, settled: yaw is the lock yaw itself (scene.ts blends toward it over ~1 s; this is where it ends up).
function lockCamera() {
  const yaw = Math.atan2(state.x - enemy.x, state.z - enemy.z), pose = cameraPose(state, yaw, 0.45, true, enemy);
  camera.fov = 51; camera.position.set(pose.x, pose.y, pose.z); camera.lookAt(pose.lookX, 0.8, pose.lookZ);
}
const VIEWS = {
  'stands': { size: [1280, 720], ratio: 1, place() { camera.fov = 51; camera.position.set(0, 3, 7); camera.lookAt(0, 5, -17); } },
  'gate': { size: [1280, 720], ratio: 1, place() { camera.fov = 51; camera.position.set(4, 2.5, -6); camera.lookAt(0, 2, -12); } },
  'debris': { size: [1280, 720], ratio: 1, place() { camera.fov = 51; camera.position.set(6, 2, 5); camera.lookAt(10, 0, 3); } },
  'lock-portrait': { size: [393, 852], ratio: GAME_RATIO, place: lockCamera },
  'lock-landscape': { size: [852, 393], ratio: GAME_RATIO, place: lockCamera },
  'wide': { size: [1280, 720], ratio: 1, place() { camera.fov = 51; camera.position.set(15, 17, 33); camera.lookAt(0, 2.5, -2); } },   // establishing view from beyond the parapet
  'plan': { size: [1024, 1024], ratio: 1, place() { camera.fov = 51; camera.position.set(0, 30, 0.01); camera.lookAt(0, 0, 0); } },      // the exclusion volume by eye
  // Brief 13: the six lorarii on the walkway — a wide view that takes in three or four posts, and a plan view to read the spacing.
  'lorarii': { size: [1280, 720], ratio: 1, place() { camera.fov = 51; camera.position.set(0, 3.4, -4); camera.lookAt(0, 3.1, -12.1); } },       // close on the near walkway: one post, for the raise/lash beat
  'lorarii-wide': { size: [1280, 720], ratio: 1, place() { camera.fov = 62; camera.position.set(0, 7.5, 9); camera.lookAt(0, 2.9, -12.1); } },   // higher and wider: the whole far arc of the walkway
  'lorarii-plan': { size: [1024, 1024], ratio: 1, place() { camera.fov = 51; camera.position.set(0, 20, 0.01); camera.lookAt(0, 2.6, 0); } },   // spacing by eye, the walkway filling the frame
};
for (let i = 0; i < 12; i++) VIEWS['crowd-' + i] = {
  size: [960, 640], ratio: 1, place() {
    const a = (i + 0.5) / 12 * Math.PI * 2;
    camera.fov = 51; camera.position.set(3 * Math.sin(a), 2.8, 3 * Math.cos(a));
    camera.lookAt(17 * Math.sin(a), 5, 17 * Math.cos(a));
  }
};
function render(view, fighters = true) {
  const { size: [w, h], ratio, place } = VIEWS[view]; frame(w, h, ratio); place(); player.visible = opponent.visible = fighters;
  renderer.render(scene, camera); return { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles };
}
// Mean linear luminance of a texture's pixels (sRGB decoded), or of a colour: the contrast test's numbers.
const linear = c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
function luminance(data, n) { let sum = 0; for (let i = 0; i < n; i++) sum += 0.2126 * linear(data[i * 4] / 255) + 0.7152 * linear(data[i * 4 + 1] / 255) + 0.0722 * linear(data[i * 4 + 2] / 255); return sum / n; }
function textureLuminance(texture) {
  const image = texture.image; if (image.data) return luminance(image.data, image.width * image.height);
  const c = document.createElement('canvas'); c.width = image.width; c.height = image.height; const ctx = c.getContext('2d'); ctx.drawImage(image, 0, 0);
  return luminance(ctx.getImageData(0, 0, c.width, c.height).data, c.width * c.height);
}
function materialLuminance(material) { const base = material.color ? 0.2126 * material.color.r + 0.7152 * material.color.g + 0.0722 * material.color.b : 1; return material.map ? base * textureLuminance(material.map) : base; }
function stats() {
  const meshes = [], textures = new Set(); let triangles = 0, instances = 0;
  arena.group.traverse(o => { if (o.isMesh) { meshes.push(o); const count = o.isInstancedMesh ? o.count : 1; instances += count; triangles += count * (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; for (const m of [].concat(o.material)) for (const k of ['map', 'normalMap', 'roughnessMap', 'alphaMap', 'emissiveMap', 'aoMap']) if (m[k]) textures.add(m[k]); } });
  const textureBytes = [...textures].reduce((n, t) => n + t.image.width * t.image.height * 4 * (t.generateMipmaps ? 4 / 3 : 1), 0);
  const skin = []; warriors.player.anchor.traverse(o => { if (o.isMesh && o.material.name === 'Skin' && o.material.map) skin.push(o.material); });
  const floor = arena.floor ? materialLuminance(arena.floor.material) : null;
  const arenaOnly = render('lock-portrait', false), withFighters = render('lock-portrait', true), wide = render('wide', false);
  return { buildMs: Math.round(buildMs), readyMs: Math.round(readyMs), meshes: meshes.length, instances, triangles: Math.round(triangles), textures: textures.size, textureBytes, drawCallsArena: arenaOnly.calls, drawCallsArenaWide: wide.calls, drawCallsWithFighters: withFighters.calls, trianglesRenderedArena: arenaOnly.triangles, floorLuminance: floor, skinLuminance: skin.length ? textureLuminance(skin[0].map) : null, playRadius: PLAY_RADIUS, cameraClamp: CAMERA_CLAMP };
}
function capture(view, fighters = true) { render(view, fighters); return canvas.toDataURL('image/png'); }
// Brief 13 evidence: loiter -> raise -> lash -> recover on the walkway. Feeds the arena one Whipped event at the near wall
// (what duel.ts emits after RULES.wall.loiter.ticks) and shoots the beats; WhipRaised leads it once Combat emits that.
function lash(view = 'lorarii') {
  const shots = {};
  shots.loiter = capture(view);
  arena.update(1 / 60, [{ tick: 0, type: 'Whipped', actor: 0, target: 0, x: 0, z: -8.55, damage: 3 }], undefined, { tick: 0, fighters: [{ x: 0, z: -8.4 }, { x: 0, z: 2 }] });
  for (let i = 0; i < 12; i++) arena.update(1 / 60, [], undefined, { tick: 0, fighters: [{ x: 0, z: -8.4 }, { x: 0, z: 2 }] });
  shots.raise = capture(view);
  for (let i = 0; i < 12; i++) arena.update(1 / 60, [], undefined, { tick: 0, fighters: [{ x: 0, z: -8.4 }, { x: 0, z: 2 }] });
  shots.lash = capture(view);
  for (let i = 0; i < 24; i++) arena.update(1 / 60, [], undefined, { tick: 0, fighters: [{ x: 0, z: -8.4 }, { x: 0, z: 2 }] });
  shots.recover = capture(view);
  return shots;
}
// Material swatches: the arena's own materials on spheres over its sand, under the game lighting, next to the hero's skin — the mood board.
// Vertex and instance tints are shown as the material alone (the sand sphere is the untinted texture; the cloths get their two colours).
function moodboard() {
  const board = new THREE.Scene(); board.background = scene.background; board.environment = scene.environment; board.environmentIntensity = scene.environmentIntensity;
  board.add(new THREE.HemisphereLight('#d2e0e4', '#575c4c', 2.5)); board.add(sun.clone());
  const seen = new Map(); arena.group.traverse(o => { if (o.isMesh) for (const m of [].concat(o.material)) if (!seen.has(m.name || m.uuid)) seen.set(m.name || m.uuid, m); });
  const skin = []; warriors.player.anchor.traverse(o => { if (o.isMesh && o.material.name === 'Skin') skin.push(o.material); }); if (skin[0]) seen.set('hero skin', skin[0]);
  const swatch = (name, m, tint) => { const c = m.clone(); c.vertexColors = false; c.side = THREE.FrontSide; if (tint) c.color = new THREE.Color(tint); return [name, c]; };
  const list = [...seen.entries()].flatMap(([name, m]) => name === 'cloth' ? [swatch('cloth · blood', m, '#472622'), swatch('cloth · bone', m, '#7d7469')] : name === 'crowd' ? [swatch('crowd · ash', m, '#2a2724')] : [swatch(name, m)]);
  const cols = 6, step = 1.5, rows = Math.ceil(list.length / cols), spheres = [];
  list.forEach(([name, m], i) => { const s = new THREE.Mesh(new THREE.SphereGeometry(.55, 48, 32), m); s.position.set((i % cols - (cols - 1) / 2) * step, .55, (Math.floor(i / cols) - (rows - 1) / 2) * step); s.castShadow = s.receiveShadow = true; s.name = name; board.add(s); spheres.push(s); });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(cols * step + 2, rows * step + 2, 1, 1), swatch('', arena.floor.material)[1]); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
  const g = ground.geometry.attributes.uv; for (let i = 0; i < g.count; i++) g.setXY(i, g.getX(i) * (cols * step + 2) / 3, g.getY(i) * (rows * step + 2) / 3); board.add(ground);
  const w = 1400, h = 320 + rows * 260; frame(w, h, 1); camera.fov = 30; camera.position.set(0, 4 + rows * 1.6, 5.5 + rows * 2.2); camera.lookAt(0, 0.3, 0); renderer.render(board, camera);
  const sheet = document.createElement('canvas'); sheet.width = w; sheet.height = h; const ctx = sheet.getContext('2d'); ctx.drawImage(canvas, 0, 0);
  ctx.font = '15px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = '#f2ede4'; ctx.shadowColor = '#000'; ctx.shadowBlur = 4;
  for (const s of spheres) { const p = s.position.clone(); p.y = -0.1; p.project(camera); ctx.fillText(s.name, (p.x + 1) / 2 * w, (1 - p.y) / 2 * h + 14); }
  ctx.textAlign = 'left'; ctx.fillText('Arena v1 materials under the game lighting (scene.ts sun + hemisphere + room environment, ACES 1.3). Ground: the sand.', 16, 26);
  return { image: sheet.toDataURL('image/png'), names: spheres.map(s => s.name) };
}
function dustPreview() {
  const dust = createFootDust(scene), samples = []; let visibleFrames = 0, peak = 0, captured = false;
  player.visible = true; opponent.visible = false; player.position.set(0, 0, 1); player.rotation.y = Math.PI;
  frame(960, 720, 1); camera.position.set(2.8, 1.5, 4.6); camera.lookAt(0, 0.65, 0);
  const frames = [];
  for (let i = 0; i < 240; i++) {
    const moving = i < 180; player.position.z -= moving ? 1.2 * TICK : 0;
    warriors.player.update(moving ? 1.2 : 0, TICK, 'ready');
    const feet = ['foot_l', 'foot_r'].map(n => warriors.player.boneWorld(n)); samples.push(feet.map(f => f?.y));
    dust.update(TICK, feet, [moving, moving]);
    const cloud = scene.getObjectByName('foot dust'), fades = cloud.geometry.getAttribute('dustFade');
    const active = Array.from(fades.array).filter(f => f > 0).length; peak = Math.max(peak, active); if (cloud.visible) visibleFrames++;
    if (i > 65 && active >= 10 && !captured) { renderer.render(scene, camera); frames.push(canvas.toDataURL('image/png')); cloud.visible = false; renderer.render(scene, camera); frames.push(canvas.toDataURL('image/png')); cloud.visible = true; captured = true; }
  }
  const cleared = !scene.getObjectByName('foot dust').visible;
  // Same walking rig and effect, viewed at the normal portrait combat distance.
  frame(393, 852, GAME_RATIO); player.position.copy(new THREE.Vector3(state.x, 0, state.z)); lockCamera();
  for (let i = 0; i < 110; i++) {
    player.position.z -= 1.2 * TICK; warriors.player.update(1.2, TICK, 'ready');
    dust.update(TICK, ['foot_l', 'foot_r'].map(n => warriors.player.boneWorld(n)), [true, true]);
  }
  const cloud = scene.getObjectByName('foot dust');
  renderer.render(scene, camera); frames.push(canvas.toDataURL('image/png'));
  cloud.visible = false; renderer.render(scene, camera); frames.push(canvas.toDataURL('image/png'));
  dust.dispose(); return { frames, visibleFrames, peak, cleared, footRange: [Math.min(...samples.flat()), Math.max(...samples.flat())] };
}
window.__preview = { dustPreview, loaded: false, error: null, capture, stats, moodboard, buildMs, lash };
try {
  status('Loading warriors…');
  const weapons = practice.duel.fighters.map(f => f.weapon);
  warriors = await loadWarriors(new URL('/src/assets/warrior.glb', location.href).href, new URL('/src/assets/veteran.glb', location.href).href, weapons);
  await arena.ready; readyMs = performance.now() - t0;   // props and worker textures in place before any capture
  player.add(warriors.player.anchor); opponent.add(warriors.opponent.anchor); settle(30);
  window.__preview.loaded = true; status('Ready');
} catch (e) { window.__preview.error = String(e && e.stack || e); status(String(e)); }
</script></body></html>`;

// The page is served by this script (no harness file in the repo root): vite transforms its inline module like any index.html.
const server = await createServer({ server: { host: '127.0.0.1', port: 0 }, logLevel: 'silent', plugins: [{ name: 'arena-preview', configureServer(s) { s.middlewares.use(async (req, res, next) => { if (req.url.split('?')[0] !== '/arena-preview.html') return next(); res.setHeader('Content-Type', 'text/html'); res.end(await s.transformIndexHtml('/arena-preview.html', PAGE)); }); } }] });
await server.listen();
const url = `${server.resolvedUrls.local[0]}arena-preview.html${args.includes('--phone') ? '?gfx=phone' : ''}`;   // --phone: the phone tier (quality.ts ?gfx=phone override)
if (args.includes('--serve')) { console.log(`Arena preview: ${url}\nCtrl-C to stop.`); await new Promise(() => {}); }

const dir = `artifacts/world/${args.includes('--moodboard') ? 'moodboard' : label}`; await fs.mkdir(dir, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
const errors = [];
const save = async (name, dataUrl) => { await fs.writeFile(`${dir}/${name}`, Buffer.from(dataUrl.split(',')[1], 'base64')); console.log(`  ${dir}/${name}`); };
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const page = await context.newPage(); page.on('pageerror', e => errors.push(String(e))); page.on('console', m => { if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text()); });
  page.on('response', r => { if (r.status() >= 400 && !r.url().endsWith('/favicon.ico')) errors.push(`${r.status()} ${r.url()}`); });
  await page.goto(url); await page.waitForFunction(() => window.__preview?.loaded || window.__preview?.error, null, { timeout: 120000 });
  const error = await page.evaluate(() => window.__preview.error); if (error) throw new Error(error);
  console.log(`Capturing ${label} (${commit}) →`);
  if (args.includes('--moodboard')) {
    const { image, names } = await page.evaluate(() => __preview.moodboard()); await save('swatches.png', image); console.log(`  swatches: ${names.join(' · ')}`);
  } else {
    for (const view of ['lock-portrait', 'lock-landscape', 'wide', 'plan', 'stands', 'gate', 'debris', 'lorarii', 'lorarii-wide', 'lorarii-plan', ...Array.from({ length: 12 }, (_, i) => 'crowd-' + i)]) await save(`${view}.png`, await page.evaluate(v => __preview.capture(v), view));
    await save('wide-empty.png', await page.evaluate(() => __preview.capture('wide', false)));
    const beats = await page.evaluate(() => __preview.lash()); for (const [beat, image] of Object.entries(beats)) await save(`lorarii-${beat}.png`, image);
    const measured = await page.evaluate(() => __preview.stats());
    // Transfer cost: gzip of the lane's sources (an upper bound on the arena's share of the shell; check-budget.mjs has the shell itself).
    const sources = ['src/arena.ts', ...(await fs.readdir('src/assets/arena', { withFileTypes: true }).catch(() => [])).filter(e => e.isFile()).map(e => `src/assets/arena/${e.name}`)];
    let sourceGzip = 0; for (const f of sources) sourceGzip += gzipSync(await fs.readFile(f)).length;
    const stats = { label, commit, date: new Date().toISOString().slice(0, 10), sourceGzip, ...measured };
    await fs.writeFile(`${dir}/stats.json`, JSON.stringify(stats, null, 1));
    const dust = await page.evaluate(() => __preview.dustPreview());
    if (!dust.visibleFrames || !dust.cleared || dust.peak > 48) throw new Error('Foot dust did not follow locomotion and expire: ' + JSON.stringify(dust));
    for (let i = 0; i < dust.frames.length; i++) await save('foot-dust-' + i + '.png', dust.frames[i]);
    delete dust.frames; await fs.writeFile(`${dir}/foot-dust.json`, JSON.stringify(dust, null, 2));
    const previous = against ? JSON.parse(await fs.readFile(`artifacts/world/${against}/stats.json`, 'utf8')) : null;
    const fmt = v => typeof v === 'number' ? (Number.isInteger(v) ? v.toLocaleString() : v.toFixed(3)) : String(v);
    const row = (name) => { const value = stats[name], delta = previous && typeof previous[name] === 'number' && typeof value === 'number' ? ` (${value - previous[name] >= 0 ? '+' : ''}${fmt(value - previous[name])})` : ''; return `| ${name} | ${fmt(value)}${delta} |`; };
    console.log(`\n| resource | ${label}${previous ? ` (Δ vs ${against})` : ''} |\n|---|---|\n${['sourceGzip', 'buildMs', 'readyMs', 'meshes', 'instances', 'triangles', 'textures', 'textureBytes', 'drawCallsArena', 'drawCallsArenaWide', 'drawCallsWithFighters', 'trianglesRenderedArena', 'floorLuminance', 'skinLuminance'].map(row).join('\n')}`);
  }
  if (errors.length) throw new Error(`Page errors:\n${errors.join('\n')}`);
} finally { await browser.close(); await server.close(); }
