import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { buildArena } from '../../src/arena.ts';
import { ARENA_THEMES } from '../../src/arena-themes.ts';
import { budgetTextures, FIGHTER_TEXTURE_CAP, phoneTier, pixelCap } from '../../src/quality.ts';
import { LEGEND_OPPONENTS } from '../../src/legends.ts';
import { careerLine, newSession, nextFight, outcomeOf, settle, started, type Finished, type PitFight, type PitSession, type Settled } from '../pit/pit.ts';
import { BANK_STEP_Z, buildExchange, FORGE, PASSAGE, walkable } from './exchange.ts';
import { exchangeAnchors, exchangePlan, openWest } from './exchange-plan.ts';
import { frontierBuild, frontierPlan, frontierWalkable, frontierZoneAt, onRoad, type Frontier } from './frontier-plan.ts';
import { buildFrontier } from './frontier.ts';
import { bountyQuest, bountyQuestId, giverTalk } from './bounty.ts';
import type { MobSpec } from './mobs.ts';
import type { Mobs } from './mobs-view.ts';
import { ASSETS, play, SMITH_NAME, START_LEVEL, WORLD_TUNING as T, type Kind } from './play.ts';
import { CHECKING, fetchOpen, isOffline, loadAllegiance, previewCp, saveLine, storeAllegiance, storedToken, writerBase, type Source } from './save.ts';
import { picker, pickerOpen } from './allegiance.ts';
import { loadFailure } from './fight-load.ts';
import { STICK_R, intent, type Pad } from './sticks.ts';
import { applyLook, lookAlong } from './look.ts';

// The walk out (Origins look prototype): the Ash Pit exactly as the game builds it, its light recipe from scene.ts, then the passage, the
// Concord Exchange and the bank's front in greybox. You walk it: drag (up walks, sideways turns) or WASD / arrows. No tour (Dom 2026-10-06).
const theme = ARENA_THEMES['1'], PHONE = phoneTier();
const canvas = document.getElementById('view') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, pixelCap(PHONE)));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = theme.exposure;
const scene = new THREE.Scene();
scene.background = new THREE.Color(theme.fog);
scene.fog = new THREE.FogExp2(theme.fog, theme.fogDensity);
const camera = new THREE.PerspectiveCamera(51, 1, 0.1, 180);
const hemi = new THREE.HemisphereLight(...theme.hemisphere); scene.add(hemi);
const sun = new THREE.DirectionalLight(...theme.sun), sunHome = new THREE.Vector3(...(theme.light?.sun ?? [-15, 26, -18]));
sun.castShadow = true; sun.shadow.mapSize.set(PHONE ? 1024 : 2048, PHONE ? 1024 : 2048); sun.shadow.normalBias = 0.04;
Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, near: 1, far: 90 });
scene.add(sun, sun.target);

// ?region=1 (Origins slice 1): the Exchange's west gate opens onto the Ash Frontier, laid out from the Region 1 data (frontier-plan.ts).
// Without the flag none of it is built and the page is the walk out as before.
const REGION = new URLSearchParams(location.search).get('region') === '1';
const frontier: Frontier | null = REGION ? frontierPlan() : null, frontierParts = frontier && frontierBuild(frontier);
const exchangePieces = frontier ? openWest(exchangePlan(), exchangeAnchors(), frontier.road.from.z, frontier.road.width / 2 + 0.3) : undefined;
const arena = buildArena(scene, theme), exchange = buildExchange(scene, arena.materials, exchangePieces);
if (frontier && frontierParts) {
  buildFrontier(scene, arena.materials, frontierParts);
  play.enableBounty(bountyQuest(frontier.giver), giverTalk(frontier.giver), frontier.giver.name);
}
// ?region=1: the Frontier's creatures (mobs.ts, drawn by mobs-view.ts). Their chunk and their body files are fetched only once the walker first
// steps onto the west road, never on the Pit/Exchange-only page.
let mobs: Mobs | null = null, mobsAsked = false;
const canStand = (x: number, z: number) => walkable(x, z) || (!!frontier && !!frontierParts && frontierWalkable(frontier, frontierParts, x, z));
// Preview-only: Arena 1's painted far world is a ring ~40 m out, and the Exchange stands beyond it. Open the ring where the gate faces (−z)
// so the Pit looks out onto the Exchange; the painting keeps the other 290°. A look question for Dom, not a change to arena.ts.
const GAP = 0.62;   // radians either side of the gate
arena.group.traverse((o) => {
  if (o.name !== 'backdrop' || !(o instanceof THREE.Mesh)) return;
  o.geometry.dispose();
  o.geometry = new THREE.CylinderGeometry(40, 40, 40, 64, 1, true, Math.PI - o.rotation.y + GAP, Math.PI * 2 - GAP * 2);   // local angle: the ring is turned by theme.backdropTurn
});
function environment(sky?: THREE.Texture) {
  const pmrem = new THREE.PMREMGenerator(renderer), room = sky ? null : new RoomEnvironment();
  scene.environment = (room ? pmrem.fromScene(room, 0.04) : pmrem.fromEquirectangular(sky!)).texture;
  scene.environmentIntensity = room ? 0.45 : 1; room?.dispose(); pmrem.dispose();
}
environment(); void arena.ready.then(() => environment(arena.sky));
const forgeGlow = new THREE.PointLight('#ff7a2a', 14, 10, 1.6); forgeGlow.position.copy(exchange.hearth); scene.add(forgeGlow);
const warm = exchange.braziers.slice(0, PHONE ? 2 : 4).map((b) => { const l = new THREE.PointLight('#ff8a3a', 9, 9, 1.8); l.position.set(b.x, 1.9, b.z); scene.add(l); return l; });

// The walker: the game's own hero (src/assets/warrior.glb, Dom 2026-10-06 "use our real char"), Idle and Walk from his rig. The capsule
// holds his place until the file lands, and stays if it never does.
const hero = new THREE.Group();
const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 1.15, 4, 12), new THREE.MeshStandardMaterial({ color: '#4a3b2e', roughness: 0.9 }));
body.position.y = 0.88; body.castShadow = true;
const cap = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#ad9365', metalness: 0.65, roughness: 0.45 }));
cap.position.y = 1.62; hero.add(body, cap); scene.add(hero);
// ?region=1: the Bounty giver, a figure in the townsfolk's capsule style at his hall, facing the town's centre.
if (frontier) {
  const g = frontier.giver, giver = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 1.2, 4, 10), new THREE.MeshStandardMaterial({ color: '#6b3a22', roughness: 0.9 }));
  giver.position.set(g.at.x, 0.9, g.at.z); giver.castShadow = true; scene.add(giver);
}
// Greybox stand-ins for the assets map's null entries: Orla at her anvil (a figure in the envoys' capsule style) and the ore cart's pile.
const orla = new THREE.Mesh(new THREE.CapsuleGeometry(T.orla.radius, T.orla.length, 4, 10), body.material);
orla.position.set(T.orla.x, T.orla.radius + T.orla.length / 2, T.orla.z); orla.castShadow = true;
const ore = new THREE.Mesh(new THREE.DodecahedronGeometry(T.orePile.radius, 0), arena.materials.stone); ore.scale.y = 0.5;
ore.position.set(T.orePile.x, T.orePile.radius / 2, T.orePile.z); ore.castShadow = true; scene.add(orla, ore);
let mixer: THREE.AnimationMixer | undefined, idle: THREE.AnimationAction | undefined, walk: THREE.AnimationAction | undefined;
new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(ASSETS.hero!).then((gltf) => {
  gltf.scene.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  if (PHONE) budgetTextures(gltf.scene, FIGHTER_TEXTURE_CAP);   // the game's iPhone black-fighters guard (characters.ts loadFighter)
  mixer = new THREE.AnimationMixer(gltf.scene);
  const clip = (name: string) => { const c = THREE.AnimationClip.findByName(gltf.animations, name); return c ? mixer!.clipAction(c) : undefined; };
  idle = clip('Idle'); walk = clip('Walk');
  idle?.play(); walk?.play(); walk?.setEffectiveWeight(0);
  hero.remove(body, cap); hero.add(gltf.scene);
}).catch((error: unknown) => console.warn('hero did not load; the capsule stands in', error));

let heading = Math.PI, pitchNow = 0;
const state = { x: 0, z: 3 }, keys = new Set<string>();
const hint = document.getElementById('hint')!, place = document.getElementById('place')!;
if (frontier) hint.textContent = 'Left thumb walks (push to the edge to run), right thumb looks around. Region 1: the west road leaves through the left colonnade to the Ash Frontier; Cinder Hold has a Bounty. Creatures roam the fields now: they stop and watch when you come near.';
// Two sticks: the left half of the screen walks, the right half looks (sticks.ts). Each is a floating pad anchored where its thumb lands, tracked
// by its own pointer id so both thumbs work at once; the rings rest at the bottom corners and move to the thumb while it is down.
type Side = 'move' | 'look';
const pads: Record<Side, Pad> = { move: null, look: null }, padIds: Record<Side, number> = { move: -1, look: -1 };
const rings: Record<Side, HTMLElement> = { move: document.getElementById('move-stick')!, look: document.getElementById('look-stick')! };
const knobs: Record<Side, HTMLElement> = { move: rings.move.firstElementChild as HTMLElement, look: rings.look.firstElementChild as HTMLElement };
const sideOf = (x: number): Side => x < innerWidth / 2 ? 'move' : 'look';
function releaseStick(side: Side) {
  pads[side] = null; padIds[side] = -1; rings[side].classList.remove('on');
  rings[side].style.left = rings[side].style.top = ''; knobs[side].style.transform = '';
}
const releaseSticks = () => { releaseStick('move'); releaseStick('look'); };
canvas.addEventListener('pointerdown', (e) => {
  const side = sideOf(e.clientX);
  if (pads[side]) return;   // that thumb is already down; a second finger on the same half is ignored
  pads[side] = { x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY }; padIds[side] = e.pointerId;
  rings[side].classList.add('on'); Object.assign(rings[side].style, { left: `${e.clientX}px`, top: `${e.clientY}px` });
  try { canvas.setPointerCapture(e.pointerId); } catch { /* no live pointer (a synthetic event): the pad still works without capture */ }
});
canvas.addEventListener('pointermove', (e) => {
  for (const side of ['move', 'look'] as const) {
    const pad = pads[side]; if (!pad || padIds[side] !== e.pointerId) continue;
    pad.x = e.clientX; pad.y = e.clientY;
    const dx = pad.x - pad.x0, dy = pad.y - pad.y0, len = Math.hypot(dx, dy), k = len > STICK_R ? STICK_R / len : 1;   // the knob stops at the rim
    knobs[side].style.transform = `translate(${dx * k}px, ${dy * k}px)`;
  }
});
for (const end of ['pointerup', 'pointercancel'] as const) canvas.addEventListener(end, (e) => { for (const side of ['move', 'look'] as const) if (padIds[side] === e.pointerId) releaseStick(side); });
addEventListener('keydown', (e) => keys.add(e.code)); addEventListener('keyup', (e) => keys.delete(e.code)); addEventListener('blur', () => keys.clear());
const held = (...codes: string[]) => codes.some((c) => keys.has(c)) ? 1 : 0;

// Tap-to-open: the prompt opens what you stand near; panels are play.ts's (rules modules) built with the ui.ts kit.
const prompt = document.getElementById('prompt')!, shade = document.getElementById('shade')!, card = document.getElementById('card')!;
const NEAR: Partial<Record<Kind | 'fight' | 'back', string>> = { talk: `Talk to ${SMITH_NAME}`, bank: 'Bank — tap to open', ore: 'Take the ore', fight: 'Fight in the Pit',
  bounty: `Talk to ${frontier?.giver.name ?? ''}`, back: 'Take the road back to the Exchange' };
type Panel = Kind | 'allegiance';
let near: Kind | 'fight' | 'back' | null = null, open: Panel | null = null;
// ?region=1: the way back, from the Frontier's signpost to the Exchange's west gate, facing into the plaza.
const goBack = () => { if (!frontier) return; const r = frontier.road; state.x = r.from.x + Math.sin(r.inward) * 2; state.z = r.from.z + Math.cos(r.inward) * 2; heading = r.inward; };
const tapNear = () => { if (near === 'fight') void startFight(); else if (near === 'back') goBack(); else openPanel(near); };
const show = (kind: Panel | null) => { open = kind; shade.hidden = !kind; if (kind) card.innerHTML = kind === 'allegiance' ? picker.render(allegiance, playerName) : play.render(kind); };
function openPanel(kind: Panel | null) {
  play.fresh(); picker.reset(); if (kind === 'ore') play.takeOre();
  show(kind); if (kind) { keys.clear(); releaseSticks(); }
}
card.addEventListener('click', (e) => {
  if (open === 'allegiance') {
    const el = (e.target as Element).closest<HTMLElement>('[data-view],[data-choose]');
    const next = el && picker.act(el.dataset, allegiance, careerLine(session.career).level, Date.now() / 1000);
    if (next) { allegiance = next; storeAllegiance(storage, next); }
    show('allegiance');
  } else if (open) show(play.act((e.target as Element).closest<HTMLElement>('[data-say],[data-item],[data-do],[data-go]'), open));
});
document.getElementById('allegiance')!.addEventListener('click', () => openPanel('allegiance'));
document.getElementById('walk-journal')!.addEventListener('click', () => openPanel('journal'));
for (const el of [prompt, shade]) el.addEventListener('pointerdown', (e) => e.stopPropagation());
prompt.addEventListener('click', tapNear);
shade.addEventListener('click', (e) => { if (e.target === shade || (e.target as Element).id === 'shut') openPanel(null); });
addEventListener('keydown', (e) => {
  if (fighting) return;   // the duel's own keys (src/input.ts) own the keyboard while it is up
  if (e.code === 'Escape') openPanel(null); else if (e.code === 'KeyE' && near && !open) tapNear();
});

// Zone look (look.ts, World lane): the Pit's own light to the gate, a lamp-lit dusk in the Exchange, blended along the passage. Behind ?look=zones until the region flag carries it (a look test; absent = today's light).
const ZONE1 = /[?&]look=zone1\b/.test(location.search), ZONE_LOOK = ZONE1 || /[?&]look=zones\b/.test(location.search), LOOK_STOPS = ZONE1 ? [{ at: 0, preset: 'zone1' }] : [{ at: -10, preset: 'ash-pit' }, { at: -30, preset: 'exchange-dusk' }];
const GROUNDS = ZONE1 ? [exchange.ground] : [], STONES = ZONE1 ? [exchange.stone] : [];   // hoisted: applyLook runs every frame
const WALK = 2.3, TURN = 1.9, eye = new THREE.Vector3(), look = new THREE.Vector3(), camAt = new THREE.Vector3(0, 2.6, 8);
function step(dt: number) {
  let forward = held('KeyW', 'ArrowUp') * (held('ShiftLeft', 'ShiftRight') ? 2 : 1) - held('KeyS', 'ArrowDown') * 0.6, turn = held('KeyA', 'ArrowLeft') - held('KeyD', 'ArrowRight'), strafe = 0, pitch = 0;
  if (open) forward = turn = 0;
  else if (pads.move || pads.look) ({ forward, strafe, turn, pitch } = intent(pads.move, pads.look));   // the sticks win while a thumb is down
  if (forward || turn || strafe) hint.hidden = true;   // the first-load hint goes once you move (Lead 2026-10-06)
  heading += turn * TURN * dt;
  pitchNow = THREE.MathUtils.damp(pitchNow, pitch, 8, dt);   // the right stick's up/down tilts the camera and eases back when released
  // Forward is (sin h, cos h); right is (-cos h, sin h): heading grows to the LEFT, as in the keys' A.
  const nx = state.x + (Math.sin(heading) * forward - Math.cos(heading) * strafe) * WALK * dt, nz = state.z + (Math.cos(heading) * forward + Math.sin(heading) * strafe) * WALK * dt;
  if (canStand(nx, nz)) { state.x = nx; state.z = nz; } else if (canStand(nx, state.z)) state.x = nx; else if (canStand(state.x, nz)) state.z = nz;
  if (state.z < -5) arena.raiseGate(true);
  if (ZONE_LOOK) sunHome.set(...applyLook(scene, renderer, sun, hemi, lookAlong(state.z, LOOK_STOPS), GROUNDS, STONES).sunPos);
  hero.position.set(state.x, 0, state.z); hero.rotation.y = heading;
  body.position.y = 0.88 + (forward ? Math.abs(Math.sin(performance.now() / 160)) * 0.04 : 0);
  if (mixer && idle && walk) { const w = THREE.MathUtils.damp(walk.getEffectiveWeight(), Math.abs(forward) + Math.abs(strafe) > 0.05 ? 1 : 0, 8, dt); walk.setEffectiveWeight(w); idle.setEffectiveWeight(1 - w); walk.timeScale = (forward < 0 ? -1 : 1) * (forward > 1.2 || Math.abs(strafe) > 1.2 ? 1.6 : 1); mixer.update(dt); }
  // Follow camera: behind and above; tighter and lower in the passage so it stays under the vault.
  const inPassage = state.z < -9 && state.z > PASSAGE.to - 1.5 && (!frontier || Math.abs(state.x) < 20), back = inPassage ? 3.4 : 5.2, up = (inPassage ? 2.1 : 2.7) - pitchNow * 0.9;   // the right stick's up lowers the camera and raises the gaze
  eye.set(state.x - Math.sin(heading) * back, up, state.z - Math.cos(heading) * back);
  camAt.lerp(eye, 1 - Math.exp(-dt * 4));
  look.set(state.x + Math.sin(heading) * 3, 1.5 + pitchNow * 1.6, state.z + Math.cos(heading) * 3);
  camera.position.copy(camAt); camera.lookAt(look);
  const atForge = Math.hypot(state.x - FORGE.x, state.z - FORGE.z) < 6;
  const zone = frontier && frontierZoneAt(frontier, state.x, state.z);
  showZone(zone ? zone.zone : null);
  if (frontier && frontierParts && !mobsAsked && (zone || onRoad(frontier, state.x, state.z))) {
    mobsAsked = true;
    void import('./mobs-view.ts').then((m) => { mobs = m.createMobs(scene, frontier, frontierParts, { phone: PHONE }); }).catch((error: unknown) => console.warn('the Frontier creatures did not load', error));
  }
  if (mobs) mobs.update(dt, state);
  place.textContent = zone ? zone.name : frontier && state.x < -19.5 ? 'The West Road' : atForge ? 'The Blacksmith' : state.z > -11 ? 'The Pit' : state.z > PASSAGE.to ? 'The Gladiator Gate' : state.z > -58 ? 'The Concord Exchange' : 'The Exchange — the bank';
  const g = frontier?.giver, sign = frontier?.signs.find((s) => s.back);
  near = g && Math.hypot(state.x - g.at.x, state.z - g.at.z) < T.reach.forge ? 'bounty'
    : sign && Math.hypot(state.x - sign.at.x, state.z - sign.at.z) < 6 ? 'back'
    : Math.hypot(state.x, state.z) < T.reach.pit ? 'fight'
    : Math.hypot(state.x - T.orePile.x, state.z - T.orePile.z) < T.reach.ore && play.oreWanted() ? 'ore'
    : Math.max(Math.abs(state.x - FORGE.x) - FORGE.halfX, Math.abs(state.z - FORGE.z) - FORGE.halfZ) < T.reach.forge ? 'talk'
    : state.z < BANK_STEP_Z + T.reach.bank && Math.abs(state.x) < T.reach.bankHalfWidth ? 'bank' : null;
  prompt.hidden = !near || !!open; if (near) prompt.textContent = NEAR[near]!;
  sun.position.copy(hero.position).add(sunHome); sun.target.position.copy(hero.position);
}

// ?region=1: the zone you stand in and its ambience.preset, for the look (the World lane's look.ts listens for `origins:zone`; this page
// sets no light, fog or sky). Off the Frontier the Exchange's own data names the preset (exchange-dusk; the Pit's ash-pit).
let zoneNow: { region: string; zone: string; name: string; preset: string } | null = null;
function showZone(id: string | null) {
  if (!frontier) return;
  const z = frontier.zones.find((q) => q.zone === (id ?? (state.z > PASSAGE.to ? 'pit-yard' : 'exchange')))!;
  if (zoneNow?.zone === z.zone) return;
  zoneNow = { region: z.region, zone: z.zone, name: z.name, preset: z.preset };
  document.body.dataset.ambience = z.preset; dispatchEvent(new CustomEvent('origins:zone', { detail: zoneNow }));
}

function resize() {
  const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();
const clock = new THREE.Clock();
const walkLoop = () => {
  const dt = Math.min(clock.getDelta(), 0.05), time = clock.elapsedTime;
  step(dt); arena.update(dt, [], camera); exchange.update(time);
  forgeGlow.intensity = 14 * (0.8 + 0.2 * Math.sin(time * 7.1) * Math.sin(time * 3.7));
  warm.forEach((l, i) => { l.intensity = 9 * (0.85 + 0.15 * Math.sin(time * 9 + i * 2.1) * Math.sin(time * 5.3 + i)); });
  renderer.render(scene, camera);
};
renderer.setAnimationLoop(walkLoop);

// The Pit duel: the arena's real fight (pit-duel.ts, its own chunk, loaded on the first fight) over the walk, which stops drawing meanwhile.
// The rules are origins/pit/pit.ts: the legend at the career level, and a win settled through the progression model's award(). All of it is
// this page's memory. The one thing read from outside is the player's saved career (save.ts: the writer's `open`, read-only, with the stored
// session's token); nothing here writes the game's storage, account or fight results, and no duel result is ever sent anywhere. The one
// thing the page keeps is its own: the graduation allegiance, under save.ts ALLEGIANCE_KEY (never a `frankendom.*` key).
let session: PitSession = newSession(START_LEVEL), fight: PitFight | null = null, last: Settled | null = null, fighting = false;
let source: Source = CHECKING;
let duel: typeof import('./pit-duel.ts') | null = null, duelFailed = false;
const duelLayer = document.getElementById('duel')!, career = document.getElementById('career')!, journalButton = document.getElementById('walk-journal')!;
const saveNote = document.getElementById('save')!, allegianceButton = document.getElementById('allegiance')!;
// The graduation picker (allegiance.ts): only on the SAVED career at Gladiator or above; the choice lives in the preview's own save.
let storage: Storage | null = null;
try { storage = localStorage; } catch { /* storage blocked: no session, no saved allegiance */ }
let allegiance = loadAllegiance(storage), playerName = 'You';
function showCareer() {
  allegianceButton.hidden = fighting || !pickerOpen('saved' in source, careerLine(session.career).level);
  const c = careerLine(session.career), extra = 'saved' in source ? previewCp(source, session.career) : last?.award?.cp ?? 0;
  career.textContent = `Level ${c.level} · ${c.top ? `${c.credit} CP` : `${c.into} / ${c.need} CP`}${extra ? ` · +${extra} CP (preview)` : ''}`;
  saveNote.textContent = saveLine(source);
}
showCareer();
// The saved career, once, in the background: the walk and the Pit never wait on it. It is adopted only while no duel has started, so a
// preview fight is never re-based under the player; otherwise (or on any failure) the in-memory preview career stands, marked offline.
void fetchOpen(storedToken(storage, Date.now()), { base: writerBase(location.search) }).then((opened) => {
  if (isOffline(opened)) source = opened;
  else if (session.fights > 0 || fighting) source = { offline: 'late' };
  else { session = { career: opened.career, settled: new Set(), fights: 0 }; source = { saved: opened.career }; last = null; playerName = opened.characters[0]?.name ?? playerName; play.standAt(careerLine(session.career).level); }
  showCareer();
});
async function startFight(pick?: string): Promise<PitFight | null> {
  if (duelFailed) { location.reload(); return null; }   // a browser keeps a failed import's error for the page's life, so the retry is a fresh page
  const next = nextFight(session, LEGEND_OPPONENTS, session.career.pitWins, pick);
  if (!next) return null;
  const before = session;
  session = started(session); fight = next; last = null; showCareer();
  openPanel(null); keys.clear(); releaseSticks(); prompt.hidden = true; hint.hidden = true;
  fighting = true; duelLayer.hidden = false; canvas.hidden = journalButton.hidden = allegianceButton.hidden = true; place.textContent = 'The Pit — a duel';
  renderer.setAnimationLoop(null);
  document.getElementById('art-status')!.textContent = 'Loading…';   // the arena is black until its art is in; the scene clears this when ready (Lead 2026-10-06)
  try { duel ??= await import('./pit-duel.ts'); } catch {
    // the chunk did not load (offline, a stale deploy): the fight not counted (even if the player left meanwhile), back to the walk with the
    // retry hint if still in the duel; a failure for a fight since replaced does nothing (fight-load.ts)
    const failed = loadFailure(fight === next, fighting);
    if (failed !== 'none') {
      duelFailed = true; session = before; fight = null;
      if (failed === 'restore-and-hint') leaveFight();
      showCareer();
      if (failed === 'restore-and-hint') { hint.textContent = 'Could not load the duel. Tap “Fight in the Pit” to retry.'; hint.hidden = false; }
    }
    return null;
  }
  if (!fighting || fight !== next) return next;   // left (or restarted) while the chunk loaded
  duel.openDuel(duelLayer, next, { ended: settleFight, again: () => void startFight() }, leaveFight);
  return next;
}
function settleFight(finish: Finished) {
  const outcome = outcomeOf(finish);
  if (!outcome || !fight) return;
  last = settle(session, fight, outcome, Date.now() / 1000);
  session = last.session; play.standAt(careerLine(session.career).level); showCareer();
  const after = nextFight(session, LEGEND_OPPONENTS, session.career.pitWins);
  return { next: after?.legend && duel ? duel.legendName(after.opponent, after.level) : undefined };
}
function leaveFight() {
  if (!fighting) return;
  fighting = false; duel?.closeDuel(); document.getElementById('hunt-result')?.remove();
  duelLayer.hidden = true; canvas.hidden = journalButton.hidden = false; showCareer(); keys.clear();
  clock.getDelta(); renderer.setAnimationLoop(walkLoop);
}
// ?region=1: the hunt. A quick tap on a creature (not a drag: that is a stick) walks you into a fight with it when it is near enough; the duel
// is Combat's (encounter-duel.ts), and hunt.ts sets it up and settles it through the encounters module (resolveFight, rollLoot, intoBackpack).
// A win clears the creature for a while, rolls its loot into the hunt's pack and pays the Bounty if you hold it. Memory only, like the page.
const REACH = 14, TAP_MS = 350, TAP_PX = 12;   // m a creature may be tapped from; a tap is shorter and stiller than this
const taps = new Map<number, { t: number; x: number; y: number }>(), caster = new THREE.Raycaster(), ndc = new THREE.Vector2();
let hunt: import('./hunt.ts').Hunt | null = null, huntMod: typeof import('./hunt.ts') | null = null, encDuel: typeof import('./encounter-duel.ts') | null = null, sayTimer = 0;
function say(text: string) { hint.textContent = text; hint.hidden = false; clearTimeout(sayTimer); sayTimer = window.setTimeout(() => { hint.hidden = true; }, 5000); }
function showResult(text: string) {
  document.getElementById('hunt-result')?.remove();
  const note = document.createElement('div'); note.id = 'hunt-result'; note.className = 'glass'; note.textContent = text;
  note.style.cssText = 'position:fixed;left:12px;right:12px;top:30%;z-index:5;padding:12px 14px;text-align:center;font:600 17px/1.4 Georgia,serif;pointer-events:none';
  duelLayer.append(note);
}
canvas.addEventListener('pointerdown', (e) => { taps.set(e.pointerId, { t: performance.now(), x: e.clientX, y: e.clientY }); });
canvas.addEventListener('pointerup', (e) => {
  const d = taps.get(e.pointerId); taps.delete(e.pointerId);
  if (!d || !mobs || fighting || open || performance.now() - d.t > TAP_MS || Math.hypot(e.clientX - d.x, e.clientY - d.y) > TAP_PX) return;
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  caster.setFromCamera(ndc, camera);
  const hit = mobs.pick(caster.ray);
  if (hit) engage(hit.spec, hit.x, hit.z);
});
addEventListener('pointercancel', (e) => taps.delete(e.pointerId));
function engage(spec: MobSpec, x: number, z: number) {
  if (fighting) return;
  if (Math.hypot(x - state.x, z - state.z) > REACH) { say(`${spec.name} is too far off: walk closer, then tap.`); return; }
  void startMobFight(spec);
}
async function startMobFight(spec: MobSpec) {
  if (fighting || !frontier) return;
  fighting = true;   // claimed first: a second tap while the chunks load does nothing
  openPanel(null); keys.clear(); releaseSticks(); prompt.hidden = true; hint.hidden = true;
  duelLayer.hidden = false; canvas.hidden = journalButton.hidden = allegianceButton.hidden = true; place.textContent = `${spec.name}: a duel`;
  renderer.setAnimationLoop(null);
  document.getElementById('art-status')!.textContent = 'Loading…';
  try { duel ??= await import('./pit-duel.ts'); huntMod ??= await import('./hunt.ts'); encDuel ??= await import('./encounter-duel.ts'); hunt ??= huntMod.newHunt(); }
  catch (error) { console.warn('the fight did not load', error); leaveFight(); say('Could not load the fight. Tap the creature to try again.'); return; }
  const prepared = huntMod.prepare(hunt, spec);
  if (!prepared.ok) { console.warn('the fight cannot be set up', prepared.issues); leaveFight(); say('This creature cannot be fought yet.'); return; }
  if (!fighting) return;   // left while the chunks loaded
  const run = prepared.value, quest = bountyQuestId(frontier.giver);
  void encDuel.startEncounterDuel(duelLayer, run.setup, run.seed, (end) => {
    const out = huntMod!.settle(hunt!, spec, run, end, new Date().toISOString(), () => play.bountyOpen(quest));
    if (out.bounty) play.bountyPaid(quest, out.bounty.encounter);
    if (out.won) mobs?.fell(spec.id);
    showResult(out.text);
  }, leaveFight);
}
document.getElementById('leave')!.addEventListener('click', leaveFight);
(window as unknown as { originsPreview: unknown }).originsPreview = {
  pos: state, place: (x: number, z: number, h: number) => { state.x = x; state.z = z; heading = h; }, open: openPanel,
  // ?region=1: the zone you stand in (with its ambience preset), the Frontier layout's spots, and the Bounty giver's talk.
  region: () => frontier && { zone: zoneNow, giver: frontier.giver.at, back: frontier.signs.find((s) => s.back)!.at, road: frontier.road, near,
    zones: frontier.zones.map((z) => ({ zone: z.zone, preset: z.preset, landmarks: z.landmarks })) },
  mobs: () => mobs?.debug() ?? null,
  // tap a creature by id as the page would (same reach rule); hunt() is the memory of the hunt: kills, the pack, the metal.
  tapMob: (id: string) => { const m = mobs?.find(id); if (!m) return false; engage(m.spec, m.x, m.z); return true; },
  // where a creature is on screen (CSS px), for a real touch tap in a browser check; null while it is down or off screen.
  mobScreen: (id: string) => { const m = mobs?.find(id); if (!m) return null; const v = new THREE.Vector3(m.x, 1, m.z).project(camera), r = canvas.getBoundingClientRect(); return v.z > 1 || Math.abs(v.x) > 1 || Math.abs(v.y) > 1 ? null : { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height }; },
  hunt: () => hunt && { kills: hunt.kills, metal: hunt.metal, bountyWins: hunt.bountyWins, pack: hunt.inventory.items.map((i) => `${i.item}×${i.quantity}`) },
  bounty: (i: number) => { if (open !== 'bounty') openPanel('bounty'); const line = play.lines('bounty')[i]; if (line) { play.say(line.id, 'bounty'); show('bounty'); } return line?.id; },
  talk: (i: number) => { if (open !== 'talk') openPanel('talk'); const line = play.lines()[i]; if (line) { play.say(line.id); show('talk'); } return line?.id; },
  journal: () => openPanel('journal'), state: play.state,
  allegiance: () => ({ open: !allegianceButton.hidden, state: allegiance }), pickAllegiance: () => openPanel('allegiance'),
  // The Pit duel: fight() starts one (a legend id picks it, else the Pit's next); duel() is the fight now; career() the Origins career and
  // the last settlement; leave() goes back to the walk; reset(level) starts the preview career over at a level (test setup, memory only).
  fight: (pick?: string) => startFight(pick),
  duel: () => duel?.duelState() ?? null,
  career: () => ({ ...careerLine(session.career), source: 'saved' in source ? 'saved' : 'offline', offline: 'offline' in source ? source.offline : null, previewCp: previewCp(source, session.career), pitWins: session.career.pitWins, beaten: [...session.career.beaten], fights: session.fights, fighting,
    last: last && { outcome: last.outcome, cp: last.award?.cp ?? 0, reason: last.award?.reason ?? null, levelBefore: last.award?.levelBefore ?? null, levelAfter: last.award?.levelAfter ?? null } }),
  leave: leaveFight,
  reset: (level: number) => { session = newSession(level); source = { offline: 'reset' }; last = null; play.standAt(careerLine(session.career).level); showCareer(); return careerLine(session.career); },
};
