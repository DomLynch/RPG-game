import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { buildArena, ARENA_THEMES } from './pit-adapter.ts';
import { gaitWeights } from '../../src/characters.ts';
import { budgetTextures, FIGHTER_TEXTURE_CAP, phoneTier, pixelCap } from '../../src/quality.ts';
import { LEGEND_OPPONENTS } from '../../src/legends.ts';
import { careerLine, newSession, nextFight, outcomeOf, settle, started, type Finished, type PitFight, type PitSession, type Settled } from '../pit/pit.ts';
import { BANK_STEP_Z, buildExchange, FORGE, PASSAGE, walkable } from './exchange.ts';
import { SPEEDS } from './speeds.ts';
import { exchangeAnchors, exchangePlan, openWest } from './exchange-plan.ts';
import { frontierBuild, frontierPlan, frontierWalkable, frontierZoneAt, onRoad, type Frontier } from './frontier-plan.ts';
import { buildFrontier } from './frontier.ts';
import { frontierKit } from './frontier-kit.ts';
import { loadKit } from './frontier-kit-view.ts';
import { mobVariant } from './mob-looks.ts';
import { dressMob } from './mob-dress.ts';
import { mobSpecs, previewRows, spawnAmong, type MobSpec } from './mobs.ts';
import { createCreatureCard } from './creature-card.ts';
import { loadZone } from './zone-loader.ts';
import { frontierDress } from './frontier-dress.ts';
import { withCinder } from './frontier-cinder.ts';
import { demoCamps } from './frontier-camp.ts';
import { groundAt, reliefZones } from './frontier-relief.ts';
import { campFires } from './camp-fire.ts';
import { bountyQuest, bountyQuestId, giverTalk } from './bounty.ts';
import type { Mobs } from './mobs-view.ts';
import { settleWithin } from './warm-gate.ts';
import { ASSETS, play, SMITH_NAME, START_LEVEL, WORLD_TUNING as T, type Kind } from './play.ts';
import { joinPresence, presenceUrl, presenceWanted, type Other, type Presence } from './presence-client.ts';
import { ME, createWorldCombat } from './world-combat.ts';
import { NAKED } from '../../src/gear-stats.ts';
import { beginOnline, onlineWanted, type HeldFight, type Online } from './encounter-online.ts';
import { onCombatEvent, spawnTracker } from './spawn-net.ts';
import { CHECKING, authClient, ensureFreshSession, fetchOpen, isOffline, loadAllegiance, previewCp, saveLine, SIGN_IN_HREF, canSignIn, storeAllegiance, storedToken, writerBase, type Source } from './save.ts';
import { picker, pickerOpen } from './allegiance.ts';
import { loadFailure } from './fight-load.ts';
import { STICK_R, intent, type Pad } from './sticks.ts';
import { wrapAngle } from '../../src/sim.ts';
import { applyLook, blendLook, lookAlong, lookOf } from './look.ts';
import { gameHour, nightness } from './daynight.ts';
import { creaturesLook } from '../../src/audio/creature.ts';
import { lockPageZoom } from '../../src/zoom-guard.ts';

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
const REGION = new URLSearchParams(location.search).get('region') !== '0';
const ONLINE = onlineWanted(location.search);   // ?online=1: a creature fight is played on the server's seed and settled with its record (encounter-online.ts); anything else is the offline path
const HELD_KEY = 'frankendom:encounter-token';   // the open server fight's token, so a reload or a second try inside its 120 s grace resumes it (a 409 on start names no token)
const HELD = { get: (): HeldFight | null => { try { const v = JSON.parse(sessionStorage.getItem(HELD_KEY) ?? 'null') as Partial<HeldFight> | null; return v && typeof v.token === 'string' ? { token: v.token, played: v.played === true } : null; } catch { return null; } }, set: (f: HeldFight | null) => { try { if (f) sessionStorage.setItem(HELD_KEY, JSON.stringify(f)); else sessionStorage.removeItem(HELD_KEY); } catch { /* private mode: no resume, offline as before */ } } };
const frontier: Frontier | null = REGION ? frontierPlan(/[?&]relief=0\b/.test(location.search)) : null, frontierParts = frontier && frontierBuild(frontier);
const CINDER = /[?&]look=(?:[^&]*,)?cinder\b/.test(location.search);   // ?look=cinder: the Frontier's ground carried past its edges, ground breakup, skyline silhouettes and a deeper haze (frontier-cinder.ts, look.ts 'cinder-haze'); a look test, absent = today's Frontier
const DUEL = /[?&]look=(?:[^&]*,)?duel\b/.test(location.search);   // ?look=duel (with ?region=1): look.ts 'frontier-duel', the ground and light for a fight at the duel camera; default off, combines with ?look=cinder,duel
const dress = frontier && frontierParts ? (CINDER ? withCinder(frontier, frontierParts, frontierDress(frontier, frontierParts)) : frontierDress(frontier, frontierParts)) : undefined;   // the Frontier's ground, rocks and ruins (frontier-dress.ts); its solids join the build's
if (dress && frontierParts) frontierParts.solids.push(...dress.solids);
const KIT = !/[?&]kit=(?:0|off)\b/.test(location.search);   // the Characters kit (zone1-kit.glb) drawn where frontier-kit.ts places it; ON, ?kit=0|off is the kill switch
const zoneKit = frontier && frontierParts && KIT ? frontierKit(frontier, frontierParts, dress!) : null;
if (frontierParts && zoneKit) frontierParts.solids.push(...zoneKit.solids);
const camps = frontier && frontierParts && /[?&]camps\b/.test(location.search) ? demoCamps(frontier, frontierParts, dress?.pieces) : [];   // ?camps: Expansion's generator drops these through placeCamp; this is the preview's stand-in
// The hills (frontier-relief.ts): flat pads under everything the plan and the dressing put down, hills in the open ground between; ?relief=0 is the kill switch. groundY is the ground under a world point (0 off the Frontier).
const relief = frontier && frontierParts && !/[?&]relief=0\b/.test(location.search) ? reliefZones(frontier, frontierParts, dress, camps.flatMap((c) => c.pieces)) : [];
const groundY = (x: number, z: number): number => (relief.length ? groundAt(relief, x, z) : 0);
if (frontierParts) for (const c of camps) frontierParts.solids.push(...c.solids);
const exchangePieces = frontier ? openWest(exchangePlan(), exchangeAnchors(), frontier.road.from.z, frontier.road.width / 2 + 0.3) : undefined;
const arena = buildArena(scene, theme), exchange = buildExchange(scene, arena.materials, exchangePieces);
let frontierGroup: THREE.Group | null = null;
if (frontier && frontierParts) {
  frontierGroup = buildFrontier(scene, arena.materials, frontierParts, dress, camps, relief);
  if (zoneKit) void loadKit(zoneKit, undefined, groundY).then((g) => frontierGroup?.add(g)).catch(() => {});   // a failed kit file only leaves the ground bare
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
let skyReady = false;   // the scene's environment map is final (programs are keyed on it): warm-up waits for this
environment(); void arena.ready.then(() => environment(arena.sky)).finally(() => { skyReady = true; });
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
let attackAct: THREE.AnimationAction | undefined, attackT = 0;
let mixer: THREE.AnimationMixer | undefined, gait: THREE.AnimationAction[] = [], rollAct: THREE.AnimationAction | undefined, guardAct: THREE.AnimationAction | undefined;   // the clips in gaitWeights() order: Idle, Walk, Jog, Run
new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(ASSETS.hero!).then((gltf) => {
  gltf.scene.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  if (PHONE) budgetTextures(gltf.scene, FIGHTER_TEXTURE_CAP);   // the game's iPhone black-fighters guard (characters.ts loadFighter)
  mixer = new THREE.AnimationMixer(gltf.scene);
  const clip = (name: string) => { const c = THREE.AnimationClip.findByName(gltf.animations, name); return c ? mixer!.clipAction(c) : undefined; };
  gait = ['Idle', 'Walk', 'Jog', 'Run'].map(clip).filter((a): a is THREE.AnimationAction => !!a);
  attackAct = clip('Attack'); rollAct = clip('Roll'); guardAct = clip('Guard');   // the Pit's own clips on the same rig: ROLL and GUARD in the walk
  gait.forEach((a, i) => { a.play(); a.setEffectiveWeight(i === 0 ? 1 : 0); });
  hero.remove(body, cap); hero.add(gltf.scene);
}).catch((error: unknown) => console.warn('hero did not load; the capsule stands in', error));

let heading = Math.PI, pitchNow = 0, gaitSpeed = 0, camSnap = true;
const state = { x: 0, z: 3 }, keys = new Set<string>();
// ?region=1 starts him among the wandering creatures (Dom 2026-10-07: no bridge walk, no far start); linking the zones comes later.
const mobSpecList = frontier && frontierParts ? mobSpecs(frontier, frontierParts, previewRows(location.search)) : [], start = frontier && frontierParts ? spawnAmong(frontier, frontierParts, mobSpecList) : null;
if (start) { state.x = start.x; state.z = start.z; heading = start.facing; }
const hint = document.getElementById('hint')!, place = document.getElementById('place')!;
// The player's bars sit under the whole HUD stack (place, hint, creature card), however tall it wraps: index.html reads --hud-bottom.
new ResizeObserver(() => document.documentElement.style.setProperty('--hud-bottom', `${Math.ceil(document.getElementById('hud')!.getBoundingClientRect().bottom)}px`)).observe(document.getElementById('hud')!);
const creatureCard = createCreatureCard(document.getElementById('creature-card')!, mobSpecList, loadZone().spawns.rows, () => careerLine(session.career).level);
let cardClock = 0, cardId: string | null = null, hintMoved = false;   // the first-load hint is spent once a thumb has moved; the Journal hides it while open and gives it back after, unless spent
if (frontier) hint.textContent = 'Left stick walks. Push to the edge to run. Creatures stop and watch when you come near.';
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
// Page zoom locked like the game's (Dom's iPhone, 2026-10-07: the preview zoomed in and cut the left label). The double tap is refused on
// the world canvas, the two sticks and the live fight kit's stick and action cluster (#joystick, #actions: pointer events); the kit's
// click-driven buttons (Rematch, camera, recenter, share) and every other button keep both taps (Auditor LOW on #1749).
lockPageZoom(document, { surface: '#view, #move-stick, #look-stick, #joystick, #actions', clickDriven: '.share-button, #reset-button, #camera-button, #recenter-button' });
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
const ZONE1 = /[?&]look=zone1\b/.test(location.search), ZONE_LOOK = ZONE1 || REGION || /[?&]look=zones\b/.test(location.search),
  HAZE = REGION && !ZONE1 && !/[?&]look=zones\b/.test(location.search),
  LOOK_STOPS = ZONE1 ? [{ at: 0, preset: 'zone1' }] : HAZE ? [{ at: -60, preset: /[?&]look=night\b/.test(location.search) ? 'frontier-night' : DUEL ? 'frontier-duel' : CINDER ? 'cinder-haze' : 'frontier-haze' }, { at: -20, preset: 'ash-pit' }] : [{ at: -10, preset: 'ash-pit' }, { at: -30, preset: 'exchange-dusk' }];   // ?region=1: the Pit's light to the west gate, the Frontier's haze by x -60 (the walk is along -x)
const DAYNIGHT = !/[?&]daynight=(?:0|off)\b/.test(location.search), T0 = performance.now(), START_HOUR = Number(/[?&]hour=(\d+(?:\.\d+)?)/.exec(location.search)?.[1] ?? 12);   // ON; ?daynight=0|off is the kill switch, ?hour=22 starts the clock there
const duelGround = new Set<THREE.MeshStandardMaterial>(); frontierGroup?.traverse((o) => { if (DUEL && o.name === 'frontier-ground-stone' && (o as THREE.Mesh).isMesh) duelGround.add((o as THREE.Mesh).material as THREE.MeshStandardMaterial); });   // ?look=duel only: the Frontier's own dirt is what the look's ground tint reaches (it is inert on every other look, so they are unchanged)
const GROUNDS = ZONE1 ? [exchange.ground] : [...duelGround], STONES = ZONE1 ? [exchange.stone] : [];   // hoisted: applyLook runs every frame
let kit = false, worldPhase = 'ready', facing = 0, prevPose = 'ready', camLock = true, lockOn: { x: number; z: number } | null = null;   // kit: the Pit's controls are the walk's; camLock: the lock-on (the ☰ chip), saved per player
const STRIKES = new Set<string>(['light', 'light_left', 'light_right', 'heavy', 'thrust', 'kick', 'skill']), LOCK_M = 9, CAMLOCK_KEY = 'origins-preview.camera-lock.v1';
try { camLock = localStorage.getItem(CAMLOCK_KEY) !== 'off'; } catch { /* storage blocked: locked, the default */ }
const WALK = SPEEDS.player.walk, RUN = SPEEDS.player.run, TURN = 1.9, eye = new THREE.Vector3(), look = new THREE.Vector3(), camAt = new THREE.Vector3(0, 2.6, 8);
function step(dt: number) {
  let running = !!held('ShiftLeft', 'ShiftRight'), forward = held('KeyW', 'ArrowUp') * (running ? 2 : 1) - held('KeyS', 'ArrowDown') * 0.6, turn = held('KeyA', 'ArrowLeft') - held('KeyD', 'ArrowRight'), strafe = 0, pitch = 0;
  if (open) forward = turn = 0;
  else if (kit) {   // the Pit's own controls (src/input.ts over the game's kit, pit-duel.ts world mode): stick walks, a button presses the nearest creature into a duel
    const i = duel!.worldIntent(), k = i.run ? 2 : 1;
    forward = Math.max(-0.6, Math.min(1, -i.z)) * k; strafe = Math.max(-1, Math.min(1, i.x)) * 0.7 * k; running = i.run;
    lockOn = camLock ? mobs?.nearest(state.x, state.z, LOCK_M) ?? null : null;
    if (lockOn) heading += wrapAngle(Math.atan2(lockOn.x - state.x, lockOn.z - state.z) - heading) * (1 - Math.exp(-6 * dt));   // the Pit's lock: the camera swings behind the hero to face it
    if (WORLDCOMBAT) {   // Zone 1's own loop owns attacks, guard and roll (Combat's S1/S2); the Pit's worldStep is not used
      const a = i.action;
      if (a === 'heavy') wc.press('heavy'); else if (a === 'kick') wc.press('kick'); else if (a && STRIKES.has(a)) wc.press('light');
      if (a === 'dodge' || a === 'backstep') {   // the stick's world direction (forward = (sin h, cos h)); backstep with no stick goes backwards; a plain dodge with no stick rolls where he faces
        const f = -i.z, st = i.x, len = Math.hypot(f, st), wx = Math.sin(heading) * f - Math.cos(heading) * st, wz = Math.cos(heading) * f + Math.sin(heading) * st;
        wc.roll(len > 0.2 ? { x: wx, z: wz } : a === 'backstep' ? { x: -Math.sin(wc.hero().facing), z: -Math.cos(wc.hero().facing) } : { x: 0, z: 0 });
      }
      wc.guard(i.guard); const hp = wc.hero().phase; worldPhase = hp === 'roll' ? 'roll' : hp === 'guard' ? 'guard' : 'ready'; facing = wc.hero().facing;
    } else {
    if (i.action && STRIKES.has(i.action)) pressEngage();   // an attack press engages; ROLL and GUARD (dodge, backstep, parry) are the walk's own, below
    const w = duel!.worldStep(dt, heading, i); worldPhase = w.phase; facing = w.facing;   // ROLL / GUARD: the Pit's own sim (pit-duel.ts worldStep), the ground a roll covers comes back as (dx, dz)
    if (w.dx || w.dz) { const rx = state.x + w.dx, rz = state.z + w.dz; if (canStand(rx, rz)) { state.x = rx; state.z = rz; } else if (canStand(rx, state.z)) state.x = rx; else if (canStand(state.x, rz)) state.z = rz; }
    if (worldPhase === 'roll' || worldPhase === 'backstep') { forward = strafe = 0; }   // the roll carries him; the stick does not add to it
    }
  }
  else if (pads.move || pads.look) ({ forward, strafe, turn, pitch, running } = intent(pads.move, pads.look));   // the sticks win while a thumb is down
  if (forward || turn || strafe || pitch) { hint.hidden = true; hintMoved = true; }   // the first-load hint goes once you move (Lead 2026-10-06)
  if (WORLDCOMBAT) { const ph = wc.hero().phase; if (ph === 'windup' || ph === 'active') forward = strafe = 0; }   // a cut commits him: he stands through it
  heading += turn * TURN * dt;
  pitchNow = THREE.MathUtils.damp(pitchNow, pitch, 8, dt);   // the right stick's up/down tilts the camera and eases back when released
  // Forward is (sin h, cos h); right is (-cos h, sin h): heading grows to the LEFT, as in the keys' A.
  // A push up to a full walk is 2.3 m/s at the rim; a run (the move stick pushed past SPRINT_PUSH, or Shift) is the gait table's Run knot, 5.2 m/s.
  const px = state.x, pz = state.z, ground = running ? RUN / 2 : WALK;   // Intent.running, not a guess from the stick size
  const nx = state.x + (Math.sin(heading) * forward - Math.cos(heading) * strafe) * ground * dt, nz = state.z + (Math.cos(heading) * forward + Math.sin(heading) * strafe) * ground * dt;
  if (canStand(nx, nz)) { state.x = nx; state.z = nz; } else if (canStand(nx, state.z)) state.x = nx; else if (canStand(state.x, nz)) state.z = nz;
  if (state.z < -5) arena.raiseGate(true);
  if (ZONE_LOOK) {
    let look = lookAlong(HAZE ? state.x : state.z, LOOK_STOPS);
    if (HAZE && DAYNIGHT) look = blendLook(look, lookOf('frontier-night'), nightness(gameHour(performance.now() - T0, undefined, START_HOUR)) * Math.min(1, Math.max(0, (-20 - state.x) / 40)));   // the Frontier's 100-minute day (daynight.ts); the Pit and the passage stay as they are
    sunHome.set(...applyLook(scene, renderer, sun, hemi, look, GROUNDS, STONES).sunPos);
  }
  hero.position.set(state.x, groundY(state.x, state.z), state.z); hero.rotation.y = kit && (worldPhase === 'roll' || worldPhase === 'backstep') ? facing : heading;
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
    const attacking = attackT > 0; attackT = Math.max(0, attackT - dt);
    rollAct?.setEffectiveWeight(rolling ? 1 : 0); guardAct?.setEffectiveWeight(guarding ? 1 : 0); attackAct?.setEffectiveWeight(attacking ? 1 : 0);
    gait.forEach((a, i) => { a.setEffectiveWeight(rolling || guarding || attacking ? 0 : w[i]!); if (i) a.timeScale = forward < 0 ? -1 : 1; }); mixer.update(dt);
  }
  // Follow camera: behind and above; tighter and lower in the passage so it stays under the vault.
  const inPassage = state.z < -9 && state.z > PASSAGE.to - 1.5 && (!frontier || Math.abs(state.x) < 20), back = inPassage ? 3.4 : 5.2, up = (inPassage ? 2.1 : 2.7) - pitchNow * 0.9; walkCam = { back, up: inPassage ? 2.1 : 2.7 };   // the right stick's up lowers the camera and raises the gaze
  const gy = groundY(state.x, state.z);   // the hills lift the camera with the hero
  eye.set(state.x - Math.sin(heading) * back, up + gy, state.z - Math.cos(heading) * back);
  if (camSnap) { camAt.copy(eye); camSnap = false; } else camAt.lerp(eye, 1 - Math.exp(-dt * 4));   // the first frame starts behind the hero, not at the old start easing over (slow phones showed a wall for ~10 s)
  look.set(state.x + Math.sin(heading) * 3, 1.5 + pitchNow * 1.6 + gy, state.z + Math.cos(heading) * 3);
  camera.position.copy(camAt); camera.lookAt(look);
  const atForge = Math.hypot(state.x - FORGE.x, state.z - FORGE.z) < 6;
  const zone = frontier && frontierZoneAt(frontier, state.x, state.z);
  showZone(zone ? zone.zone : null);
  if (frontier && frontierParts && !mobsAsked && (zone || onRoad(frontier, state.x, state.z))) {
    mobsAsked = true; if (WORLDFIGHT) preloadFight();   // the fight chunks come early (worldfight is on unless ?worldfight=0|off)
    void import('./mobs-view.ts').then((m) => { mobs = m.createMobs(scene, frontier, frontierParts, { phone: PHONE, groundAt: groundY, renderer, camera, after: arena.ready }); }).catch((error: unknown) => console.warn('the Frontier creatures did not load', error));
  }
  // Zone 1's own combat (wc.update below) is stepped with the walk, every frame.
  if (mobs) { mobs.update(dt, state, cardId); if (WORLDCOMBAT) { const aim = mobs.nearest(state.x, state.z, 3.5); const mv = wc.update(dt, { x: state.x, z: state.z, facing: aim ? Math.atan2(aim.x - state.x, aim.z - state.z) : heading }); if (mv.dx || mv.dz) { const rx = state.x + mv.dx, rz = state.z + mv.dz; if (canStand(rx, rz)) { state.x = rx; state.z = rz; } else if (canStand(rx, state.z)) state.x = rx; else if (canStand(state.x, rz)) state.z = rz; } updateBars(); document.body.classList.toggle('infight', wc.inCombat()); spawnNet.tick(); } if ((cardClock += dt) > 0.2) { cardClock = 0; cardId = creatureCard.update((mobs.debug() as { mobs: { id: string; x: number; z: number; mode: string }[] }).mobs, state); } }
  const label = zone ? zone.name : frontier && state.x < -19.5 ? 'The West Road' : atForge ? 'The Blacksmith' : state.z > -11 ? 'The Pit' : state.z > PASSAGE.to ? 'The Gladiator Gate' : state.z > -58 ? 'The Concord Exchange' : 'The Exchange — the bank';
  if (place.textContent !== label) { place.textContent = label; presence?.flush(); }   // a new place: presence hears the pose now, so the place it saves is fresh
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
let presence: Presence | null = null, others: Other[] = [];   // the Zone 1 page joined to presence (assigned once storage is read, below)
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
let compileChain: Promise<unknown> = Promise.resolve(), programsInFlight = 0, uploadMs = -1, uploadQueue: (() => void)[] = [], uploadTotal = 0, uploadNext = 0;
const uploaded = new WeakSet<object>();   // textures and geometries already on the GPU through this path
// The first duel frame used to upload ~9 textures and ~45 geometries the walk camera had never drawn (objects off its frustum): 29-79 ms of JS, and 175 ms once (WebKit, Mac, 2026-10-08). Put them on the GPU DURING the walk, a few per
// frame under a time budget (UPLOAD_BUDGET_MS of work a frame, so no frame is long): textures through initTexture, geometries by drawing a proxy mesh of each (cheap basic material, culling off) into a 4x4 target. Same path in every browser.
const UPLOAD_BUDGET_MS = 6;
const KINDS_WAIT_MS = 20000, MATERIAL_BOUND_MS = 4000;   // each scene-material compile on the chain is bounded too: one that never settles is logged and skipped, so the chain, programsInFlight and [zone ready] go on
const kindsWarmed = async () => { const t0 = performance.now(); for (;;) { const w = mobs?.warmState(); if (!w || !w.kinds.length || w.warmed.length >= w.kinds.length || performance.now() - t0 > KINDS_WAIT_MS) return; await new Promise((r) => setTimeout(r, 50)); } };   // a zone with no mobs view or no kinds has nothing to wait for; the backstop keeps one stuck kind from holding every material compile (each kind is itself bounded by WARM_BOUND_MS)
function planUpload() {
  const textures = new Set<THREE.Texture>(), geometries = new Set<THREE.BufferGeometry>(), materials = new Map<THREE.Material, THREE.Mesh>();
  scene.traverse((o) => {
    const sp = o as THREE.Sprite; if (sp.isSprite) { const t = sp.material.map; if (t && !uploaded.has(t)) textures.add(t); return; }   // a creature's name label and its '!' are canvas-texture sprites: first drawn at first sight, so they upload here (Metal trace: +1 texture at engage, #1921)
    const m = o as THREE.Mesh; if (!m.isMesh || (m as THREE.SkinnedMesh).isSkinnedMesh) return;   // skinned bodies are warmed by their own stage (pit-duel warmStage / warmOwn), not here
    for (const mat of Array.isArray(m.material) ? m.material : [m.material]) if (!uploaded.has(mat) && !materials.has(mat)) materials.set(mat, m);
    if (!uploaded.has(m.geometry)) geometries.add(m.geometry);
    for (const mat of Array.isArray(m.material) ? m.material : [m.material]) for (const v of Object.values(mat)) if (v && (v as THREE.Texture).isTexture && !uploaded.has(v)) textures.add(v as THREE.Texture);
  });
  const proxy = new THREE.MeshBasicMaterial(), tmp = new THREE.Scene(), target = new THREE.WebGLRenderTarget(4, 4), queue: (() => void)[] = [];
  for (const t of textures) queue.push(() => { renderer.initTexture(t); uploaded.add(t); });
  for (const g of geometries) queue.push(() => { const mesh = new THREE.Mesh(g, proxy), prev = renderer.getRenderTarget(); mesh.frustumCulled = false; tmp.add(mesh); renderer.setRenderTarget(target); try { renderer.render(tmp, camera); } finally { renderer.setRenderTarget(prev); tmp.remove(mesh); } uploaded.add(g); });
  for (const [mat, m] of materials) queue.push(() => { uploaded.add(mat); programsInFlight++; compileChain = compileChain.then(kindsWarmed).then(() => { const holder = new THREE.Group(); holder.add(m.clone()); return settleWithin('scene-material', renderer.compileAsync(holder, camera, scene), MATERIAL_BOUND_MS); }).catch(() => {}).finally(() => { programsInFlight--; }); });   // the scene's own materials (the arena's iron, the Exchange's stone) link their programs now, not when first in view; the geometry draws above use a proxy material and never link them. One chain, started after the body kinds are warmed: three 0.186's compileAsync has a disposal race under concurrency (mobs-view pump)
  if (queue.length) queue.push(() => { target.dispose(); proxy.dispose(); }); else { target.dispose(); proxy.dispose(); }
  uploadTotal += queue.length; return queue;
}
function warmUpload(time: number) {   // each walk frame: a slice of the plan under the budget (at least one item); when the plan is done, look again every 3 s for what has streamed in since (new bodies, props)
  if (!WORLDFIGHT || !mobs || !skyReady) return;
  if (!uploadQueue.length) { if (time < uploadNext) return; uploadNext = time + 3; uploadQueue = planUpload(); if (!uploadQueue.length) return; }
  const t0 = performance.now();
  while (uploadQueue.length && (performance.now() - t0 < UPLOAD_BUDGET_MS)) uploadQueue.shift()!();
  uploadMs = Math.round(performance.now() - t0);   // the latest slice's cost, for ?perf and the A/B
}
// "Zone ready" (the single point loadZone's ready hook will become, #1913): every body kind of the zone has its programs linked and textures and geometry uploaded, and the walk's own upload plan is drained.
// After it, nothing in the zone should compile or upload at a creature's first sight or at engage (the Metal trace's acceptance). Logged with the program count.
let zoneReadyAt = -1;
function zoneReadyCheck() {
  if (zoneReadyAt >= 0 || !mobs) return;
  const w = mobs.warmState();
  if (!w.kinds.length || w.warmed.length < w.kinds.length || uploadQueue.length || programsInFlight || uploadTotal === 0) return;
  zoneReadyAt = Math.round(performance.now());
  const detail = { atMs: zoneReadyAt, programs: renderer.info.programs?.length ?? -1, kinds: w.warmed, failed: w.failed };
  (window as unknown as { __zoneReady?: unknown }).__zoneReady = detail; console.info('[zone ready]', detail);
}
const walkLoop = () => {
  const dt = Math.min(clock.getDelta(), 0.05), time = clock.elapsedTime;
  if (duelDrawing) {   // ?worldfight: the duel draws this scene (it holds it in its holder); the world behind it stays alive: creatures wander and animate, fires burn
    mobs?.update(dt, state, cardId); arena.update(dt, [], camera); exchange.update(time); fires?.update(time, state, warm);
    return;
  }
  step(dt); warmFight(time); warmUpload(time); zoneReadyCheck(); arena.update(dt, [], camera); exchange.update(time);
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
    hint.textContent = 'Left stick walks. Push to the edge to run. Walk up to a creature and press STAB, SLASH or HEAVY to fight it. Drag empty screen to look round when the camera lock is off.';
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
let allegiance = loadAllegiance(storage), playerName = 'You', characterId: string | null = null, online: Online | null = null;
// Presence (origins/presence): signed in, the page joins it and poses at its tick; presence saves the place, the page never says "save". Only the Concord square (+-150 m round the Pit) is in presence's frame today, so the pose is withheld outside it; ?presence=0 is the kill switch.
const AUTH_READY = ensureFreshSession(storage, Date.now(), () => authClient({ url: import.meta.env.VITE_SUPABASE_URL as string | undefined, key: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined }));   // a stale session is renewed once, before presence, the saved career and the paid fight read it
if (presenceWanted(location.search)) void AUTH_READY.then(() => { presence = joinPresence({
  token: storedToken(storage, Date.now()), url: presenceUrl(location.origin), open: (url, protocols) => new WebSocket(url, protocols) as never,
  pose: () => (!frontier && Math.abs(state.x) < 149 && Math.abs(state.z) < 149 ? { x: state.x, z: state.z, heading } : null),
  onHello: (at) => { if (!frontier && Math.hypot(at.x - state.x, at.z - state.z) > 1 && canStand(at.x, at.z)) { state.x = at.x; state.z = at.z; camSnap = true; } },   // where the server placed us (a rejoin lands where it was left)
  onOthers: (list) => { others = list; },
}); });
addEventListener('pagehide', () => presence?.stop());   // the socket's close is the 'on leave' the server saves on
function showCareer() {
  allegianceButton.hidden = fighting || !pickerOpen('saved' in source, careerLine(session.career).level);
  const c = careerLine(session.career), extra = 'saved' in source ? previewCp(source, session.career) : last?.award?.cp ?? 0;
  career.textContent = `Level ${c.level} · ${c.top ? `${c.credit} CP` : `${c.into} / ${c.need} CP`}${extra ? ` · +${extra} CP (preview)` : ''}`;
  saveNote.textContent = saveLine(source);
  if (canSignIn(source)) { const a = document.createElement('a'); a.href = SIGN_IN_HREF; a.textContent = 'Sign in'; a.style.cssText = 'pointer-events:auto;color:inherit;text-decoration:underline;padding:8px 0 8px 8px'; saveNote.append(' · ', a); }
}
showCareer();
// The saved career, once, in the background: the walk and the Pit never wait on it. It is adopted only while no duel has started, so a
// preview fight is never re-based under the player; otherwise (or on any failure) the in-memory preview career stands, marked offline.
void AUTH_READY.then(() => fetchOpen(storedToken(storage, Date.now()), { base: writerBase(location.search) })).then((opened) => {
  if (isOffline(opened)) source = opened;
  else if (session.fights > 0 || fighting) source = { offline: 'late' };
  else { session = { career: opened.career, settled: new Set(), fights: 0 }; source = { saved: opened.career }; last = null; playerName = opened.characters[0]?.name ?? playerName; characterId = opened.characters[0]?.id ?? null; play.standAt(careerLine(session.career).level); }
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
  fighting = false; online?.stop(); online = null; duel?.closeDuel(); document.getElementById('hunt-result')?.remove();
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
// The wild has no fight start or end (Dom 2026-10-08): no banner, no timer, no "Back to the fields". A kill is a small non-modal toast and the creature falls; running away or a
// stalemate shows nothing; the hero's death dims the screen for ~2 s ("You died"), then he stands up in town at full health, everything kept. The Pit keeps its own banner and rules.
const TOWN_RESPAWN = { x: 0, z: 3 };   // TODO(World, with Characters' town kit #1825 / generator #1826): placeholder, the square the region page opens on; replace with the Zone 1 bank town's respawn point when the town is placed
function worldToast(text: string) {
  document.getElementById('world-toast')?.remove();
  const t = document.createElement('div'); t.id = 'world-toast'; t.className = 'glass'; t.textContent = text;
  t.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:26%;max-width:86vw;z-index:5;padding:8px 14px;text-align:center;font:600 15px/1.35 Georgia,serif;pointer-events:none';
  document.body.append(t); setTimeout(() => t.remove(), 3500);
}
function worldEnded(out: { won: boolean; text: string }, end: { result: 'won' | 'lost' }) {
  const run = fightRun;
  if (end.result === 'lost') {
    const veil = document.createElement('div'); veil.id = 'world-death'; veil.textContent = 'You died';
    veil.style.cssText = 'position:fixed;inset:0;z-index:6;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.62);color:#e8dcc8;font:600 26px/1 Georgia,serif;pointer-events:none';
    document.body.append(veil);
    setTimeout(() => { veil.remove(); if (fighting && run === fightRun) { state.x = TOWN_RESPAWN.x; state.z = TOWN_RESPAWN.z; camSnap = true; leaveFight(); } }, 2000);
    return;
  }
  if (out.won) worldToast(out.text.replace(/\n+/g, ' '));
  if (fighting && run === fightRun) leaveFight();
}
function showResult(text: string) {
  document.getElementById('leave')!.hidden = true;   // the end panel's own "Back to the fields" is the one way out
  document.getElementById('hunt-result')?.remove();
  const note = document.createElement('div'); note.id = 'hunt-result'; note.className = 'glass'; note.textContent = text;
  note.style.cssText = 'position:fixed;left:12px;right:12px;top:30%;z-index:5;padding:12px 14px;text-align:center;font:600 17px/1.4 Georgia,serif;pointer-events:none';
  duelLayer.append(note);
  if (WORLDFIGHT) { const run = fightRun; setTimeout(() => { if (fighting && run === fightRun) leaveFight(); }, 2600); }   // the banner, then simply walking again: nothing to tap
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
  if (WORLDCOMBAT) { if (Math.hypot(x - state.x, z - state.z) > 3.5) say(`${spec.name} is too far off: walk closer, then press an attack.`); else wc.press(); return; }   // Zone 1's own combat: a tap on a creature in reach is a cut
  if (fighting) { say('A fight is already starting: wait a moment, or tap Back to the fields.'); return; }
  if (Math.hypot(x - state.x, z - state.z) > REACH) { say(`${spec.name} is too far off: walk closer, then tap.`); return; }
  void startMobFight(spec);
}
function pressEngage() {
  if (WORLDCOMBAT) { wc.press(); return; }   // STAB / SLASH / HEAVY / KICK / SKILL near a creature starts the duel with the nearest one in reach; with none, it says what to do
  const t = mobs?.nearest(state.x, state.z, REACH);
  if (t) engage(t.spec, t.x, t.z); else say('Nothing in reach: walk up to a creature, then press STAB, SLASH or HEAVY.');
}
// ?worldfight (Dom 2026-10-07: fight where you stand, no ring): the duel runs inside THIS scene. The world is moved into a holder the duel's scene mounts (src/scene.ts WorldMount),
// the walker and the engaged creature are not drawn (the duel draws its own pair), the other creatures stand frozen and those past 20 m are hidden. On by default; ?worldfight=0 (or =off) is the kill switch
// and the fight is the Pit's, as it was.
const WORLDFIGHT = !/[?&]worldfight=(?:0|off)\b/.test(location.search);   // ON by default (Dom 2026-10-08: all switches on); ?worldfight=0 or =off is the emergency kill switch back to the Pit's own fight
// Zone 1's OWN combat loop (Dom/Strategy 2026-10-08: the Pit is on hold; the wild is continuous and open, no fight start/end). Combat's pure origins/combat/zone1.ts decides hits, reach, creature chase /
// telegraph / bite / leash; world-combat.ts mounts it here. ?combat=pit is the emergency switch back to the Pit duel for a creature (the old path below stays untouched).
const WORLDCOMBAT = !/[?&]combat=pit\b/.test(location.search);
const wcBars = document.createElement('div'); wcBars.id = 'wc-bars'; wcBars.hidden = true;
wcBars.style.cssText = 'position:fixed;left:12px;top:max(12px,env(safe-area-inset-top));z-index:4;width:150px;pointer-events:none;font:600 11px/1.2 Georgia,serif;color:#efe6d2';
wcBars.innerHTML = '<div id="wc-name" style="min-height:13px;text-shadow:0 1px 2px #000"></div><div style="height:7px;background:rgba(0,0,0,.55);margin:2px 0"><div id="wc-foe" style="height:100%;width:0;background:#b4452e"></div></div><div style="height:9px;background:rgba(0,0,0,.55);margin:6px 0 2px"><div id="wc-hp" style="height:100%;width:100%;background:#5aa05a"></div></div><div style="height:5px;background:rgba(0,0,0,.55)"><div id="wc-st" style="height:100%;width:100%;background:#c9b24a"></div></div>';
document.body.append(wcBars);
const wcFlash = document.createElement('div'); wcFlash.style.cssText = 'position:fixed;inset:0;z-index:3;pointer-events:none;background:radial-gradient(transparent 40%,rgba(190,30,20,.55));opacity:0;transition:opacity .25s'; document.body.append(wcFlash);
function updateBars() {
  const h = wc.hero(), t = wc.target(), full = h.health >= h.max - 0.5 && h.stamina >= h.maxStamina - 0.5;
  wcBars.hidden = full && !t && !wc.inCombat();
  if (wcBars.hidden) return;
  (document.getElementById('wc-hp') as HTMLElement).style.width = `${Math.max(0, h.health / h.max) * 100}%`;
  (document.getElementById('wc-st') as HTMLElement).style.width = `${Math.max(0, h.stamina / h.maxStamina) * 100}%`;
  (document.getElementById('wc-name') as HTMLElement).textContent = t ? `${t.name}` : '';
  (document.getElementById('wc-foe') as HTMLElement).style.width = t ? `${Math.max(0, t.health / t.max) * 100}%` : '0';
}
function heroDeathSequence() {
  const veil = document.createElement('div'); veil.id = 'world-death'; veil.textContent = 'You died';
  veil.style.cssText = 'position:fixed;inset:0;z-index:6;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.62);color:#e8dcc8;font:600 26px/1 Georgia,serif;pointer-events:none';
  document.body.append(veil);
  setTimeout(() => { veil.remove(); state.x = TOWN_RESPAWN.x; state.z = TOWN_RESPAWN.z; camSnap = true; wc.reset({ x: state.x, z: state.z, facing: heading }); }, 2000);   // everything kept; full health in town
}
async function creatureFell(spec: MobSpec) {
  mobs?.fell(spec.id);
  void spawnNet.killed(spec.id);   // the server's verified kill (beta ledger); the page's own loot and toast below run whatever it answers
  try {
    huntMod ??= await import('./hunt.ts'); hunt ??= huntMod.newHunt();
    const run = huntMod.prepare(hunt, spec), quest = bountyQuestId(frontier!.giver);
    if (run.ok) { const out = huntMod.settle(hunt, spec, run.value, { result: 'won', twistOutcome: null }, new Date().toISOString(), () => play.bountyOpen(quest), false); if (out.bounty) play.bountyPaid(quest, out.bounty.encounter); worldToast(out.text.replace(/\n+/g, ' ')); return; }
  } catch (error) { console.warn('the kill could not be settled', error); }
  worldToast(`${spec.name} is down.`);
}
// Every world creature fight is server-verified when signed in (origins/server/world-spawns.ts): one engage token per creature, joiners included; guests send nothing.
const spawnNet = spawnTracker({ token: () => storedToken(storage, Date.now()), character: () => characterId, now: () => Date.now(), base: writerBase(location.search) });
const wc = createWorldCombat({
  mobs: () => mobs, hero: () => ({ gear: NAKED, level: careerLine(session.career).level }), onKill: (spec) => void creatureFell(spec), onHeroDied: heroDeathSequence, onEvent: onCombatEvent(spawnNet, ME),
  onHeroHit: () => { wcFlash.style.opacity = '1'; setTimeout(() => { wcFlash.style.opacity = '0'; }, 120); },
  onSwing: () => { attackT = 0.7; if (attackAct) { attackAct.reset().setLoop(THREE.LoopOnce, 1); attackAct.clampWhenFinished = false; attackAct.play(); } },
});
let duelDrawing = false;   // the duel's own frame is drawing this scene (between the mount's attach and detach): the walk loop keeps the world alive but does not draw
// One holder per page: createScene adds it to its scene once, at creation, and the next fight against the same body and level REUSES that stage, so a new holder per fight would be in no rendered scene (a bare background). detach() resets its matrix.
const worldHolder = new THREE.Group();
let walkCam = { back: 5.2, up: 2.7 };   // the walk camera's distance behind the hero and height, as the last frame had them
function worldMount(spec: MobSpec, at: { x: number; z: number }, toward: { x: number; z: number }) {
  const holder = worldHolder; let moved: THREE.Object3D[] = [];
  return {
    cameraFrom: () => ({ position: camera.position.clone(), quaternion: camera.quaternion.clone() }),   // the walk's camera: the duel's eases from it (scene.ts easeCamera)
    renderer, canvas, holder, background: scene.background, fog: scene.fog as THREE.Fog | THREE.FogExp2 | null, at, toward, groundY: groundY(at.x, at.z), walkCam: { ...walkCam },
    attach() { moved = [...scene.children]; holder.add(...moved); hero.visible = false; mobs?.engage(spec.id); duelDrawing = true; duelLayer.classList.add('infight'); document.body.classList.add('infight'); },
    detach() { if (moved.length) scene.add(...moved); moved = []; holder.matrix.identity(); hero.visible = true; mobs?.engage(null); duelDrawing = false; duelLayer.classList.remove('infight'); document.body.classList.remove('infight'); },
  };
}
// The fight's chunks (the duel, the hunt, the encounter) are fetched when the Frontier's creatures come in, in an idle moment, not at the tap: the first engage no longer waits on three imports (Dom 2026-10-08, seamless combat).
let warmAt = -Infinity, warmKey = '', warmSince = 0;
const WARM_M = 14, WARM_DWELL_S = 2;   // a creature this near is the likely next fight: its stage is built now, not at the tap
function warmFight(time: number) {   // every 2 s on the walk, with the fight chunks in: build the world-mounted stage of the nearest creature (pit-duel warmStage keeps it when it is already the one)
  if (!WORLDFIGHT || fighting || !duel || !huntMod || !hunt || !mobs || time - warmAt < 0.5) return;
  warmAt = time;
  const t = mobs.nearest(state.x, state.z, WARM_M); if (!t) { warmKey = ''; return; }
  const run = huntMod.prepare(hunt, t.spec); if (!run.ok) return;
  const lights: THREE.Object3D[] = []; scene.traverse((o) => { if ((o as THREE.Light).isLight) lights.push(o); });
  const o = run.value.setup.opponent, key = `${o.body}:${o.level}`;
  if (key !== warmKey) { warmKey = key; warmSince = time; return; }   // the nearest creature type must hold this long before its stage is built or replaced: a walk past a camp must not churn GPU memory (Auditor M2)
  if (time - warmSince < WARM_DWELL_S) return;
  duel.warmStage(duelLayer, o.body, o.level, worldMount(t.spec, { x: state.x, z: state.z }, { x: t.x, z: t.z }), { world: scene, lights, dress: (root) => { const look = mobVariant(t.spec.character, t.spec.id); if (look) dressMob(root, look, false); } });
}
function preloadFight() {
  const idle = (window as { requestIdleCallback?: (fn: () => void, o?: { timeout: number }) => void }).requestIdleCallback ?? ((fn: () => void) => void setTimeout(fn, 1500));
  idle(() => { void Promise.all([import('./pit-duel.ts'), import('./hunt.ts'), import('./encounter-duel.ts')]).then(([d, h, e]) => { duel ??= d; huntMod ??= h; encDuel ??= e; hunt ??= h.newHunt(); }).catch((error: unknown) => console.warn('the fight chunks did not preload; the tap loads them', error)); }, { timeout: 4000 });
}
let fightRun = 0;   // which fight a banner belongs to
async function startMobFight(spec: MobSpec) {
  if (fighting || !frontier) { say(frontier ? 'A fight is already starting.' : 'There is nothing to fight here.'); return; }
  fighting = true; fightRun++; kit = false; if (!WORLDFIGHT) duelLayer.classList.remove('world');   // claimed first: a second tap while the chunks load does nothing
  openPanel(null); keys.clear(); releaseSticks(); prompt.hidden = true; hint.hidden = true;
  duelLayer.hidden = false; journalButton.hidden = allegianceButton.hidden = true; if (!WORLDFIGHT) { canvas.hidden = true; place.textContent = `${spec.name}: a duel`; }   // a world fight keeps the walk's place line: no mode switch
  if (!WORLDFIGHT) renderer.setAnimationLoop(null);   // ?worldfight never stops the world loop (Dom 2026-10-08): the walk keeps ticking and drawing until the duel takes over the drawing
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
  if (ONLINE && !bar) { await AUTH_READY; online = await beginOnline({ token: storedToken(storage, Date.now()), character: characterId, fight: run.fight, setup: run.setup, base: writerBase(location.search), held: HELD }); if (!fighting) { online?.stop(); online = null; return; } }   // left while the server answered
  const on = online;   // `online` is cleared when the fight ends; the first-tick mark belongs to this fight
  void encDuel.startEncounterDuel(duelLayer, bar ? { ...run.setup, bar, combatFlags: [...run.setup.combatFlags, { kind: 'one-health-bar' }] } : run.setup, online?.seed ?? run.seed, (end) => {
    const wasOnline = online !== null;
    if (online) { void online.settle(end).then((outcome) => console.info('encounter settle:', outcome)); online = null; }
    const out = huntMod!.settle(hunt!, spec, run, end, new Date().toISOString(), () => play.bountyOpen(quest), wasOnline);
    if (out.bounty) play.bountyPaid(quest, out.bounty.encounter);
    if (out.won) mobs?.fell(spec.id);
    if (WORLDFIGHT) worldEnded(out, end); else showResult(out.text);
  }, leaveFight, { name: spec.name, level: spec.level, dress: (root) => { const look = mobVariant(spec.character, spec.id); if (look) dressMob(root, look, false); } }, () => on?.played(), WORLDFIGHT ? worldMount(spec, { x: state.x, z: state.z }, mobs?.find(spec.id) ?? { x: state.x, z: state.z - 4 }) : undefined);   // scale 1: the duel's own scale is the sim's, only the cloth is dressed
  const leaveButton = document.getElementById('leave')!; leaveButton.textContent = 'Back to the fields';
}
document.getElementById('leave')!.addEventListener('click', leaveFight);
(window as unknown as { originsPreview: unknown }).originsPreview = {
  combat: () => ({ hero: wc.hero(), target: wc.target(), fighters: wc.debug() }), press: () => wc.press(),   // Zone 1's combat loop, for the browser checks
  presence: () => ({ state: presence?.state() ?? 'off', others }),
  pos: state, canStand, place: (x: number, z: number, h: number) => { state.x = x; state.z = z; heading = h; }, open: openPanel,
  // ?region=1: the zone you stand in (with its ambience preset), the Frontier layout's spots, and the Bounty giver's talk.
  region: () => frontier && { camps: camps.map((c) => ({ at: c.at, spots: c.spots })), zone: zoneNow, giver: frontier.giver.at, back: frontier.signs.find((s) => s.back)!.at, road: frontier.road, near,
    zones: frontier.zones.map((z) => ({ zone: z.zone, preset: z.preset, landmarks: z.landmarks })) },
  renderInfo: () => ({ triangles: renderer.info.render.triangles, calls: renderer.info.render.calls, programs: renderer.info.programs?.length ?? 0, programNames: (renderer.info.programs ?? []).map((q) => `${q.name}#${q.id}`), programKeys: Object.fromEntries((renderer.info.programs ?? []).map((q) => [`${q.name}#${q.id}`, String((q as unknown as { cacheKey?: string }).cacheKey ?? '').slice(0, 140)])), geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures }),   // the last frame's cost (perf checks)
  mobs: () => mobs?.debug() ?? null, pose: () => ({ worldPhase, rollClip: !!rollAct, guardClip: !!guardAct }),
  tapLog: () => [...tapLog],
  // tap a creature by id as the page would (same reach rule); hunt() is the memory of the hunt: kills, the pack, the metal.
  uploadMs: () => uploadMs,   // the walk's world upload: the latest slice's ms (-1 before the first); uploadLeft() = items still queued, uploadItems() = all planned so far
  uploadLeft: () => uploadQueue.length, uploadItems: () => uploadTotal,
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
