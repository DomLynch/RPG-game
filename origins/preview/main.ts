import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { buildArena } from '../../src/arena.ts';
import { ARENA_THEMES } from '../../src/arena-themes.ts';
import { gaitWeights } from '../../src/characters.ts';
import { budgetTextures, FIGHTER_TEXTURE_CAP, phoneTier, pixelCap } from '../../src/quality.ts';
import { LEGEND_OPPONENTS } from '../../src/legends.ts';
import { careerLine, newSession, nextFight, outcomeOf, settle, started, type Finished, type PitFight, type PitSession, type Settled } from '../pit/pit.ts';
import { BANK_STEP_Z, buildExchange, FORGE, PASSAGE, walkable } from './exchange.ts';
import { exchangeAnchors, exchangePlan, openWest } from './exchange-plan.ts';
import { frontierBuild, frontierPlan, frontierWalkable, frontierZoneAt, onRoad, type Frontier } from './frontier-plan.ts';
import { buildFrontier } from './frontier.ts';
import { mobVariant } from './mob-looks.ts';
import { dressMob } from './mob-dress.ts';
import { mobSpecs, spawnAmong, type MobSpec } from './mobs.ts';
import { createCreatureCard } from './creature-card.ts';
import { FRONTIER_ROWS } from '../mobs/frontier-rows.ts';
import { frontierDress } from './frontier-dress.ts';
import { withCinder } from './frontier-cinder.ts';
import { demoCamps } from './frontier-camp.ts';
import { campFires } from './camp-fire.ts';
import { bountyQuest, bountyQuestId, giverTalk } from './bounty.ts';
import type { Mobs } from './mobs-view.ts';
import { ASSETS, play, SMITH_NAME, START_LEVEL, WORLD_TUNING as T, type Kind } from './play.ts';
import { CHECKING, fetchOpen, isOffline, loadAllegiance, previewCp, saveLine, storeAllegiance, storedToken, writerBase, type Source } from './save.ts';
import { picker, pickerOpen } from './allegiance.ts';
import { loadFailure } from './fight-load.ts';
import { STICK_R, intent, type Pad } from './sticks.ts';
import { wrapAngle } from '../../src/sim.ts';
import { applyLook, lookAlong, zoneEaser, zonePreset, type Look } from './look.ts';
import { creaturesLook } from '../../src/audio/creature.ts';

// The walk out (Origins look prototype): the Ash Pit exactly as the game builds it, its light recipe from scene.ts, then the passage, the
// Concord Exchange and the bank's front in greybox. You walk it: drag (up walks, sideways turns) or WASD / arrows. No tour (Dom 2026-10-06).
const theme = ARENA_THEMES['1'], PHONE = phoneTier();
const canvas = document.getElementById('view') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, pixelCap(PHONE)));
// iOS drops a WebGL context under GPU memory pressure and the screen goes black (Dom's iPhone 15, 2026-10-07). Log it, stop the page's default
// (so a restore is possible) and reload once the context comes back: the creatures' bodies are re-fetched and re-dressed from scratch.
canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); console.warn('origins-preview: webgl context lost'); (window as unknown as { __contextLost?: number }).__contextLost = Date.now(); });
canvas.addEventListener('webglcontextrestored', () => {   // at most one automatic reload a minute (a phone that loses it again must not loop and lose the hero's place each time); private mode: no storage, no reload
  try {
    const at = Number(sessionStorage.getItem('origins-preview.reloaded') ?? 0);
    if (Date.now() - at < 60_000) { console.warn('origins-preview: webgl context restored again within a minute; not reloading'); return; }
    sessionStorage.setItem('origins-preview.reloaded', String(Date.now()));
  } catch { return; }
  console.warn('origins-preview: webgl context restored; reloading'); location.reload();
});
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
const QA = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
const REGION = new URLSearchParams(location.search).get('region') === '1';
const frontier: Frontier | null = REGION ? frontierPlan() : null, frontierParts = frontier && frontierBuild(frontier);
const CINDER = /[?&]look=cinder\b/.test(location.search);   // ?look=cinder: the Frontier's ground carried past its edges, ground breakup, skyline silhouettes and a deeper haze (frontier-cinder.ts, look.ts 'cinder-haze'); a look test, absent = today's Frontier
const dress = frontier && frontierParts ? (CINDER ? withCinder(frontier, frontierParts, frontierDress(frontier, frontierParts)) : frontierDress(frontier, frontierParts)) : undefined;   // the Frontier's ground, rocks and ruins (frontier-dress.ts); its solids join the build's
if (dress && frontierParts) frontierParts.solids.push(...dress.solids);
const camps = frontier && frontierParts && /[?&]camps\b/.test(location.search) ? demoCamps(frontier, frontierParts, dress?.pieces) : [];   // ?camps: Expansion's generator drops these through placeCamp; this is the preview's stand-in
if (frontierParts) for (const c of camps) frontierParts.solids.push(...c.solids);
const exchangePieces = frontier ? openWest(exchangePlan(), exchangeAnchors(), frontier.road.from.z, frontier.road.width / 2 + 0.3) : undefined;
const arena = buildArena(scene, theme), exchange = buildExchange(scene, arena.materials, exchangePieces);
if (frontier && frontierParts) {
  buildFrontier(scene, arena.materials, frontierParts, dress, camps);
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
const fires = camps.length ? campFires(scene, camps) : null;   // ?camps: the Pit's flame at each fire (camp-fire.ts)

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
let mixer: THREE.AnimationMixer | undefined, gait: THREE.AnimationAction[] = [], rollAct: THREE.AnimationAction | undefined, guardAct: THREE.AnimationAction | undefined;   // the clips in gaitWeights() order: Idle, Walk, Jog, Run
new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(ASSETS.hero!).then((gltf) => {
  gltf.scene.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  if (PHONE) budgetTextures(gltf.scene, FIGHTER_TEXTURE_CAP);   // the game's iPhone black-fighters guard (characters.ts loadFighter)
  mixer = new THREE.AnimationMixer(gltf.scene);
  const clip = (name: string) => { const c = THREE.AnimationClip.findByName(gltf.animations, name); return c ? mixer!.clipAction(c) : undefined; };
  gait = ['Idle', 'Walk', 'Jog', 'Run'].map(clip).filter((a): a is THREE.AnimationAction => !!a);
  rollAct = clip('Roll'); guardAct = clip('Guard');   // the Pit's own clips on the same rig: ROLL and GUARD in the walk
  gait.forEach((a, i) => { a.play(); a.setEffectiveWeight(i === 0 ? 1 : 0); });
  hero.remove(body, cap); hero.add(gltf.scene);
}).catch((error: unknown) => console.warn('hero did not load; the capsule stands in', error));

let heading = Math.PI, pitchNow = 0, gaitSpeed = 0, camSnap = true;
const state = { x: 0, z: 3 }, keys = new Set<string>();
// ?region=1 starts him among the wandering creatures (Dom 2026-10-07: no bridge walk, no far start); linking the zones comes later.
const mobSpecList = frontier && frontierParts ? mobSpecs(frontier, frontierParts) : [], start = frontier && frontierParts ? spawnAmong(frontier, frontierParts, mobSpecList) : null;
if (start) { state.x = start.x; state.z = start.z; heading = start.facing; }
const hint = document.getElementById('hint')!, place = document.getElementById('place')!;
// The player's bars sit under the whole HUD stack (place, hint, creature card), however tall it wraps: index.html reads --hud-bottom.
new ResizeObserver(() => document.documentElement.style.setProperty('--hud-bottom', `${Math.ceil(document.getElementById('hud')!.getBoundingClientRect().bottom)}px`)).observe(document.getElementById('hud')!);
const creatureCard = createCreatureCard(document.getElementById('creature-card')!, mobSpecList, FRONTIER_ROWS, () => careerLine(session.career).level);
let cardClock = 0, cardId: string | null = null, hintMoved = false;   // the first-load hint is spent once a thumb has moved; the Journal hides it while open and gives it back after, unless spent
if (frontier) hint.textContent = 'Left thumb walks (push to the edge to run), right thumb looks. Creatures stop and watch when you come near.';
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
  if (kit) return;   // the Pit's kit walks (its own stick); there is no second stick
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
const show = (kind: Panel | null) => { const was = open; open = kind; if (kind === 'journal') hint.hidden = true; else if (was === 'journal' && !hintMoved) hint.hidden = false; shade.hidden = !kind; if (kind) card.innerHTML = kind === 'allegiance' ? picker.render(allegiance, playerName) : play.render(kind); };
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
const HAZE_PRESET = /[?&]look=night\b/.test(location.search) ? 'frontier-night' : CINDER ? 'cinder-haze' : 'frontier-haze';   // the flag looks; ?look=zonepreset swaps only the plain 'frontier-haze' for the zone's own row (a flag look wins inside every zone)
const FRONT_STOP = { at: -60, preset: HAZE_PRESET }, NEAR_STOP = { at: -20, preset: 'ash-pit' };   // mutable stops: ?look=zonepreset sets their presets from the zone each frame (zoneEase)
const ZONE1 = /[?&]look=zone1\b/.test(location.search), ZONE_LOOK = ZONE1 || REGION || /[?&]look=zones\b/.test(location.search),
  HAZE = REGION && !ZONE1 && !/[?&]look=zones\b/.test(location.search),
  LOOK_STOPS = ZONE1 ? [{ at: 0, preset: 'zone1' }] : HAZE ? [FRONT_STOP, NEAR_STOP] : [{ at: -10, preset: 'ash-pit' }, { at: -30, preset: 'exchange-dusk' }];   // ?region=1: the Pit's light to the west gate, the Frontier's haze by x -60 (the walk is along -x)
const GROUNDS = ZONE1 ? [exchange.ground] : [], STONES = ZONE1 ? [exchange.stone] : [];   // hoisted: applyLook runs every frame
let kit = false, worldPhase = 'ready', facing = 0, prevPose = 'ready', camLock = true, lockOn: { x: number; z: number } | null = null;   // kit: the Pit's controls are the walk's; camLock: the lock-on (the ☰ chip), saved per player
const STRIKES = new Set<string>(['light', 'light_left', 'light_right', 'heavy', 'thrust', 'kick', 'skill']), LOCK_M = 9, CAMLOCK_KEY = 'origins-preview.camera-lock.v1';
try { camLock = localStorage.getItem(CAMLOCK_KEY) !== 'off'; } catch { /* storage blocked: locked, the default */ }
const WALK = 2.3, RUN = 5.2, TURN = 1.9, eye = new THREE.Vector3(), look = new THREE.Vector3(), camAt = new THREE.Vector3(0, 2.6, 8);
function step(dt: number) {
  let running = !!held('ShiftLeft', 'ShiftRight'), forward = held('KeyW', 'ArrowUp') * (running ? 2 : 1) - held('KeyS', 'ArrowDown') * 0.6, turn = held('KeyA', 'ArrowLeft') - held('KeyD', 'ArrowRight'), strafe = 0, pitch = 0;
  if (open) forward = turn = 0;
  else if (kit) {   // the Pit's own controls (src/input.ts over the game's kit, pit-duel.ts world mode): stick walks, a button presses the nearest creature into a duel
    const i = duel!.worldIntent(), k = i.run ? 2 : 1;
    forward = Math.max(-0.6, Math.min(1, -i.z)) * k; strafe = Math.max(-1, Math.min(1, i.x)) * 0.7 * k; running = i.run;
    lockOn = camLock ? mobs?.nearest(state.x, state.z, LOCK_M) ?? null : null;
    if (lockOn) heading += wrapAngle(Math.atan2(lockOn.x - state.x, lockOn.z - state.z) - heading) * (1 - Math.exp(-6 * dt));   // the Pit's lock: the camera swings behind the hero to face it
    if (i.action && STRIKES.has(i.action)) pressEngage();   // an attack press engages; ROLL and GUARD (dodge, backstep, parry) are the walk's own, below
    const w = duel!.worldStep(dt, heading, i); worldPhase = w.phase; facing = w.facing;   // ROLL / GUARD: the Pit's own sim (pit-duel.ts worldStep), the ground a roll covers comes back as (dx, dz)
    if (w.dx || w.dz) { const rx = state.x + w.dx, rz = state.z + w.dz; if (canStand(rx, rz)) { state.x = rx; state.z = rz; } else if (canStand(rx, state.z)) state.x = rx; else if (canStand(state.x, rz)) state.z = rz; }
    if (worldPhase === 'roll' || worldPhase === 'backstep') { forward = strafe = 0; }   // the roll carries him; the stick does not add to it
  }
  else if (pads.move || pads.look) ({ forward, strafe, turn, pitch, running } = intent(pads.move, pads.look));   // the sticks win while a thumb is down
  if (forward || turn || strafe || pitch) { hint.hidden = true; hintMoved = true; }   // the first-load hint goes once you move (Lead 2026-10-06)
  heading += turn * TURN * dt;
  pitchNow = THREE.MathUtils.damp(pitchNow, pitch, 8, dt);   // the right stick's up/down tilts the camera and eases back when released
  // Forward is (sin h, cos h); right is (-cos h, sin h): heading grows to the LEFT, as in the keys' A.
  // A push up to a full walk is 2.3 m/s at the rim; a run (the move stick pushed past SPRINT_PUSH, or Shift) is the gait table's Run knot, 5.2 m/s.
  const px = state.x, pz = state.z, ground = running ? RUN / 2 : WALK;   // Intent.running, not a guess from the stick size
  const nx = state.x + (Math.sin(heading) * forward - Math.cos(heading) * strafe) * ground * dt, nz = state.z + (Math.cos(heading) * forward + Math.sin(heading) * strafe) * ground * dt;
  if (canStand(nx, nz)) { state.x = nx; state.z = nz; } else if (canStand(nx, state.z)) state.x = nx; else if (canStand(state.x, nz)) state.z = nz;
  if (state.z < -5) arena.raiseGate(true);
  if (ZONE_LOOK) sunHome.set(...applyLook(scene, renderer, sun, hemi, zoneEase(dt, () => lookAlong(HAZE ? state.x : state.z, LOOK_STOPS)), GROUNDS, STONES).sunPos);
  hero.position.set(state.x, 0, state.z); hero.rotation.y = kit && (worldPhase === 'roll' || worldPhase === 'backstep') ? facing : heading;
  body.position.y = 0.88 + (forward ? Math.abs(Math.sin(performance.now() / 160)) * 0.04 : 0);
  // The gait follows the speed he actually covers (collisions included): the Pit's own table, characters.ts gaitWeights (Idle/Walk/Jog/Run).
  if (mixer && gait.length === 4) {
    gaitSpeed += (Math.hypot(state.x - px, state.z - pz) / Math.max(dt, 1e-3) - gaitSpeed) * (1 - Math.exp(-dt * 14)); if (gaitSpeed < 0.015) gaitSpeed = 0;
    const w = gaitWeights(gaitSpeed), rolling = worldPhase === 'roll' || worldPhase === 'backstep', guarding = worldPhase === 'guard';
    if (worldPhase !== prevPose) {   // entering a pose starts its clip from the top
      if (rolling && rollAct) { rollAct.reset().setLoop(THREE.LoopOnce, 1); rollAct.clampWhenFinished = true; rollAct.play(); }
      if (guarding && guardAct) { guardAct.reset().setLoop(THREE.LoopRepeat, Infinity); guardAct.play(); }
      prevPose = worldPhase;
    }
    rollAct?.setEffectiveWeight(rolling ? 1 : 0); guardAct?.setEffectiveWeight(guarding ? 1 : 0);
    gait.forEach((a, i) => { a.setEffectiveWeight(rolling || guarding ? 0 : w[i]!); if (i) a.timeScale = forward < 0 ? -1 : 1; }); mixer.update(dt);
  }
  // Follow camera: behind and above; tighter and lower in the passage so it stays under the vault.
  const inPassage = state.z < -9 && state.z > PASSAGE.to - 1.5 && (!frontier || Math.abs(state.x) < 20), back = inPassage ? 3.4 : 5.2, up = (inPassage ? 2.1 : 2.7) - pitchNow * 0.9;   // the right stick's up lowers the camera and raises the gaze
  eye.set(state.x - Math.sin(heading) * back, up, state.z - Math.cos(heading) * back);
  if (camSnap) { camAt.copy(eye); camSnap = false; } else camAt.lerp(eye, 1 - Math.exp(-dt * 4));   // the first frame starts behind the hero, not at the old start easing over (slow phones showed a wall for ~10 s)
  look.set(state.x + Math.sin(heading) * 3, 1.5 + pitchNow * 1.6, state.z + Math.cos(heading) * 3);
  camera.position.copy(camAt); camera.lookAt(look);
  const atForge = Math.hypot(state.x - FORGE.x, state.z - FORGE.z) < 6;
  const zone = frontier && frontierZoneAt(frontier, state.x, state.z);
  showZone(zone ? zone.zone : null);
  if (frontier && frontierParts && !mobsAsked && (zone || onRoad(frontier, state.x, state.z))) {
    mobsAsked = true;
    void import('./mobs-view.ts').then((m) => { mobs = m.createMobs(scene, frontier, frontierParts, { phone: PHONE }); }).catch((error: unknown) => console.warn('the Frontier creatures did not load', error));
  }
  if (mobs) { mobs.update(dt, state, cardId); if ((cardClock += dt) > 0.2) { cardClock = 0; cardId = creatureCard.update((mobs.debug() as { mobs: { id: string; x: number; z: number; mode: string }[] }).mobs, state); } }
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
// ?look=zonepreset (default off, with ?region=1): each zone is lit with its own preset (look.ts zonePreset), eased over 1.5 s from the look on screen when the zone changes; off, the base look passes through untouched.
const ZONEPRESET = REGION && /[?&]look=(?:[^&]*,)?zonepreset\b/.test(location.search);
const zoneEasing = zoneEaser();
function zoneEase(dt: number, base: () => Look): Look {   // base: lookAlong over LOOK_STOPS, evaluated after the zone's presets are written into its stops
  if (!ZONEPRESET || !HAZE || !zoneNow) return base();
  FRONT_STOP.preset = HAZE_PRESET === 'frontier-haze' ? zonePreset(zoneNow.zone, zoneNow.preset) : HAZE_PRESET;
  NEAR_STOP.preset = zoneNow.preset === 'ash-pit' || zoneNow.preset === 'exchange-dusk' ? zoneNow.preset : 'ash-pit';
  return zoneEasing(dt, zoneNow.zone, base());
}
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
  fires?.update(time, state, warm);   // the camps' flames, and the Exchange's brazier lights lent to the nearest camps while the walker is among them (camp-fire.ts)
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
// ?region=1: the walk uses the Pit's controls exactly (Dom 2026-10-07). pit-duel.ts (its own chunk) binds the game's kit and src/input.ts in world mode; until
// it has loaded the old floating sticks still work, and if it never loads they stay. The ☰ menu's "Camera locked" chip is the lock-on, saved in this page's own key.
if (frontier) {
  duelLayer.classList.add('world'); duelLayer.hidden = false;
  void import('./pit-duel.ts').then((m) => {
    duel = m; m.enterWorld(leaveFight); kit = true; releaseSticks(); document.body.classList.add('kit');
    hint.textContent = 'Left stick walks (push to the edge to run). Walk up to a creature and press STAB, SLASH or HEAVY to fight it. Drag empty screen to look round when the camera lock is off.';
    // Dom's UI rule: the main screen is the combat HUD and the ☰ only, so the walk's Journal lives in the ☰'s Settings row (index.html hides the corner button).
    const menu = document.getElementById('journal') as HTMLDialogElement | null, chips = document.getElementById('mobile-sound')?.parentElement;
    if (menu && chips) {
      const entry = document.createElement('button'); entry.id = 'menu-journal'; entry.textContent = 'Journal';
      entry.addEventListener('click', () => { menu.close(); openPanel('journal'); });
      chips.append(entry);
      const pick = document.createElement('button'); pick.id = 'menu-allegiance'; pick.textContent = 'Allegiance';   // same rule: the corner button's job moves into the ☰, shown when the picker is open
      const sync = () => { pick.hidden = allegianceButton.hidden; }; sync(); new MutationObserver(sync).observe(allegianceButton, { attributes: true, attributeFilter: ['hidden'] });
      pick.addEventListener('click', () => { menu.close(); openPanel('allegiance'); });
      chips.append(pick);
    }
    const chip = document.getElementById('mobile-camera');
    const paint = () => { if (chip) { chip.textContent = camLock ? 'Camera locked' : 'Camera free'; chip.setAttribute('aria-pressed', String(camLock)); } };
    chip?.addEventListener('click', () => { camLock = !camLock; try { localStorage.setItem(CAMLOCK_KEY, camLock ? 'on' : 'off'); } catch { /* storage blocked */ } paint(); });
    paint();
  }).catch((error) => console.warn('the Pit controls did not load; the two sticks stay', error));
}
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
  const leaveButton = document.getElementById('leave')!; leaveButton.hidden = false; leaveButton.textContent = 'Leave the Pit';
  fighting = false; duel?.closeDuel(); document.getElementById('hunt-result')?.remove();
  duelLayer.hidden = !frontier; canvas.hidden = journalButton.hidden = false; showCareer(); keys.clear();
  if (frontier && duel) { duelLayer.classList.add('world'); duel.enterWorld(leaveFight); kit = true; lockOn = null; }   // back to the walk: the same kit, the walk's controls again
  clock.getDelta(); renderer.setAnimationLoop(walkLoop);
}
if (creaturesLook(location.search)) void import('./creature-voice.ts').then((m) => m.listenCreatures());   // ?look=creatures: the Frontier creatures' growl (a look test, default silent)
// ?region=1: the hunt. A quick tap on a creature (not a drag: that is a stick) walks you into a fight with it when it is near enough; the duel
// is Combat's (encounter-duel.ts), and hunt.ts sets it up and settles it through the encounters module (resolveFight, rollLoot, intoBackpack).
// A win clears the creature for a while, rolls its loot into the hunt's pack and pays the Bounty if you hold it. Memory only, like the page.
const REACH = 14, TAP_MS = 4000, TAP_PX = 12;   // m a creature may be tapped from; a tap is a press that stays put (a resting stick does nothing, so a slow one is still a tap: on a busy main thread the up event lands hundreds of ms after the down, measured 600 ms)
const tapLog: string[] = [], taps = new Map<number, { t: number; x: number; y: number; far: number; lx: number }>(), caster = new THREE.Raycaster(), ndc = new THREE.Vector2();
let hunt: import('./hunt.ts').Hunt | null = null, huntMod: typeof import('./hunt.ts') | null = null, encDuel: typeof import('./encounter-duel.ts') | null = null, sayTimer = 0;
function say(text: string) { hint.textContent = text; hint.hidden = false; clearTimeout(sayTimer); sayTimer = window.setTimeout(() => { hint.hidden = true; }, 5000); }
function showResult(text: string) {
  document.getElementById('leave')!.hidden = true;   // the end panel's own "Back to the fields" is the one way out
  document.getElementById('hunt-result')?.remove();
  const note = document.createElement('div'); note.id = 'hunt-result'; note.className = 'glass'; note.textContent = text;
  note.style.cssText = 'position:fixed;left:12px;right:12px;top:30%;z-index:5;padding:12px 14px;text-align:center;font:600 17px/1.4 Georgia,serif;pointer-events:none';
  duelLayer.append(note);
}
canvas.addEventListener('pointerdown', (e) => { taps.set(e.pointerId, { t: e.timeStamp, x: e.clientX, y: e.clientY, far: 0, lx: e.clientX }); });
canvas.addEventListener('pointermove', (e) => {
  const d = taps.get(e.pointerId); if (!d) return;
  d.far = Math.max(d.far, Math.hypot(e.clientX - d.x, e.clientY - d.y));
  const dx = e.clientX - d.lx; d.lx = e.clientX;   // the clientX delta: movementX is unreliable on WebKit touch
  if (kit && !fighting && !lockOn && d.far > TAP_PX) heading -= dx * 0.006;   // one finger dragged on empty screen looks round: free camera, no second stick
});   // the farthest the finger went: a stick drag that comes back to where it started is still a drag
canvas.addEventListener('pointerup', (e) => {
  const d = taps.get(e.pointerId); taps.delete(e.pointerId);
  const why = !d ? 'no-down' : !mobs ? 'no-mobs' : fighting ? 'fighting' : open ? `panel:${open}` : e.timeStamp - d.t > TAP_MS ? `hold:${Math.round(e.timeStamp - d.t)}ms` : Math.max(d.far, Math.hypot(e.clientX - d.x, e.clientY - d.y)) > TAP_PX ? `moved:${Math.round(d.far)}px` : '';
  tapLog.push(why || 'tap'); if (tapLog.length > 20) tapLog.shift();
  if (why === 'no-mobs' && mobsAsked && d && Math.max(d.far, Math.hypot(e.clientX - d.x, e.clientY - d.y)) <= TAP_PX && e.timeStamp - d.t <= TAP_MS) say('The creatures are still loading: try again in a moment.');   // a clean tap while the Frontier's creatures load (mobsAsked: the hero has reached the Frontier); the Exchange never says it
  if (why || !d) return;
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  caster.setFromCamera(ndc, camera);
  const hit = mobs.pick(caster.ray);
  if (hit) engage(hit.spec, hit.x, hit.z);
});
addEventListener('pointercancel', (e) => taps.delete(e.pointerId));
function engage(spec: MobSpec, x: number, z: number) {
  if (fighting) { say('A fight is already starting: wait a moment, or tap Back to the fields.'); return; }
  if (Math.hypot(x - state.x, z - state.z) > REACH) { say(`${spec.name} is too far off: walk closer, then tap.`); return; }
  void startMobFight(spec);
}
function pressEngage() {   // STAB / SLASH / HEAVY / KICK / SKILL near a creature starts the duel with the nearest one in reach; with none, it says what to do
  const t = mobs?.nearest(state.x, state.z, REACH);
  if (t) engage(t.spec, t.x, t.z); else say('Nothing in reach: walk up to a creature, then press STAB, SLASH or HEAVY.');
}
async function startMobFight(spec: MobSpec) {
  if (fighting || !frontier) { say(frontier ? 'A fight is already starting.' : 'There is nothing to fight here.'); return; }
  fighting = true; kit = false; duelLayer.classList.remove('world');   // claimed first: a second tap while the chunks load does nothing
  openPanel(null); keys.clear(); releaseSticks(); prompt.hidden = true; hint.hidden = true;
  duelLayer.hidden = false; canvas.hidden = journalButton.hidden = allegianceButton.hidden = true; place.textContent = `${spec.name}: a duel`;
  renderer.setAnimationLoop(null);
  document.getElementById('art-status')!.textContent = 'Loading…';
  try {   // a chunk that never arrives must not leave `fighting` set for good: 20 s and the catch below hands the hero back
    await Promise.race([(async () => { duel ??= await import('./pit-duel.ts'); huntMod ??= await import('./hunt.ts'); encDuel ??= await import('./encounter-duel.ts'); hunt ??= huntMod.newHunt(); })(), new Promise((_, no) => setTimeout(() => no(new Error('the fight chunks took over 20 s')), 20000))]);
  }
  catch (error) { console.warn('the fight did not load', error); leaveFight(); say('Could not load the fight. Tap the creature to try again.'); return; }
  const prepared = huntMod.prepare(hunt, spec);
  if (!prepared.ok) { console.warn('the fight cannot be set up', prepared.issues); leaveFight(); say('This creature cannot be fought yet.'); return; }
  if (!fighting) return;   // left while the chunks loaded
  const run = prepared.value, quest = bountyQuestId(frontier.giver);
  // ?foebar=N (a QA instrument, like ?gfx= and ?dpr=): the foe's health bar for this page, so a browser check can win a real duel quickly. Never set by the game. pit-duel only applies a bar when the setup carries the one-health-bar flag, which a plain creature lacks, so the flag is added here (the QA path only).
  const bar = QA ? Number(/[?&]foebar=(\d+)/.exec(location.search)?.[1]) || null : null;   // honoured on a local server only: on the live site it would be a cheat once kills persist
  void encDuel.startEncounterDuel(duelLayer, bar ? { ...run.setup, bar, combatFlags: [...run.setup.combatFlags, { kind: 'one-health-bar' }] } : run.setup, run.seed, (end) => {
    const out = huntMod!.settle(hunt!, spec, run, end, new Date().toISOString(), () => play.bountyOpen(quest));
    if (out.bounty) play.bountyPaid(quest, out.bounty.encounter);
    if (out.won) mobs?.fell(spec.id);
    showResult(out.text);
  }, leaveFight, { name: spec.name, level: spec.level, dress: (root) => { const look = mobVariant(spec.character, spec.id); if (look) dressMob(root, look, false); } });   // scale 1: the duel's own scale is the sim's, only the cloth is dressed
  const leaveButton = document.getElementById('leave')!; leaveButton.textContent = 'Back to the fields';
}
document.getElementById('leave')!.addEventListener('click', leaveFight);
(window as unknown as { originsPreview: unknown }).originsPreview = {
  pos: state, canStand, place: (x: number, z: number, h: number) => { state.x = x; state.z = z; heading = h; }, open: openPanel,
  // ?region=1: the zone you stand in (with its ambience preset), the Frontier layout's spots, and the Bounty giver's talk.
  region: () => frontier && { camps: camps.map((c) => ({ at: c.at, spots: c.spots })), zone: zoneNow, giver: frontier.giver.at, back: frontier.signs.find((s) => s.back)!.at, road: frontier.road, near,
    zones: frontier.zones.map((z) => ({ zone: z.zone, preset: z.preset, landmarks: z.landmarks })) },
  renderInfo: () => ({ triangles: renderer.info.render.triangles, calls: renderer.info.render.calls, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures }),   // the last frame's cost (perf checks)
  mobs: () => mobs?.debug() ?? null, pose: () => ({ worldPhase, rollClip: !!rollAct, guardClip: !!guardAct }),
  tapLog: () => [...tapLog],
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
