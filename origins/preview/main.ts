import './zone-guard.ts';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildArena, ARENA_THEMES } from './pit-adapter.ts';
import { actorPose, loadWarriors, type Practice } from '../../src/fight/index.ts';
import { characterFor, fetchOwnBuild, type OwnBuild } from '../../src/core/index.ts';
import { phoneTier, pixelCap } from '../../src/fight/index.ts';
import { LEGEND_OPPONENTS, encodeWorldRecord } from '../../src/fight/index.ts';
import { careerHud } from './career-text.ts';
import { careerLine, newSession, nextFight, outcomeOf, settle, started, type Finished, type PitFight, type PitSession, type Settled } from '../pit/pit.ts';
import { BANK_STEP_Z, buildExchange, FORGE, PASSAGE, walkable } from './exchange.ts';
import { SPEEDS } from '../../src/fight/index.ts';
import { exchangeAnchors, exchangePlan, openWest } from './exchange-plan.ts';
import { frontierBuild, frontierPlan, frontierWalkable, frontierZoneAt, onRoad, type Frontier } from './frontier-plan.ts';
import { buildFrontier } from './frontier.ts';
import { frontierKit } from './frontier-kit.ts';
import { loadKit } from './frontier-kit-view.ts';
import { createGroundItemView } from './ground-item-view.ts';
import { groundLook } from './ground-looks.ts';
import { createGroundPickup } from './ground-pickup.ts';
import { groundPointOf } from '../world/ground-point.ts';
import { readGround, takeGround } from './ground-net.ts';
import { mobVariant } from './mob-looks.ts';
import { dressMob } from './mob-dress.ts';
import { mountGear } from './gear-mount.ts';
import { createLoadoutGate } from './loadout-gate.ts';
import { mobSpecs, previewRows, spawnAmong, type MobSpec } from './mobs.ts';
import { createCreatureCard } from './creature-card.ts';
import { createRemoteHeroes } from './remote-heroes.ts';
import { legendSpecs } from './legend-mobs.ts';
import { loadZone, pageZoneId } from '../zones/loader.ts';
import { createLateOpen } from './late-open.ts';
import { applyServerKill, killToast } from './kill-apply.ts';
import { itemNamer } from './item-names.ts';
import { guestBag, guestKillLoot } from './guest-loot.ts';
import { loadEncounterContent } from '../encounters/encounters.ts';
import { mountRepair } from './repair-screen.ts';
import { readWear, repairPiece, repairOp } from './repair-net.ts';
import { chromeText as repairText } from './repair-view.ts';
import { mountStats } from './stats-screen.ts';
import { chromeText as statsText } from './stats-view.ts';
import { REGION1_SHOPS, EXCHANGE_PROVISIONER } from '../region1/shops.ts';
import { chromeText as shopText } from '../shops/shop-view.ts';
import { mountShop } from './shop-screen.ts';
import { buyOne, newOp, readStock } from './shop-net.ts';
import { boardNamer } from '../board/board-names.ts';
import { boardView, chromeText } from '../board/board-view.ts';
import { mountBoard } from '../board/board-screen.ts';
import { frontierDress } from './frontier-dress.ts';
import { withCinder } from './frontier-cinder.ts';
import { demoCamps } from './frontier-camp.ts';
import { groundAt, reliefZones } from './frontier-relief.ts';
import { campFires } from './camp-fire.ts';
import { bountyQuest, bountyQuestId, giverTalk } from './bounty.ts';
import type { Mobs } from './mobs-view.ts';
import { settleWithin } from '../../src/fight/index.ts';
import { clone as cloneRig } from 'three/addons/utils/SkeletonUtils.js';
import { PLAYER, tooSlow, warmActor, warmDone, warmKitsWithin, warmList } from './warm-plan.ts';
import { budgetTextures, buildWarriors, FIGHTER_TEXTURE_CAP, lootIds, lootPiecesOf } from '../../src/fight/index.ts';
import { dressRemote } from './dress-remote.ts';
import { warmKits, type WarmKit } from './warm-kits.ts';
import lootUrl from '../../src/assets/loot.glb?url';
import { exitFace } from './leave-entry.ts';
import { ASSETS, play, SMITH_NAME, START_LEVEL, WORLD_TUNING as T, type Kind } from './play.ts';
import { joinPresence, presenceUrl, presenceWanted, type Other, type Presence } from './presence-client.ts';
import { drawProxy, linkProxy } from './warm-proxy.ts';
import { ME, createFollowCamera, pickFraming, type Passage, type Presets, createZoneBars, createWorldCombat, canPlayFinisher, createWoundFx, createZoneFx, loadFeedback, woundSpec } from '../../src/fight/index.ts';
import '../../src/fight/meters.css';
import { onCombatEvent, spawnTracker } from './spawn-net.ts';
import { startFight as startEncounter, settleFight as settleEncounter } from './encounter-net.ts';
import { createEngageAhead } from './engage-ahead.ts';
import { beginLegendFight, finishLegendFight, type LegendNet } from './legend-fight.ts';
import { createZoneSound, soundWanted } from './zone-sound.ts';
import { bookIsOffline, createServerSkills, equippedSpell, getGrimoire, onSpellsChanged, ownedSpells, setOwnedSpells, slotShown, useSpellStore } from '../../src/core/index.ts';
import { pickSpell, loadSpellInfo } from '../../src/fight/index.ts';
import { CHECKING, authClient, ensureFreshSession, openedAccount, isOffline, type Opened, loadAllegiance, previewCp, saveLine, SIGN_IN_HREF, canSignIn, pageSignedIn, storeAllegiance, storedToken, writerBase, type Source } from './save.ts';
import { picker, pickerOpen } from './allegiance.ts';
import { loadFailure } from './fight-load.ts';
import { STICK_R, intent, type Pad } from './sticks.ts';
import { wrapAngle } from '../../src/fight/index.ts';
import { applyLook, blendLook, lookAlong, lookOf, withZoneLook, zoneArena, zoneDayNight, zoneHour } from './look.ts';
import { gameHour, nightness } from './daynight.ts';
import { creaturesLook } from '../../src/fight/index.ts';
import { lockPageZoom } from '../../src/zoom-guard.ts';
import { previewRule } from './preview-rules.ts';

// The walk out (Origins look prototype): the Ash Pit exactly as the game builds it, its light recipe from scene.ts, then the passage, the
// Concord Exchange and the bank's front in greybox. You walk it: drag (up walks, sideways turns) or WASD / arrows. No tour (Dom 2026-10-06).
const theme = ARENA_THEMES[zoneArena(loadZone(), ARENA_THEMES) as keyof typeof ARENA_THEMES], PHONE = phoneTier();   // the zone's own Pit theme (look.arena in its row); Zone 1 and any zone that sets none keep the Ash Pit's
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
const frontier: Frontier | null = REGION ? frontierPlan(/[?&]relief=0\b/.test(location.search), pageZoneId()) : null, frontierParts = frontier && frontierBuild(frontier);
if (frontier) document.title = `Frankendom — ${loadZone(frontier.zone).name}`;   // the tab names the page's zone from its data (index.html's is only the pre-script default)
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
// Ground items (ground loot slice 3): the view draws what the page's ground_state says is there (show on `visible`, hide on a take). Each item's model is the equip file its ground-looks.json row names; the glob lists only the files rows use (add a line when a row names another).
const GROUND_MODELS = import.meta.glob<string>('../../src/assets/weapons/player/{longsword,knife,cleaver,gladius,estoc}.glb', { eager: true, query: '?url', import: 'default' }), GROUND_LOOT = import.meta.glob<string>('../../src/assets/loot.glb', { eager: true, query: '?url', import: 'default' });   // `asset: "loot"` rows name a piece inside loot.glb
// One fetch and parse per model file: the ground view and the remote-kit warm-up (loot.glb's pieces) read the same scene. On a phone the skins are capped as the fighters' are (loadFighter / loadLoot do the same).
const gltfScenes = new Map<string, Promise<THREE.Object3D>>();
const sceneOf = (url: string): Promise<THREE.Object3D> => {
  let p = gltfScenes.get(url);
  if (!p) gltfScenes.set(url, (p = (async () => { const [{ GLTFLoader }, { MeshoptDecoder }] = await Promise.all([import('three/addons/loaders/GLTFLoader.js'), import('three/addons/libs/meshopt_decoder.module.js')]); const loaded = (await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(url)).scene; if (phoneTier()) budgetTextures(loaded, FIGHTER_TEXTURE_CAP); return loaded; })().catch((error: unknown) => { gltfScenes.delete(url); throw error; })));
  return p;
};
const groundItems = createGroundItemView({ scene, groundAt: groundY, assetOf: (item) => { const { asset } = groundLook(item); return asset === 'loot' ? GROUND_LOOT['../../src/assets/loot.glb'] : GROUND_MODELS[`../../src/assets/weapons/player/${asset}.glb`]; }, loadModel: sceneOf });
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
const GAP = previewRule('gateGap');   // radians either side of the gate
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
// The hero is the shared fight engine's actor (src/fight/characters.ts loadWarriors: the same rig, clips, trail and gait every client plays), posed every frame by the Pit's actorPose from his real duel (wc.heroDuel()):
// slash, stab, heavy, kick, guard and roll each play their own Pit clip. The opponent actor loadWarriors also builds is never added to the scene.
let remote: ReturnType<typeof createRemoteHeroes> | undefined, shownOthers: Other[] | null = null;   // the zone's other players (remote-heroes.ts), made with the hero's own rig once it has loaded
let warriors: Awaited<ReturnType<typeof loadWarriors>> | undefined, forcedPose: ReturnType<typeof actorPose> | null = null;   // forcedPose: the browser checks hold the hero in one engine pose (a still mid-kick without racing the sim)
const HERO_WAIT_MS = previewRule('heroWait'), warmedHero: { done: boolean; failed: boolean } = { done: false, failed: false };   // the player's actor is on every zone's warm-up list (warm-plan.ts)
loadWarriors(ASSETS.hero!).then((w) => { warriors = w; hero.remove(body, cap); hero.add(w.player.anchor); void warmHero(w.player.anchor); remote = createRemoteHeroes({ scene, spawn: w.spawn, groundAt: groundY, who: (id) => otherNames.get(id), forget: (id) => { otherNames.delete(id); } }); remote.warm(); }).catch((error: unknown) => { warmedHero.failed = true; console.warn('hero did not load; the capsule stands in', error); });

let heading = Math.PI, pitchNow = 0, gaitSpeed = 0;
const state = { x: 0, z: 3 }, keys = new Set<string>();
// ?region=1 starts him among the wandering creatures (Dom 2026-10-07: no bridge walk, no far start); linking the zones comes later.
const mobSpecList = frontier && frontierParts ? mobSpecs(frontier, frontierParts, previewRows(location.search, pageSignedIn())) : [], start = frontier && frontierParts ? spawnAmong(frontier, frontierParts, mobSpecList) : null;
if (start) { state.x = start.x; state.z = start.z; heading = start.facing; }
const hint = document.getElementById('hint')!, place = document.getElementById('place')!;
// The player's bars sit under the whole HUD stack (place, hint, creature card), however tall it wraps: index.html reads --hud-bottom.
let labelFloor = 0;   // the lowest pixel of the HUD stack and the player's bars: creature name tags are kept below it (mobs-view clampLabels)
const measureHud = () => {
  const bottom = Math.ceil(document.getElementById('hud')!.getBoundingClientRect().bottom);
  document.documentElement.style.setProperty('--hud-bottom', `${bottom}px`);
  labelFloor = Math.max(bottom, Math.ceil(document.querySelector('.combat-hud')?.getBoundingClientRect().bottom ?? 0));   // the Pit's bars (.combat-hud) sit under the HUD stack (index.html)
};
const hudWatch = new ResizeObserver(measureHud); hudWatch.observe(document.getElementById('hud')!);
const creatureCard = createCreatureCard(document.getElementById('creature-card')!, [...mobSpecList, ...(frontier ? legendSpecs(frontier) : [])], loadZone().spawns.rows, () => careerLine(session.career).level);
let cardClock = 0, cardId: string | null = null, legendFocus: string | null = null, hintMoved = false;   // the first-load hint is spent once a thumb has moved; the Journal hides it while open and gives it back after, unless spent
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
const NEAR: Partial<Record<Kind | 'fight' | 'back' | 'ground', string>> = { talk: `Talk to ${SMITH_NAME}`, bank: 'Bank — tap to open', ore: 'Take the ore', fight: 'Fight in the Pit',
  bounty: `Talk to ${frontier?.giver.name ?? ''}`, back: 'Take the road back to the Exchange' };
type Panel = Kind | 'allegiance';
let near: Kind | 'fight' | 'back' | 'ground' | null = null, open: Panel | null = null, groundNear: { instance: string; label: string } | null = null, groundLine = '', groundLineUntil = 0;   // groundNear: the ground item the prompt is for (ground-pickup.ts)
// ?region=1: the way back, from the Frontier's signpost to the Exchange's west gate, facing into the plaza.
const goBack = () => { if (!frontier) return; const r = frontier.road; state.x = r.from.x + Math.sin(r.inward) * 2; state.z = r.from.z + Math.cos(r.inward) * 2; heading = r.inward; presence?.warp('zone1-road-end'); };   // presence moves the player itself: a client jump is a teleport it would strike
const tapNear = () => { if (near === 'fight') void startFight(); else if (near === 'back') goBack(); else if (near === 'ground') { if (groundNear) void groundPickup.tap(groundNear.instance); } else openPanel(near); };
const show = (kind: Panel | null) => { const was = open; open = kind; if (kind === 'journal') hint.hidden = true; else if (was === 'journal' && !hintMoved) hint.hidden = false; shade.hidden = !kind; if (kind) card.innerHTML = kind === 'allegiance' ? picker.render(allegiance, playerName) : play.render(kind); };
function openPanel(kind: Panel | null) {
  play.fresh(); picker.reset(); if (kind === 'ore') play.takeOre();
  show(kind); if (kind) { keys.clear(); releaseSticks(); }
  if (kind === 'bank' || kind === 'blacksmith') void play.load();
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
  if (fighting) return;   // the duel's own keys (src/fight/input.ts) own the keyboard while it is up
  if (e.code === 'Escape') openPanel(null); else if (e.code === 'KeyE' && near && !open) tapNear();
});

// Zone look (look.ts, World lane): the Pit's own light to the gate, a lamp-lit dusk in the Exchange, blended along the passage. Behind ?look=zones until the region flag carries it (a look test; absent = today's light).
const ZONE1 = /[?&]look=zone1\b/.test(location.search), ZONE_LOOK = ZONE1 || REGION || /[?&]look=zones\b/.test(location.search),
  HAZE = REGION && !ZONE1 && !/[?&]look=zones\b/.test(location.search),
  LOOK_STOPS = ZONE1 ? [{ at: 0, preset: 'zone1' }] : HAZE ? [{ at: -60, preset: /[?&]look=night\b/.test(location.search) ? 'frontier-night' : DUEL ? 'frontier-duel' : CINDER ? 'cinder-haze' : 'frontier-haze' }, { at: -20, preset: 'ash-pit' }] : [{ at: -10, preset: 'ash-pit' }, { at: -30, preset: 'exchange-dusk' }];   // ?region=1: the Pit's light to the west gate, the Frontier's haze by x -60 (the walk is along -x)
const ZONE_FIELDS = loadZone(), FIXED_HOUR = zoneHour(ZONE_FIELDS);   // the zone's own look/time fields (schema.ts): only what the zone or its biome SET changes anything
const DAYNIGHT = !/[?&]daynight=(?:0|off)\b/.test(location.search) && zoneDayNight(ZONE_FIELDS), T0 = performance.now(), START_HOUR = Number(/[?&]hour=(\d+(?:\.\d+)?)/.exec(location.search)?.[1] ?? 12);   // ON; ?daynight=0|off is the kill switch, ?hour=22 starts the clock there
const duelGround = new Set<THREE.MeshStandardMaterial>(); frontierGroup?.traverse((o) => { if ((DUEL || ZONE_FIELDS.set?.includes('look.ground.tint')) && o.name === 'frontier-ground-stone' && (o as THREE.Mesh).isMesh) duelGround.add((o as THREE.Mesh).material as THREE.MeshStandardMaterial); });   // ?look=duel, or a zone that SETS look.ground.tint: the Frontier's own dirt is what the tint reaches (inert on every other look, so they are unchanged)
const GROUNDS = ZONE1 ? [exchange.ground] : [...duelGround], STONES = ZONE1 ? [exchange.stone] : [];   // hoisted: applyLook runs every frame
let kit = false, worldPhase = 'ready', facing = 0, camLock = true, lockOn: { x: number; z: number } | null = null;   // kit: the Pit's controls are the walk's; camLock: the lock-on (the ☰ chip), saved per player
const STRIKES = new Set<string>(['light', 'light_left', 'light_right', 'heavy', 'thrust', 'kick', 'skill']), LOCK_M = previewRule('lockRange'), CAMLOCK_KEY = 'origins-preview.camera-lock.v1';
try { camLock = localStorage.getItem(CAMLOCK_KEY) !== 'off'; } catch { /* storage blocked: locked, the default */ }
const WALK = SPEEDS.player.walk, RUN = SPEEDS.player.run, TURN = previewRule('turnRate'), followCam = createFollowCamera(camera, { passage: zoneCamera<Passage>('camera.passage'), open: pickFraming(ZONE_FIELDS.fields!['camera.presets'] as Presets, /[?&]camera=([a-z])\b/.exec(location.search)?.[1], ZONE_FIELDS.fields!['camera.preset'] as string) });   // the zone row's camera data; presets and preset come from the schema DEFAULTS (camera B) unless the zone sets them; ?camera=a|b picks a preset on this page
function zoneCamera<T>(path: string): T | undefined { return ZONE_FIELDS.set?.includes(path) ? ZONE_FIELDS.fields![path] as T : undefined; }   // a camera field the zone (or its biome) SET
function step(dt: number) {
  let running = !!held('ShiftLeft', 'ShiftRight'), forward = held('KeyW', 'ArrowUp') * (running ? 2 : 1) - held('KeyS', 'ArrowDown') * 0.6, turn = held('KeyA', 'ArrowLeft') - held('KeyD', 'ArrowRight'), strafe = 0, pitch = 0;
  if (open) forward = turn = 0;
  else if (kit) {   // the Pit's own controls (src/fight/input.ts over the game's kit, pit-duel.ts world mode): stick walks, a button presses the nearest creature into a duel
    const i = duel!.worldIntent(), k = i.run ? 2 : 1;
    forward = Math.max(-0.6, Math.min(1, -i.z)) * k; strafe = Math.max(-1, Math.min(1, i.x)) * 0.7 * k; running = i.run;
    lockOn = camLock ? mobs?.nearest(state.x, state.z, LOCK_M) ?? null : null;
    if (lockOn) heading += wrapAngle(Math.atan2(lockOn.x - state.x, lockOn.z - state.z) - heading) * (1 - Math.exp(-6 * dt));   // the Pit's lock: the camera swings behind the hero to face it
    const a = i.action;
    if (a === 'skill2' && slotShown([equippedCast(), equippedCast(1)], 1)) wc.cast2();   // the SPELL 2 button: slot b's own spell, cooldown and cost; an empty slot shows no button and the press does nothing
    else if (a === 'skill' && equippedCast()) wc.cast();   // the SKILL button is the equipped spell's cast (the Pit's special slot); with no spell it stays the light cut
    else if (a === 'heavy') wc.press('heavy'); else if (a === 'thrust') wc.press('thrust'); else if (a === 'kick') wc.press('kick'); else if (a && STRIKES.has(a)) wc.press('light');
    if (a === 'dodge' || a === 'backstep') {   // the stick's world direction (forward = (sin h, cos h)); backstep with no stick goes backwards; a plain dodge with no stick rolls where he faces
      const f = -i.z, st = i.x, len = Math.hypot(f, st), wx = Math.sin(heading) * f - Math.cos(heading) * st, wz = Math.cos(heading) * f + Math.sin(heading) * st;
      wc.roll(len > 0.2 ? { x: wx, z: wz } : a === 'backstep' ? { x: -Math.sin(wc.hero().facing), z: -Math.cos(wc.hero().facing) } : { x: 0, z: 0 });
    }
    wc.guard(i.guard, i.guardDirection); const hp = wc.hero().phase; worldPhase = hp === 'roll' ? 'roll' : hp === 'guard' ? 'guard' : 'ready'; facing = wc.hero().facing;

  }
  else if (pads.move || pads.look) ({ forward, strafe, turn, pitch, running } = intent(pads.move, pads.look));   // the sticks win while a thumb is down
  if (forward || turn || strafe || pitch) { hint.hidden = true; hintMoved = true; }   // the first-load hint goes once you move (Lead 2026-10-06)
  { const ph = wc.hero().phase; if (ph === 'windup' || ph === 'active') forward = strafe = 0; }   // a cut commits him: he stands through it
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
    if (HAZE && DAYNIGHT) look = blendLook(look, lookOf('frontier-night'), nightness(FIXED_HOUR ?? gameHour(performance.now() - T0, undefined, START_HOUR)) * Math.min(1, Math.max(0, (-20 - state.x) / 40)));   // the Frontier's 100-minute day (daynight.ts); the Pit and the passage stay as they are
    sunHome.set(...applyLook(scene, renderer, sun, hemi, withZoneLook(look, ZONE_FIELDS), GROUNDS, STONES).sunPos);
  }
  hero.position.set(state.x, groundY(state.x, state.z), state.z); hero.rotation.y = kit && (worldPhase === 'roll' || worldPhase === 'backstep') ? facing : heading;
  body.position.y = 0.88 + (forward ? Math.abs(Math.sin(performance.now() / 160)) * 0.04 : 0);
  // The engine's actor poses him: the gait follows the speed he actually covers (collisions included, signed backwards), the pose / progress / attack / contact come from the engine's actorPose of his duel.
  if (warriors) {
    gaitSpeed += (Math.hypot(state.x - px, state.z - pz) / Math.max(dt, 1e-3) - gaitSpeed) * (1 - Math.exp(-dt * 14)); if (gaitSpeed < 0.015) gaitSpeed = 0;
    const duel = wc.heroDuel(), posed = forcedPose ?? (duel ? actorPose({ duel } as unknown as Practice, 0) : { pose: 'ready' as const, progress: 0, attack: 'light' as const, contact: 0.35 });
    const dx = state.x - px, dz = state.z - pz, moved = Math.hypot(dx, dz);
    warriors.player.update(forward < 0 ? -gaitSpeed : gaitSpeed, dt, posed.pose, posed.progress, posed.attack, posed.contact, moved > 1e-6 ? (dx * Math.cos(heading) - dz * Math.sin(heading)) / moved : 0);
  }
  // Follow camera: the engine's (src/fight/follow-camera.ts); Zone 1's passage is the only zone parameter, and only on the Pit/Exchange page.
  followCam.update(dt, { x: state.x, z: state.z, heading, pitch: pitchNow, groundY: groundY(state.x, state.z) });
  const atForge = Math.hypot(state.x - FORGE.x, state.z - FORGE.z) < 6;
  const zone = frontier && frontierZoneAt(frontier, state.x, state.z);
  showZone(zone ? zone.zone : null);
  if (frontier && frontierParts && !mobsAsked && (zone || onRoad(frontier, state.x, state.z))) {
    mobsAsked = true;
    void import('./mobs-view.ts').then((m) => { mobs = m.createMobs(scene, frontier, frontierParts, { phone: PHONE, groundAt: groundY, onCut: (id, at, from) => { const sp = mobs?.find(id)?.spec ?? null; const w = sp && woundSpec(sp.character, sp.body); if (w) wounds().cut(w, at, from); }, renderer, camera, after: arena.ready }); }).catch((error: unknown) => console.warn('the Frontier creatures did not load', error));
  }
  // Zone 1's own combat (wc.update below) is stepped with the walk, every frame.
  if (mobs) { mobs.update(dt, state, cardId); woundFx?.update(dt); engageAhead.frame(mobs.within(state.x, state.z, 16).map((m) => ({ id: m.spec.id, dist: m.dist, aggro: m.spec.aggro })), (id) => wc.debug().some((f) => f.id === id)); { const aim = mobs.nearest(state.x, state.z, 3.5); const mv = wc.update(dt, { x: state.x, z: state.z, facing: aim ? Math.atan2(aim.x - state.x, aim.z - state.z) : heading }); zoneFx.frame(wc.takeContacts(), dt); if (mv.dx || mv.dz) { const rx = state.x + mv.dx, rz = state.z + mv.dz; if (canStand(rx, rz)) { state.x = rx; state.z = rz; } else if (canStand(rx, state.z)) state.x = rx; else if (canStand(state.x, rz)) state.z = rz; } if (!duelLayer.classList.contains('infight')) meters.feed(wc); document.body.classList.toggle('infight', wc.inCombat()); spawnNet.tick(); zoneSound.flush(); } if ((cardClock += dt) > 0.2) { cardClock = 0; { const seen = (mobs.debug() as { mobs: { id: string; x: number; z: number; mode: string }[] }).mobs, f = seen.find((m) => m.id === legendFocus); if (f && Math.hypot(f.x - state.x, f.z - state.z) > LEGEND_REACH * 2) legendFocus = null; cardId = creatureCard.update(seen, state, legendFocus, wc.target()?.id ?? null); } } }
  const label = zone ? zone.name : frontier && state.x < -19.5 ? 'The West Road' : atForge ? 'The Blacksmith' : state.z > -11 ? 'The Pit' : state.z > PASSAGE.to ? 'The Gladiator Gate' : state.z > -58 ? 'The Concord Exchange' : 'The Exchange — the bank';
  if (place.textContent !== label) { place.textContent = label; presence?.flush(); }   // a new place: presence hears the pose now, so the place it saves is fresh
  const g = frontier?.giver, sign = frontier?.signs.find((s) => s.back);
  groundNear = groundPickup.nearest(state.x, state.z);
  near = g && Math.hypot(state.x - g.at.x, state.z - g.at.z) < T.reach.forge ? 'bounty'
    : sign && Math.hypot(state.x - sign.at.x, state.z - sign.at.z) < 6 ? 'back'
    : Math.hypot(state.x, state.z) < T.reach.pit ? 'fight'
    : Math.hypot(state.x - T.orePile.x, state.z - T.orePile.z) < T.reach.ore && play.oreWanted() ? 'ore'
    : groundNear ? 'ground'
    : Math.max(Math.abs(state.x - FORGE.x) - FORGE.halfX, Math.abs(state.z - FORGE.z) - FORGE.halfZ) < T.reach.forge ? 'talk'
    : state.z < BANK_STEP_Z + T.reach.bank && Math.abs(state.x) < T.reach.bankHalfWidth ? 'bank' : null;
  const lineOn = Date.now() < groundLineUntil;   // a ground result line holds the prompt's slot (ground-pickup.json lineSec), inert, instead of a toast over the fight buttons
  prompt.hidden = !(near || lineOn) || !!open; if (lineOn) prompt.textContent = groundLine; else if (near) prompt.textContent = near === 'ground' ? groundNear!.label : NEAR[near]!;
  prompt.toggleAttribute('data-slot', !prompt.hidden); prompt.style.pointerEvents = lineOn ? 'none' : '';
  sun.position.copy(hero.position).add(sunHome); sun.target.position.copy(hero.position);
}

// ?region=1: the zone you stand in and its ambience.preset, for the look (the World lane's look.ts listens for `origins:zone`; this page
// sets no light, fog or sky). Off the Frontier the Exchange's own data names the preset (exchange-dusk; the Pit's ash-pit).
const otherNames = new Map<number, { name: string | null; guest: boolean; worn: Record<string, string> }>();   // id -> name tag and worn gear {slot: lootId}, from presence's `enter` records (Web's remote-hero view reads it)
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
let cleanPlan = false;   // the last look at the scene (planUpload), taken once every kind and the hero were warmed, found nothing left to compile or upload: a zone is ready only after such a look, never between two looks (the 3 s re-plan), or a material that streamed in after the last plan links at the engage (seamless #87, 71 vs 73 programs on the same tree)
const uploaded = new WeakSet<object>();   // textures and geometries already on the GPU through this path
// The first duel frame used to upload ~9 textures and ~45 geometries the walk camera had never drawn (objects off its frustum): 29-79 ms of JS, and 175 ms once (WebKit, Mac, 2026-10-08). Put them on the GPU DURING the walk, a few per
// frame under a time budget (UPLOAD_BUDGET_MS of work a frame, so no frame is long): textures through initTexture, geometries by drawing a proxy mesh of each (cheap basic material, culling off) into a 4x4 target. Same path in every browser.
const UPLOAD_BUDGET_MS = previewRule('uploadBudget');
const KINDS_WAIT_MS = previewRule('kindsWait'), MATERIAL_BOUND_MS = previewRule('materialBound');   // each scene-material compile on the chain is bounded too: one that never settles is logged and skipped, so the chain, programsInFlight and [zone ready] go on
const kindsWarmed = async () => { const t0 = performance.now(); for (;;) { const w = mobs?.warmState(); if (!w || !w.kinds.length || w.warmed.length >= w.kinds.length || performance.now() - t0 > KINDS_WAIT_MS) return; await new Promise((r) => setTimeout(r, 50)); } };   // a zone with no mobs view or no kinds has nothing to wait for; the backstop keeps one stuck kind from holding every material compile (each kind is itself bounded by WARM_BOUND_MS)
function planUpload() {
  wounds();   // the wound fx are made on the first wound (a lazy ??=): make them here so their ground marks exist for the compile below, not at the first hit (T4 2026-10-10: one unmapped 'basic' program linked at engage)
  const textures = new Set<THREE.Texture>(), geometries = new Set<THREE.BufferGeometry>(), materials = new Map<THREE.Material, THREE.Mesh | THREE.Points>();
  scene.traverse((o) => {
    const sp = o as THREE.Sprite; if (sp.isSprite) { const t = sp.material.map; if (t && !uploaded.has(t)) textures.add(t); return; }   // a creature's name label and its '!' are canvas-texture sprites: first drawn at first sight, so they upload here (Metal trace: +1 texture at engage, #1921)
    // Particle clouds (clash sparks, foot dust, skill impact, wound and splat points) are THREE.Points with their own programs, made hidden (warmHidden) and first drawn at a hit: a fight that starts before [zone ready] linked two 'points' programs at engage (CI seamless, #2289/#2299). Their materials join the compile below (the copy is shown there); their geometry needs no proxy draw.
    const pt = o as THREE.Points; if (pt.isPoints) { const mat = pt.material as THREE.PointsMaterial; if (!uploaded.has(mat) && !materials.has(mat)) materials.set(mat, pt); if (mat.map && !uploaded.has(mat.map)) textures.add(mat.map); return; }
    const m = o as THREE.Mesh; if (!m.isMesh || (m as THREE.SkinnedMesh).isSkinnedMesh) return;   // skinned bodies are warmed by their own stage (pit-duel warmStage / warmOwn), not here
    for (const mat of Array.isArray(m.material) ? m.material : [m.material]) if (!uploaded.has(mat) && !materials.has(mat)) materials.set(mat, m);
    if (!uploaded.has(m.geometry)) geometries.add(m.geometry);
    for (const mat of Array.isArray(m.material) ? m.material : [m.material]) for (const v of Object.values(mat)) if (v && (v as THREE.Texture).isTexture && !uploaded.has(v)) textures.add(v as THREE.Texture);
  });
  linkProxy(renderer, camera);   // the shared proxy's program is linked now, before [zone ready], and stays (warm-proxy.ts)
  const queue: (() => void)[] = [];
  for (const t of textures) queue.push(() => { renderer.initTexture(t); uploaded.add(t); });
  for (const g of geometries) queue.push(() => { drawProxy(renderer, camera, g); uploaded.add(g); });
  // The copy is shown: compile skips hidden objects, and the fx marks (wound spots, splats) are created hidden.
  for (const [mat, m] of materials) queue.push(() => { uploaded.add(mat); programsInFlight++; compileChain = compileChain.then(kindsWarmed).then(() => { const holder = new THREE.Group(), copy = m.clone(); copy.visible = true; holder.add(copy); return settleWithin('scene-material', renderer.compileAsync(holder, camera, scene), MATERIAL_BOUND_MS); }).catch(() => {}).finally(() => { programsInFlight--; }); });   // the scene's own materials (the arena's iron, the Exchange's stone) link their programs now, not when first in view; the geometry draws above use a proxy material and never link them. One chain, started after the body kinds are warmed, so the compiles never pile up on the frames the creatures are being revealed in
  uploadTotal += queue.length; return queue;
}
function warmUpload(time: number) {   // each walk frame: a slice of the plan under the budget (at least one item); when the plan is done, look again every 3 s for what has streamed in since (new bodies, props)
  if (!mobs || !skyReady) return;
  if (!uploadQueue.length) { if (time < uploadNext) return; uploadNext = time + 3; uploadQueue = planUpload(); cleanPlan = !uploadQueue.length && allWarmed(); if (!uploadQueue.length) return; }
  const t0 = performance.now();
  while (uploadQueue.length && (performance.now() - t0 < UPLOAD_BUDGET_MS)) uploadQueue.shift()!();
  uploadMs = Math.round(performance.now() - t0);   // the latest slice's cost, for ?perf and the A/B
}
// "Zone ready" (the single point loadZone's ready hook will become, #1913): every body kind of the zone has its programs linked and textures and geometry uploaded, and the walk's own upload plan is drained.
// After it, nothing in the zone should compile or upload at a creature's first sight or at engage (the Metal trace's acceptance). Logged with the program count.
let zoneReadyAt = -1;
async function warmHero(anchor: THREE.Object3D) {   // the player's own programs and textures, off-frame, before the zone is ready (not only the creature kinds': Zone 2's goblin + wolf share none of his materials)
  try { await settleWithin(PLAYER, warmActor(renderer, camera, scene, cloneRig(anchor), nextFrame), KINDS_WAIT_MS); } catch (error) { warmedHero.failed = true; console.warn('hero warm-up failed', error); }
  warmedHero.done = true;
}
const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
// The programs another player's gear brings (warm-kits.json, drawn through dressRemote), linked AFTER [zone ready] and off its critical path (Lead's ruling on #2938, 2026-10-16 night: before ready the one kit in flight cost +8 s of [zone ready] on SwiftShader and the cap cannot cut a compile). One kit per idle slice, and NO kit starts while a creature is within tap range (the engage window the seamless row guards); the kit already in flight cannot be cut. Nothing is fetched or
// parsed for it (loot.glb's pieces come from the scene the ground view loads, the second rig is built from the hero's parsed asset, which buildWarriors clones). `originsPreview.remoteKitsWarm()` answers null until done, then { failed, ms, programs }; on failed: true
// the page keeps remotes on the BASE figure (a first-sight compile is the stutter this removes); otherwise it dresses them (dressRemote).
let remoteKitsWarm: { failed: boolean; ms: number; programs: number; warmed: number } | null = null;
const sharedLoot = () => sceneOf(lootUrl).then((root) => lootPiecesOf(root));
const secondActor = () => { if (!warriors) throw new Error('the hero rig has not loaded'); return buildWarriors(warriors.asset, undefined, undefined, true).player; };
// One idle slice, then wait while a creature is within tap range; gives up (the loop reports failed) once `until` passes with one still there.
async function kitSlice(until: number) {
  for (;;) {
    await new Promise<void>((r) => { if ('requestIdleCallback' in window) requestIdleCallback(() => r(), { timeout: KINDS_WAIT_MS }); else requestAnimationFrame(() => r()); });
    if (!mobs?.within(state.x, state.z, previewRule('tapRange')).length) return;
    if (performance.now() > until) throw new Error('a creature stayed within tap range');
  }
}
async function warmRemoteKitsAfterReady() {
  const t0 = performance.now();
  let pieces: Awaited<ReturnType<typeof sharedLoot>> | undefined, remote: ReturnType<typeof secondActor> | undefined;
  // warmActor links the colour programs off-scene; a piece's SHADOW depth program only links in a real frame's shadow pass (the T4 count: goblin.Body's), so each kit also stands two frames in the scene, 60 m under the ground (a worn draw is never frustum-culled, so the shadow pass still takes it).
  const cap = previewRule(/[?&]kitwarm=soft\b/.test(location.search) ? 'kitWarmMsSoft' : 'kitWarmMs');   // ?kitwarm=soft is the browser rows' flag: software GL links a kit in ~40 s, so they get the longer row; the live page never carries it
  const until = t0 + cap;
  // A kit's shadow-pass link is one synchronous step (no API makes it async): on a slow device it stalls the main thread for seconds (CI's software GL: a 1.0 s and a 2.4 s gap, Bob never expired in the remote-heroes row). So the warm-up first samples the frame gaps
  // (kitProbeFrames) and skips itself when their median is above kitSlowFrameMs: failed, none warmed, remotes keep the BASE figure. ?kitwarm=soft forces the warm (the budget row), for a deliberate run on software GL.
  if (!/[?&]kitwarm=soft\b/.test(location.search)) {
    const gaps: number[] = []; let last = await new Promise<number>((r) => requestAnimationFrame(r));
    for (let i = 0; i < previewRule('kitProbeFrames'); i++) { const now = await new Promise<number>((r) => requestAnimationFrame(r)); gaps.push(now - last); last = now; }
    if (tooSlow(gaps, previewRule('kitSlowFrameMs'))) {
      console.warn(`remote-kit warm-up skipped: the median frame gap is above ${previewRule('kitSlowFrameMs')} ms (a slow device), remotes keep the base figure`);
      remoteKitsWarm = { failed: true, ms: Math.round(performance.now() - t0), programs: renderer.info.programs?.length ?? -1, warmed: 0 };
      return;
    }
  }
  const warmOne = async (kit: WarmKit) => {
    await kitSlice(until);
    if (!pieces || !remote) { pieces = await sharedLoot(); remote = secondActor(); remote.anchor.position.set(hero.position.x, -60, hero.position.z); scene.add(remote.anchor); }
    dressRemote(remote, pieces, kit.worn); await warmActor(renderer, camera, scene, cloneRig(remote.anchor), nextFrame); await nextFrame(); await nextFrame();
  };
  // Its own cap (kitWarmMs, from [zone ready]): at the cap the loop stops before its next kit, waits for the ONE kit in flight (never longer than KINDS_WAIT_MS), and reports failed (Web keeps base figures until every kit is done).
  const r = await warmKitsWithin(warmKits(), warmOne, cap, settleWithin, () => { if (remote) scene.remove(remote.anchor); }, KINDS_WAIT_MS);
  if (r.failed) console.warn(`remote-kit warm-up failed after ${r.warmed} of ${warmKits().length} kits`);
  await r.ended;   // a kit that outlasts the hard bound (a slow runner) is still compiling here: remoteKitsWarm is set only once the loop has truly ended, so nothing reads the programs (or links one) after it is non-null
  remoteKitsWarm = { failed: r.failed, ms: Math.round(performance.now() - t0), programs: renderer.info.programs?.length ?? -1, warmed: r.warmed };
}
function allWarmed() {   // every body kind and the hero are warmed (or failed): the plan taken now can be the zone's last look
  const w = mobs?.warmState();
  return !!w && w.kinds.length > 0 && warmDone(warmList(w.kinds), [...w.warmed, ...(warmedHero.done ? [PLAYER] : [])], [...w.failed, ...(warmedHero.failed ? [PLAYER] : [])]);
}
function zoneReadyCheck() {
  if (zoneReadyAt >= 0 || !mobs) return;
  const w = mobs.warmState();
  if (!warmedHero.done && !warmedHero.failed && performance.now() > HERO_WAIT_MS) { warmedHero.failed = true; console.warn('hero actor never arrived; the zone goes ready without him'); }   // bounded: a hero file that never settles must not hold the zone
  if (!allWarmed() || !cleanPlan || uploadQueue.length || programsInFlight || uploadTotal === 0) return;
  zoneReadyAt = Math.round(performance.now());
  const detail = { atMs: zoneReadyAt, programs: renderer.info.programs?.length ?? -1, kinds: w.warmed, failed: w.failed, player: warmedHero.done };
  (window as unknown as { __zoneReady?: unknown }).__zoneReady = detail; console.info('[zone ready]', detail);
  void warmRemoteKitsAfterReady();   // off the critical path: [zone ready] is already logged
}
let gearMount: ReturnType<typeof mountGear> | undefined;   // the gear screen (gear-mount.ts), mounted with the Pit's kit
const walkLoop = () => {
  const dt = Math.min(clock.getDelta(), 0.05), time = clock.elapsedTime;
  const room = gearMount?.gear(); if (room) { room.frame(dt); return; }   // the gear screen is up: it draws the hero in its own scene and the walk waits
  step(dt); warmUpload(time); zoneReadyCheck(); arena.update(dt, [], camera); exchange.update(time);
  fires?.update(time, state, warm);   // the camps' flames, and the Exchange's brazier lights lent to the nearest camps while the walker is among them (camp-fire.ts)
  forgeGlow.intensity = 14 * (0.8 + 0.2 * Math.sin(time * 7.1) * Math.sin(time * 3.7));
  warm.forEach((l, i) => { l.intensity = 9 * (0.85 + 0.15 * Math.sin(time * 9 + i * 2.1) * Math.sin(time * 5.3 + i)); });
  if (remote) { if (others !== shownOthers) { shownOthers = others; remote.push(others, performance.now()); } remote.update(dt, performance.now(), state, camera); }   // the other players, eased between packets
  camera.updateMatrixWorld(); mobs?.clampLabels(camera, labelFloor, innerHeight); remote?.clampLabels(camera, labelFloor, innerHeight);
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
// The daily board (origins/board): a button under the Journal and a dialog; the tasks, their words and their names are rows, the reset is the board rule's.
const boardButton = document.getElementById('walk-board')!, board = mountBoard(document.getElementById('board-dialog') as HTMLDialogElement, (now) => boardView(now, boardNamer()));
boardButton.textContent = chromeText('button'); boardButton.addEventListener('click', () => { keys.clear(); releaseSticks(); board.open(); });
// ?region=1: the walk uses the Pit's controls exactly (Dom 2026-10-07). pit-duel.ts (its own chunk) binds the game's kit and src/fight/input.ts in world mode; until
// it has loaded the old floating sticks still work, and if it never loads they stay. The ☰ menu's "Camera locked" chip is the lock-on, saved in this page's own key.
if (frontier) {
  duelLayer.classList.add('world'); duelLayer.hidden = false;
  void import('./pit-duel.ts').then(async (m) => {
    await m.sceneReady;
    duel = m; m.enterWorld(leaveFight, zoneExit()); kit = true; releaseSticks(); document.body.classList.add('kit'); syncSpell2Button();   // the Pit's buttons exist now: show SPELL 2 if slot b is already filled
    hint.textContent = 'Left stick walks. Push to the edge to run. Walk up to a creature and press STAB, SLASH or HEAVY to fight it. Drag empty screen to look round when the camera lock is off.';
    // Dom's UI rule: the main screen is the combat HUD and the ☰ only, so the walk's Journal lives in the ☰'s Settings row (index.html hides the corner button).
    const menu = document.getElementById('journal') as HTMLDialogElement | null, chips = document.getElementById('mobile-sound')?.parentElement;
    if (menu && chips) {
      const entry = document.createElement('button'); entry.id = 'menu-journal'; entry.textContent = 'Journal';
      entry.addEventListener('click', () => { menu.close(); openPanel('journal'); });
      chips.append(entry);
      const repairEntry = document.createElement('button'); repairEntry.id = 'menu-repair'; repairEntry.textContent = repairText('button');   // the smith: worn pieces and the writer's quote, one repair per click
      repairEntry.addEventListener('click', () => { menu.close(); void repairScreen.open(); });
      chips.append(repairEntry);
      const statsEntry = document.createElement('button'); statsEntry.id = 'menu-stats'; statsEntry.textContent = statsText('button');   // the stats sheet, beside the Journal
      statsEntry.addEventListener('click', () => { menu.close(); void statsScreen.open(); });
      chips.append(statsEntry);
      const shopEntry = document.createElement('button'); shopEntry.id = 'menu-shop'; shopEntry.textContent = shopText('button');   // the Exchange provisioner: buy only, at the price the writer reports (shop_stock) through shop_buy
      shopEntry.addEventListener('click', () => { menu.close(); shopScreen.open(); });
      chips.append(shopEntry);
      const boardEntry = document.createElement('button'); boardEntry.id = 'menu-board'; boardEntry.textContent = chromeText('button');   // the daily board, beside the Journal (the corner button is hidden in the kit)
      boardEntry.addEventListener('click', () => { menu.close(); board.open(); });
      chips.append(boardEntry);
      // The engine's gear screen, in the zone: the Pit's own sheet over this page's cut of the ☰ menu, the hero dressed in-zone (gear-mount.ts). Guest or signed in, the Pit's rules.
      try { gearMount = mountGear({ renderer, menu, layer: duelLayer, storage: localStorage, search: location.search, bodyUrl: ASSETS.hero! }); } catch (error) { console.warn('the gear screen did not mount; the rest of the ☰ stays', error); }
      if (gearMount) { const gearEntry = document.createElement('button'); gearEntry.id = 'menu-gear'; gearEntry.textContent = 'Gear'; gearEntry.addEventListener('click', () => gearMount?.open()); chips.append(gearEntry); }
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
// The open-world cast (Strategy order 2026-10-14): the equipped spell is the viewer's pick from the account's grimoire (src/core/spell-equip.ts, the Pit page's own), read at load like the Pit page does; the world hero carries it (world-combat hero dep) and SKILL casts it.
try { useSpellStore(localStorage); } catch { useSpellStore(undefined); }
const spellSkills = createServerSkills({ storage, search: location.search, now: () => Date.now() }); void spellSkills.refresh();
void getGrimoire(storedToken(storage, Date.now()), { base: writerBase(location.search), timeoutMs: 8000 }).then((got) => { if (!bookIsOffline(got)) { setOwnedSpells(got.map((x) => x.legend)); syncSpell2Button(); } }, () => {});
const equippedCast = (slot = 0) => pickSpell(equippedSpell(slot), ownedSpells(), spellSkills.values());
// The SPELL 2 button exists only while slot b holds a spell (Strategy's ruling): toggled when a pick or the book changes, never per frame.
// The Pit's HUD (pit-duel.ts) draws the button and runs every frame, so the page tells it whether slot b is filled instead of touching the element (which the HUD would re-hide).
const spellNames = new Map<string, string>();   // legend id -> the catalogue's spell name, read once through the lazy catalogue (the entry bundle carries no spell data)
function syncSpell2Button() {
  const id = equippedCast(1)?.id;
  duel?.setWorldSlotB(slotShown([equippedCast(), equippedCast(1)], 1), id ? spellNames.get(id) : undefined);
  if (id && !spellNames.has(id)) { spellNames.set(id, ''); void loadSpellInfo().then((SPELL_INFO) => { spellNames.set(id, SPELL_INFO[id]?.spell ?? ''); syncSpell2Button(); }).catch(() => { /* the generic label stays */ }); }
}   // the HUD owns the button (src/fight/hud.ts); the page only says whether slot b is filled   // the record needs a slot-a spell beside slot b
onSpellsChanged(syncSpell2Button); syncSpell2Button();
let allegiance = loadAllegiance(storage), playerName = 'You', characterId: string | null = null;
// Presence (origins/presence): signed in, the page joins it and poses at its tick; presence saves the place, the page never says "save". The page offers the v2 whole-world frame (Zone 1 included) and falls back to v1 (the Concord square only, pose withheld outside it); ?presence=0 is the kill switch.
const AUTH_READY = ensureFreshSession(storage, Date.now(), () => authClient({ url: import.meta.env.VITE_SUPABASE_URL as string | undefined, key: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined }));   // a stale session is renewed once, before presence, the saved career and the paid fight read it
let startWarped = false;   // the first hello of a Zone 1 page is answered with a warp to the start landmark
if (presenceWanted(location.search)) void AUTH_READY.then(() => { presence = joinPresence({
  token: storedToken(storage, Date.now()), guest: true, url: presenceUrl(location.origin), open: (url, protocols) => new WebSocket(url, protocols) as never,   // guest: signed out = a guest in the shared world (the server mints its identity; nothing is saved)
  pose: () => ({ x: state.x, z: state.z, heading }),   // the client withholds a pose a v1 server cannot hold (presence-client.ts); the v2 frame holds the town and all of Zone 1
  onHello: (at) => {   // where the server placed us (a rejoin lands where it was left)
    if (frontier && !startWarped) { startWarped = true; presence?.warp('zone1-start'); return; }   // the Zone 1 page starts among the creatures: ask presence for that landmark (X2: never a coordinate), its next hello confirms
    if (Math.hypot(at.x - state.x, at.z - state.z) > 1 && canStand(at.x, at.z)) { state.x = at.x; state.z = at.z; followCam.snap(); }
  },
  onOthers: (list) => { others = list; },
  onEnter: (who) => { otherNames.set(who.id, { name: who.name, guest: who.guest, worn: who.worn }); },
}); });
addEventListener('pagehide', () => presence?.stop());   // the socket's close is the 'on leave' the server saves on
function showCareer() {
  allegianceButton.hidden = fighting || !pickerOpen('saved' in source, careerLine(session.career).level);
  const c = careerLine(session.career), extra = 'saved' in source ? previewCp(source, session.career) : last?.award?.cp ?? 0;
  career.textContent = careerHud(c, extra, !!frontier);   // Zone 1 labels the level as the career's (the world fight is a bare body until Combat applies the sheet there)
  saveNote.textContent = saveLine(source);
  if (canSignIn(source)) { const a = document.createElement('a'); a.href = SIGN_IN_HREF; a.textContent = 'Sign in'; a.style.cssText = 'pointer-events:auto;color:inherit;text-decoration:underline;display:inline-flex;align-items:center;min-height:44px;min-width:44px;padding:0 0 0 8px'; saveNote.append(' · ', a); }
}
showCareer();
// The saved career, once, in the background: the walk and the Pit never wait on it. A fight is never re-based under the player, so a career that arrives while one is on is held and adopted
// when it ends (late-open.ts); on any failure the in-memory preview career stands, marked offline. The character id and name carry no fight state and are taken at once.
const lateOpen = createLateOpen<Opened>((opened) => {
  session = { career: opened.career, settled: new Set(), fights: 0 }; source = { saved: opened.career }; last = null; play.standAt(careerLine(session.career).level); showCareer();
}, () => fighting);
void AUTH_READY.then(() => openedAccount({ storage, search: location.search })).then((opened) => {
  if (isOffline(opened)) { source = opened; showCareer(); return; }
  playerName = opened.characters[0]?.name ?? playerName; characterId = opened.characters[0]?.id ?? null;
  lateOpen.arrive(opened);
});
async function startFight(pick?: string): Promise<PitFight | null> {
  if (duelFailed) { location.reload(); return null; }   // a browser keeps a failed import's error for the page's life, so the retry is a fresh page
  const next = nextFight(session, LEGEND_OPPONENTS, session.career.pitWins, pick);
  if (!next) return null;
  const before = session;
  session = started(session); fight = next; last = null; showCareer();
  openPanel(null); keys.clear(); releaseSticks(); prompt.hidden = true; hint.hidden = true;
  fighting = true; duelLayer.hidden = false; canvas.hidden = journalButton.hidden = boardButton.hidden = allegianceButton.hidden = true; place.textContent = 'The Pit — a duel';
  renderer.setAnimationLoop(null);
  document.getElementById('art-status')!.textContent = 'Loading…';   // the arena is black until its art is in; the scene clears this when ready (Lead 2026-10-06)
  try { duel ??= await import('./pit-duel.ts'); await duel.sceneReady; } catch {
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
// A legend boss (origins/preview/legend-mobs.ts): a tap within LEGEND_REACH asks the server for `boss:<legend>` (encounter_start), plays the duel on the server's seed with a record, and posts the record
// to encounter_settle; a verified win takes the legend's spell (origins/server/grimoire.ts). A guest or an offline page is told to sign in / try again and nothing starts.
const LEGEND_REACH = previewRule('legendReach');
const legendNet: LegendNet = { token: () => storedToken(storage, Date.now()), character: () => characterNow(), start: (t, c, e) => startEncounter(t, c, e, { base: writerBase(location.search) }), settle: (t, f, r) => settleEncounter(t, f, r, { base: writerBase(location.search) }) };
async function legendFight(spec: MobSpec) {
  if (fighting || duelFailed) return;
  const begun = await beginLegendFight(spec, legendNet);
  if (!begun.ok) { say(begun.say); return; }
  fighting = true; duelLayer.hidden = false; canvas.hidden = journalButton.hidden = allegianceButton.hidden = true; place.textContent = `${spec.name} — a legend`;
  openPanel(null); keys.clear(); releaseSticks(); prompt.hidden = true; hint.hidden = true;
  renderer.setAnimationLoop(null);
  try { duel ??= await import('./pit-duel.ts'); await duel.sceneReady; } catch { duelFailed = true; leaveFight(); say('Could not load the duel. Reload to try again.'); return; }
  if (!fighting) return;
  duel.openDuel(duelLayer, begun.duel as never, { ended: (_finish, record) => { void finishLegendFight(spec, begun, record, legendNet).then((line) => { if (line) worldToast(line); }); }, again: () => leaveFight() }, leaveFight);
}
const zoneExit = () => exitFace(loadZone().name);   // the host's words for the gear screen's exit (Lead 2026-10-09)
function leaveFight() {
  if (!fighting) return;
  const leaveButton = document.getElementById('leave')!; leaveButton.hidden = false; leaveButton.textContent = 'Leave the Pit';
  fighting = false; duel?.closeDuel(); document.getElementById('hunt-result')?.remove();
  duelLayer.hidden = !frontier; canvas.hidden = journalButton.hidden = boardButton.hidden = false; showCareer(); keys.clear();
  lateOpen.settle();   // a saved career that arrived during the fight is adopted now (late-open.ts)
  if (frontier && duel) { duelLayer.classList.add('world'); duel.enterWorld(leaveFight, zoneExit()); kit = true; lockOn = null; }   // back to the walk: the same kit, the walk's controls again
  clock.getDelta(); renderer.setAnimationLoop(walkLoop);
}
if (creaturesLook(location.search)) void import('./creature-voice.ts').then((m) => m.listenCreatures());   // ?look=creatures: the Frontier creatures' growl (a look test, default silent)
// ?region=1: the hunt. A quick tap on a creature (not a drag: that is a stick) walks you into a fight with it when it is near enough; the duel
// is Combat's (pit-duel.ts). A win clears the creature for a while; the server's kill_report pays (kill-apply.ts) and the page holds no loot.
const REACH = previewRule('tapRange'), TAP_MS = previewRule('tapMs'), TAP_PX = previewRule('tapPx');   // m a creature may be tapped from; a tap is a press that stays put (a resting stick does nothing, so a slow one is still a tap: on a busy main thread the up event lands hundreds of ms after the down, measured 600 ms)
const tapLog: string[] = [], taps = new Map<number, { t: number; x: number; y: number; far: number; lx: number }>(), caster = new THREE.Raycaster(), ndc = new THREE.Vector2();
const itemName = itemNamer(), guestContent = loadEncounterContent(), guestHeld = guestBag();   // a signed-out player's session loot: in memory only
let sayTimer = 0;
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
  if (spec.legend) { legendFocus = spec.id; if (Math.hypot(x - state.x, z - state.z) > LEGEND_REACH) say(`${spec.name} is a legend: walk closer, then tap.`); else void legendFight(spec); return; }   // a legend boss is fought on the verified encounter path, never the open loop
  if (Math.hypot(x - state.x, z - state.z) > 3.5) say(`${spec.name} is too far off: walk closer, then press an attack.`); else wc.press();   // Zone 1's own combat: a tap on a creature in reach is a cut
}
function pressEngage() { wc.press(); }   // STAB / SLASH / HEAVY / KICK / SKILL near a creature
// Zone 1's OWN combat loop (Dom/Strategy 2026-10-08: the wild is continuous and open, no fight start/end), run by the shared fight engine (src/fight/world.ts); world-combat.ts mounts it here.
const meters = createZoneBars(<T extends HTMLElement>(id: string) => document.getElementById(id) as T, document.body); hudWatch.observe(document.querySelector('.combat-hud')!);   // the Pit's own bars (src/fight/hud.ts createZoneBars; look: src/style.css): the foe in reach, health, stamina, plus the hit vignette
function heroDeathSequence() {
  const veil = document.createElement('div'); veil.id = 'world-death'; veil.textContent = 'You died';
  veil.style.cssText = 'position:fixed;inset:0;z-index:6;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.62);color:#e8dcc8;font:600 26px/1 Georgia,serif;pointer-events:none';
  document.body.append(veil);
  setTimeout(() => { veil.remove(); state.x = TOWN_RESPAWN.x; state.z = TOWN_RESPAWN.z; followCam.snap(); presence?.warp('town-respawn'); woundFx?.clear(); wc.reset({ x: state.x, z: state.z, facing: heading }); }, 2000);   // everything kept; full health in town
}
function creatureFell(spec: MobSpec) {
  mobs?.fell(spec.id);
  const answer = spawnNet.killed(spec.id, wc.record()).then((k) => { const shown = applyServerKill(session, source, k); if (shown) { session = shown.session; source = shown.source; showCareer(); } return k; });   // the server's verified kill (beta ledger): its paid CP moves the saved career at once (kill-apply.ts); a guest or an offline page changes nothing
  const quest = bountyQuestId(frontier!.giver);
  const bountyTaken = !!spec.encounter && play.bountyOpen(quest) && play.bountyPaid(quest, spec.encounter);   // the journal step only: no value is held on the page, the server's kill_report pays
  void answer.then((k) => {   // ONE kill path: the screen shows what the server paid; a guest sees what the same table rolled for this session (guest-loot.ts: held in memory, never saved) with a nudge to sign in to keep it
    const guest = 'offline' in k && k.offline === 'no-session' && guestContent.ok ? guestKillLoot(guestContent.value, spec.character, spec.level, (Math.random() * 2 ** 32) >>> 0) : null;
    if (guest) guestHeld.add(guest);
    worldToast(killToast(k, itemName, spec.name, bountyTaken, guest));
  });
}
// Every world creature fight is server-verified when signed in (origins/server/world-spawns.ts): one engage token per creature, joiners included; guests send nothing.
const characterNow = characterFor({ storage, search: location.search }, () => characterId, (id) => { characterId = id; });
// The smith screen (origins/preview/repair-*.ts): gear_wear lists the worn pieces with the writer's own quote; a repair is one gear_repair under a fresh op id. The page prices and wears nothing.
const repairName = itemNamer(), repairBase = { base: writerBase(location.search) };
const repairScreen = mountRepair(document.getElementById('repair-dialog') as HTMLDialogElement, {
  nameOf: repairName,
  read: async () => { const character = await characterNow(); return character ? readWear(storedToken(storage, Date.now()), character, repairBase) : { offline: 'no-session' }; },
  repair: async (instance) => { const character = await characterNow(); return character ? repairPiece(storedToken(storage, Date.now()), character, instance, repairOp(instance, Date.now()), repairBase) : { offline: 'no-session' }; } });
// The stats screen (origins/preview/stats-*.ts): the player's stored build (level, points placed) from the writer; the effective sheet (build plus worn gear) is shown only when the writer's sheet is supplied (the world sheet series), never guessed here.
const statsScreen = mountStats(document.getElementById('stats-dialog') as HTMLDialogElement, async () => {
  const own = await fetchOwnBuild({ storage, search: location.search });
  return own ? { level: own.level, placed: own.placed } : { offline: storedToken(storage, Date.now()) ? 'unreadable' : 'no-session' };
});
// The shop screen (origins/shops): the rows as the writer reports them (shop_stock: the next unit's price with the zone tax, the account's stock, the restock time); a buy is one shop_buy op under a fresh op id, and the writer prices, stocks and gates it.
const shopName = itemNamer(), shopBase = { base: writerBase(location.search) };
const shopScreen = mountShop(document.getElementById('shop-dialog') as HTMLDialogElement, {
  list: () => REGION1_SHOPS.get(EXCHANGE_PROVISIONER), nameOf: shopName, read: () => readStock(storedToken(storage, Date.now()), EXCHANGE_PROVISIONER, shopBase),
  buy: async (item, revision) => {
    const character = await characterNow();
    return character ? buyOne(storedToken(storage, Date.now()), character, EXCHANGE_PROVISIONER, item, revision, newOp(item, Date.now()), shopBase) : { offline: 'no-session' };
  } });
play.link({ token: () => storedToken(storage, Date.now()), character: characterNow, base: writerBase(location.search), changed: () => { if (open === 'bank' || open === 'blacksmith') show(open); } });
const spawnNet = spawnTracker({ encode: encodeWorldRecord, token: () => storedToken(storage, Date.now()), zone: pageZoneId, character: characterFor({ storage, search: location.search }, () => characterId, (id) => { characterId = id; }), now: () => Date.now(), base: writerBase(location.search) });
let woundFx: ReturnType<typeof createWoundFx> | null = null;   // the blood a creature's catalogue `wounds` row draws (K5), made on the first wound
const wounds = () => woundFx ??= createWoundFx(scene, (id) => mobs?.anchorOf(id) ?? null, { feel: PHONE ? 'low' : 'high', groundAt: groundY, camera: () => camera, hero: () => state });
const zoneFx = createZoneFx({ scene, camera, rigs: { hero: () => warriors?.player ?? null, foe: (id) => mobs?.rig(id) ?? null } });   // every zone page: the engine's contact effects, one instance per active pair (src/fight/zone-fx.ts)
const zoneSound = createZoneSound(() => loadFeedback(), soundWanted(location.search));   // K8: the Pit's own combat cues, fed by wc's events (zone-sound.ts)
for (const type of ['pointerdown', 'touchend', 'keydown'] as const) addEventListener(type, () => zoneSound.unlock(), { passive: true });
// Ground loot (ground-pickup.ts): the page reads ground_state once the session is fresh and then every row.pollSec; a take is one ground_take for the character, then the pack is read again and the cue plays.
const groundSay = (line: string): void => { groundLine = line; groundLineUntil = Date.now() + groundPickup.lineSec * 1000; };   // a result line takes the prompt's slot for lineSec
const groundPickup = createGroundPickup({
  view: groundItems, signedIn: () => !!storedToken(storage, Date.now()), guestTake: (item, quantity) => guestHeld.add({ loot: [{ item, quantity }], bronze: 0 }), nameOf: repairName, refreshPack: () => play.load(), cue: (kind) => zoneSound.groundLoot(kind), say: groundSay,
  read: () => readGround(storedToken(storage, Date.now()), repairBase),
  take: async (instance) => { const character = await characterNow(); return character ? takeGround(storedToken(storage, Date.now()), character, instance, repairBase) : { offline: 'no-session' }; },
});
void AUTH_READY.then(() => groundPickup.refresh()); setInterval(() => void groundPickup.poll(state.x, state.z, document.hidden), groundPickup.pollSec * 1000);   // not while the tab is hidden or the walker is far from every item
document.addEventListener('visibilitychange', () => { if (!document.hidden) void groundPickup.poll(state.x, state.z, false); });
(typeof requestIdleCallback === 'function' ? (f: () => void) => requestIdleCallback(f, { timeout: 3000 }) : (f: () => void) => setTimeout(f, 1000))(() => zoneSound.preload());   // the feedback chunk loads at idle, so the first gesture's unlock is synchronous (iOS resumes audio only inside the gesture)
const spawnEvent = onCombatEvent(spawnNet, ME);
const engageAhead = createEngageAhead(spawnNet, () => Date.now());   // the engage token is asked for inside a creature's aggro radius, before the join: the bout's roll seed needs it (engage-ahead.ts)
let ownBuild: OwnBuild | undefined;   // the character's stored build (build_get), the other half of the sheet the writer holds a world record equal to
let buildInflight = false;   // a build_get is on its way (each call times out on its own: the offline fallback below never fires while one is still pending)
const loadOwnBuild = (tries: number): void => { buildInflight = true; void fetchOwnBuild({ storage, search: location.search }).then((b) => { if (b) { ownBuild = b; wc.heroChanged(); } else if (tries > 0) setTimeout(() => loadOwnBuild(tries - 1), 30_000); }).finally(() => { buildInflight = false; }); };   // an offline or slow writer is asked again, so one failed fetch does not leave a geared player unpaid for the session
loadOwnBuild(10);
// No fight starts on the bare body because the sheet was late: a signed-in character's creatures wait for the build (build_get) and the worn-gear view to answer. A guest has no server view to wait for; an unanswered writer is waited
// on for LOADOUT_WAIT_MS only (then he fights bare, and rebody() gives him the sheet at the next clean window open). A 0-dial build answers with the default build, so it is ready at once and fights at 150 hp.
// The worn-gear view is READ HERE, at load (the Pit does it at main.ts:770; Zone 1 only did it when the Gear screen opened, so a signed-in character fought bare until he opened it) and re-asked every GEAR_RETRY_MS until it answers.
// The gate (loadout-gate.ts, tested) latches once ready, keeps asking the gear view after a latch until it answers (a writer blip must not leave him ungeared), and both numbers are preview-rules rows.
const loadoutReady = createLoadoutGate({ now: () => Date.now(), signedIn: () => !!storedToken(storage, Date.now()), buildHeld: () => ownBuild !== undefined, buildInflight: () => buildInflight, gearReady: () => gearMount?.ready() ?? false, askGear: () => { if (!gearMount) return false; void gearMount.refresh().then(() => wc.heroChanged()); return true; },   // no gear screen yet is NOT "answered": the gate keeps asking until it exists and has answered (a signed-in player never fights on the bare body because the screen mounted late)
 wait: previewRule('loadoutWait'), retry: previewRule('gearRetry') });
const wc = createWorldCombat({
  loadoutReady,
  canPlay: canPlayFinisher,
  onCreatureHit: (spec, hit) => { const w = woundSpec(spec.character, spec.body); if (w) wounds().hit(spec.id, w, hit); },
  onCreatureTick: (spec, t) => { const w = woundSpec(spec.character, spec.body); if (w) wounds().tick(spec.id, w, t.hpFrac, t.dt, t.x, t.z, t.seed); },
  onCreatureGone: (id) => woundFx?.forget(id),
  engageToken: (id) => spawnNet.tokenOf(id),
  mobs: () => mobs, hero: () => { const sheet = gearMount?.sheet(ownBuild), spell = equippedCast(), spell2 = spell ? equippedCast(1) : undefined; return { level: careerLine(session.career).level, ...(sheet ? { sheet } : {}), ...(spell ? { spell } : {}), ...(spell2 ? { spell2 } : {}) }; }, onKill: (spec) => void creatureFell(spec), onHeroDied: heroDeathSequence, onEvent: (ev) => { spawnEvent(ev); zoneSound.event(ev); },
  onHeroHit: () => meters.flash(),
});
document.getElementById('leave')!.addEventListener('click', leaveFight);
// Debug (the dressRemote warm-up proof, scripts/remote-programs-check.mjs): a second hero actor beside the walker, re-dressed with one source kit at a time through dressRemote. The page's own renderer links what that kit needs,
// so renderInfo() before and after names the programs a remote wearing it would compile after zone ready.
let probeActor: ReturnType<typeof secondActor> | undefined, probePieces: Awaited<ReturnType<typeof sharedLoot>> | undefined;
async function remoteProbe(opponent: string): Promise<{ worn: string[]; missing: string[] }> {
  if (!probeActor || !probePieces) { probePieces = await sharedLoot(); probeActor = secondActor(); scene.add(probeActor.anchor); }
  const ahead = camera.getWorldDirection(new THREE.Vector3()).setY(0).normalize().multiplyScalar(4);   // in the camera's view, so the frame draws it and links its programs
  probeActor.anchor.position.set(camera.position.x + ahead.x, hero.position.y, camera.position.z + ahead.z);
  const [kit, only] = opponent.split(':');   // 'goblin' = the whole kit, 'goblin:Helmet' = one slot of it
  const worn = Object.fromEntries(probePieces.filter((p) => p.userData.opponent === kit && p.userData.slot !== 'Weapon' && (!only || p.userData.slot === only)).map((p) => [String(p.userData.slot), lootIds(p)[0]!]));
  return { worn: Object.values(worn), missing: dressRemote(probeActor, probePieces, worn) };
}
// Which scene objects use each linked program (material type:name @ the object's parent chain), for a seamless receipt: a program that links at the engage is named by its owner, so a red row says what it was.
function programOwners(): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  scene.traverse((o) => {
    const mats = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined; if (!mats) return;
    for (const m of Array.isArray(mats) ? mats : [mats]) {
      const p = (renderer.properties.get(m) as { currentProgram?: { id: number; name: string } }).currentProgram; if (!p) continue;
      const chain: string[] = []; for (let n: THREE.Object3D | null = o; n && chain.length < 4; n = n.parent) chain.push(n.name || n.type);
      const list = out[`${p.name}#${p.id}`] ??= []; if (list.length < 4) list.push(`${m.type}${m.name ? `:${m.name}` : ''} @ ${chain.join('<')}`);
    }
  });
  return out;
}
(window as unknown as { originsPreview: unknown }).originsPreview = {
  combat: () => ({ hero: wc.hero(), trace: wc.trace(), target: wc.target(), fighters: wc.debug(), fx:zoneFx.active(), fxProbe: zoneFx.probe() }), press: (kind?: 'light' | 'heavy' | 'thrust' | 'kick') => wc.press(kind),   // Zone 1's combat loop, for the browser checks
  presence: () => ({ state: presence?.state() ?? 'off', others, names: Object.fromEntries(otherNames) }),
  pos: state, canStand, place: (x: number, z: number, h: number) => { state.x = x; state.z = z; heading = h; }, open: openPanel,
  // ?region=1: the zone you stand in (with its ambience preset), the Frontier layout's spots, and the Bounty giver's talk.
  region: () => frontier && { camps: camps.map((c) => ({ at: c.at, spots: c.spots })), zone: zoneNow, giver: frontier.giver.at, back: frontier.signs.find((s) => s.back)!.at, road: frontier.road, near,
    zones: frontier.zones.map((z) => ({ zone: z.zone, preset: z.preset, landmarks: z.landmarks })) },
  remoteProbe, remoteKitsWarm: () => remoteKitsWarm,   // null until the idle warm-up of another player's gear programs is done, then { failed, ms, programs }: draw a remote in the base figure until it answers
  renderInfo: () => ({ triangles: renderer.info.render.triangles, calls: renderer.info.render.calls, programs: renderer.info.programs?.length ?? 0, programNames: (renderer.info.programs ?? []).map((q) => `${q.name}#${q.id}`), programKeys: Object.fromEntries((renderer.info.programs ?? []).map((q) => [`${q.name}#${q.id}`, String((q as unknown as { cacheKey?: string }).cacheKey ?? '').slice(0, 140)])), geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, programOwners: programOwners() }),   // the last frame's cost (perf checks)
  remote: () => remote?.debug() ?? null, setOthers: (list: Other[]) => { others = list; }, knowRemote: (id: number, who: { name: string | null; guest: boolean }) => remote?.know(id, who),   // browser checks: a stub presence feed, and what is drawn of it
  wounds: () => woundFx?.debug() ?? null, mobs: () => mobs?.debug() ?? null, pose: () => ({ worldPhase, actor: !!warriors }), forcePose: (p: ReturnType<typeof actorPose> | null) => { forcedPose = p; },   // browser checks: hold the hero in one engine pose (null releases it)
  tapLog: () => [...tapLog],
  // tap a creature by id as the page would (same reach rule).
  ground: { show: (id: string, item: string, x: number, z: number) => groundItems.show(id, item, { x, z }), hide: groundItems.hide, clear: groundItems.clear, anchor: groundItems.anchor, pointOf: groundPointOf, say: groundSay },   // for a capture and slice 3's page
  promptSpots: () => ({ fight: [0, 0], talk: [FORGE.x, FORGE.z], bank: [0, BANK_STEP_Z + T.reach.bank - 1] }),   // where the hero stands for each walk prompt (a check places the hero here and measures the prompt: scripts/ground-prompt-check.mjs)
  uploadMs: () => uploadMs,   // the walk's world upload: the latest slice's ms (-1 before the first); uploadLeft() = items still queued, uploadItems() = all planned so far
  uploadLeft: () => uploadQueue.length, uploadItems: () => uploadTotal,
  tapMob: (id: string) => { const m = mobs?.find(id); if (!m) return false; engage(m.spec, m.x, m.z); return true; },
  // where a creature is on screen (CSS px), for a real touch tap in a browser check; null while it is down or off screen.
  mobScreen: (id: string) => { const m = mobs?.find(id); if (!m) return null; const v = new THREE.Vector3(m.x, 1, m.z).project(camera), r = canvas.getBoundingClientRect(); return v.z > 1 || Math.abs(v.x) > 1 || Math.abs(v.y) > 1 ? null : { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height }; },
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
