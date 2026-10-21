import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { actorPose, buildWarriors, createZoneFinisher, MissingClip, type CutRig, type FinisherId, type Practice } from '../../src/fight/index.ts';
import { catalogueBodyUrl, OPPONENTS, worldBodyUrl, type WeaponId } from '../../src/fight/index.ts';
import type { Duel } from '../../src/fight/index.ts';
import { budgetTextures, FIGHTER_TEXTURE_CAP } from '../../src/fight/index.ts';
import type { Build, Frontier } from './frontier-plan.ts';
import { dressMob } from './mob-dress.ts';
import { drawProxy, linkProxy } from './warm-proxy.ts';
import { bodyFileOfKey, bodyKeyOf, bodyScale, mobLook, mobVariant } from './mob-looks.ts';
import { loadoutRow } from '../world/loadouts-rules.ts';
import { TITLES, type Tier } from '../../src/core/index.ts';
import { calmStep, type Calm } from './calm-step.ts';   // (named so the world-sim list in tests/core-boundary.test.ts C7 does not grow)
import { loadLoot, lootWorn, loadRankLook, loadShape, type RankLook } from '../../src/fight/index.ts';
import { NotHeroRig, fitPieces, fxHas, fxNum, shapeFor } from '../../src/fight/index.ts';
const HERO_GAP = fxNum('reach.gap');   // m of clear air between a big creature's mouth and the hero's edge (Dom 2026-10-17: it was in his face)
const HERO_EDGE = fxNum('reach.hero-edge');   // m from the hero's centre to his edge (src/fight/fx-rows.json), read once
const mouthReach = (opponent: string): number => fxNum(fxHas(`reach.${opponent}`) ? `reach.${opponent}` : 'reach.default');   // m from a creature's centre to its mouth per unit of look scale: a row per creature, `reach.default` for the rest (quadrupeds are built 1 m long, centred)
import { gateWithBound, settleWithin } from '../../src/fight/index.ts';
import { labelSprite } from './label-sprite.ts';
import { pickDrawn } from './draw-pick.ts';
import { farHide } from './far-detail.ts';
import { TUNING, hiddenInFight, mobSpecs, previewRows, mobStand, newMob, pickVisible, stepMob, type Mob, type MobSpec, labelCeilingNdc } from './mobs.ts';
import { legendSpecs } from './legend-mobs.ts';
import { pageSignedIn } from './save.ts';
import { previewRule } from './preview-rules.ts';

// ?region=1: the Frontier's creatures drawn (bite 1: visible and wandering, nothing fights). This module is its own chunk and main.ts imports
// it only when the hero first reaches the west road, so the Pit/Exchange page never pays for it. The bodies are the roster's own GLBs (the
// Pit fights with the same files), one download per body kind, fetched only when a creature of that kind first comes within reach; every
// creature of a kind is a SkeletonUtils clone of that one scene with its own tinted materials. Until its body lands a capsule stands in.
const URLS: Record<string, string> = Object.fromEntries(['goblin', 'knight', 'pitborn', 'witch'].map((id) => [id, catalogueBodyUrl(id)!]));   // the engine's bodies, by catalogue row (K11); the wolf is served by worldBodyUrl (public/world), not bundled
// The open world draws Characters' 8k-tri world bodies (same rig and clip names) where they exist; the duel keeps the roster GLB.
// Which kinds draw a world body is the catalogue row's `worldBody` flag (worldBodyUrl); public/world (#1716): served by URL, never bundled, so check-budget does not count them as fighters.
const FETCH_RANGE = TUNING.range + previewRule('fetchMargin');   // m: a body kind is fetched when one of its creatures is this near
const FETCH_RANGE_PHONE = previewRule('fetchRangePhone');           // m: on a phone only when one is close (~4 MB a body kind; the goblin serves every common creature)
// How each creature is dressed (scale, cloth tint, soot) is Characters' (mob-looks.ts + mob-dress.ts); this view only asks.
const NEAR = previewRule('nearTick');   // m: inside it a creature's mixer ticks every frame

type Body = { scene: THREE.Group; clips: THREE.AnimationClip[] } | 'loading' | 'failed';
type Actor = ReturnType<typeof buildWarriors>['player'];
type View = { group: THREE.Group; stand: THREE.Mesh; model: THREE.Object3D | null; actor?: Actor; ring: THREE.Mesh; bang: THREE.Sprite; label: THREE.Sprite; speed: number; px: number; pz: number; pending: number; skip: number; wearIds?: readonly string[]; wearRung?: string; ranked?: boolean; farOff?: THREE.Object3D[] };   // wearIds: the loadout's armour pieces this creature puts on once the carrier file is in

function bangSprite(): THREE.Sprite {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d')!;
  g.font = '800 56px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 8; g.strokeStyle = 'rgba(10,8,6,0.9)'; g.strokeText('!', 32, 34); g.fillStyle = '#ff5a3c'; g.fillText('!', 32, 34);
  const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, fog: false, sizeAttenuation: false }));
  s.scale.set(0.045, 0.045, 1); return s;
}

export type MobDrive = { x: number; z: number; facing: number; moving: boolean; duel?: Duel; fall?: number; finisher?: FinisherId };   // World's combat loop (world-combat.ts) drives a creature while it fights: its position, the duel it is in (the engine's actor poses it: bite, hurt) and, once down, the death clip's progress (0..1)
export type MobPick = { spec: MobSpec; x: number; z: number; dist: number };
/** A creature inside a radius, and whether it is HUNTING (P0-b): its sim mode is 'aggro' (it noticed the hero) or the combat loop already drives it. A passive wanderer inside the join ring is not hunting, so it never enters the loop or stops a record window opening. */
export type MobNear = MobPick & { hunting: boolean };
export type Mobs = {
  update(dt: number, hero: { x: number; z: number }, hideLabel?: string | null): void; debug(): unknown; seen(): { id: string; x: number; z: number; mode: string }[];
  clampLabels(camera: THREE.Camera, floorPx: number, heightPx: number): void;   // before the draw: a name tag under the HUD slides down the view to just below it
  pick(ray: THREE.Ray): MobPick | null;   // the nearest drawn creature the ray passes through (a generous sphere: a thumb is not a pixel)
  anchorOf(id: string): THREE.Object3D | null;   // a creature's drawn body (its rig's root), for the blood a wound draws on a part's bone; null while it is not drawn
  rig(id: string): { anchor: THREE.Object3D; boneWorld(name: string): THREE.Vector3 | null } | null;   // the creature's actor rig, for the engine's contact effects (wound marks, blade blood); null while it has no actor
  find(id: string): MobPick | null;       // a creature by id, where it stands now (null while it is down)
  nearest(x: number, z: number, within: number): MobPick | null;
  within(x: number, z: number, r: number): MobNear[];   // every drawn creature inside r metres, each marked hunting or passive
  drive(id: string, pose: MobDrive | null): void;   // null gives the creature back to its own wander   // the closest drawn creature inside `within` metres of a point (the lock-on and the attack buttons)
  setAggro(id: string, aggro: number): number | null;   // a creature's notice radius for now (the war band's rally); returns the one it had so the caller can restore it, null for an unknown creature
  engage(id: string | null): void;        // a world duel is up: this creature is the duel's foe, drawn by the duel, so it is not drawn here (null: back). Every other creature keeps wandering and animating
  fell(id: string): void;                 // a creature that lost the fight: gone for RESPAWN seconds, then back at its round
  setAggro(id: string, aggro: number): number | null;   // a creature's notice radius for now (the war band's rally); returns the one it had so the caller can restore it
  locate(body: string, x: number, z: number): { x: number; z: number } | null;   // the nearest creature of a body to a point, drawn or not (a test link `?fight=wolf` walks the hero to a wolf that is still out of draw range)
  fellOthers(keep: string): void;        // every creature of the zone but one, drawn or not: a test link's one-on-one fight (?fight=)
  warmState(): { kinds: string[]; warmed: string[]; failed: string[] };   // the zone's body kinds, and which of them have their programs linked and textures and geometry uploaded (a kind is revealed only then); empty `kinds` with no renderer
};
const RESPAWN = previewRule('clientRespawn');   // s
const WARM_BOUND_MS = previewRule('warmBound');   // a body kind is revealed after this long even if its warm-up has not finished (a bound Claudecraft's gates lack; it is logged)
const RING = { width: previewRule('ringWidth'), segments: previewRule('ringSegments'), opacityCalm: previewRule('ringOpacityCalm'), opacityAggro: previewRule('ringOpacityAggro'), colorCalm: previewRule('ringColorCalm'), colorAggro: previewRule('ringColorAggro') };   // the creature's aggro-radius ring on the ground (rows; colours are 0xrrggbb numbers): the look it had as literals, so no change to the picture
const HIT = { common: previewRule('tapSphereCommon'), named: previewRule('tapSphereNamed') };   // m: the tap sphere's radius round a creature's chest

export function createMobs(scene: THREE.Scene, frontier: Frontier, build: Build, opts: { phone: boolean; markers?: { alert: boolean; name: boolean; ring?: boolean }; onCut?: (id: string, at: THREE.Vector3, from: { x: number; z: number }) => void; groundAt?: (x: number, z: number) => number; renderer?: THREE.WebGLRenderer; after?: Promise<unknown>; camera?: THREE.Camera; players?: () => { x: number; z: number }[] }): Mobs {
  const specs = [...mobSpecs(frontier, build, previewRows(location.search, pageSignedIn())), ...legendSpecs(frontier)], zones = new Map(frontier.zones.map((z) => [z.zone, z])), stands = specs.map((s) => mobStand(build, zones.get(s.zone)!));
  const mobs: Mob[] = specs.map((s, i) => newMob(s, i)), views = new Map<number, View>(), bodies = new Map<string, Body>(), alerted = new Set<number>();
  const cap = opts.phone ? fxNum('mob-view.phone-cap') : TUNING.cap, fetchRange = opts.phone ? FETCH_RANGE_PHONE : FETCH_RANGE;   // a phone draws fewer skinned bodies at once
  const root = new THREE.Group(); root.name = 'frontier-mobs'; scene.add(root);
  // One soft contact shadow under every creature (they cast no real shadow, for phone perf): a radial gradient that is darkest at the feet and gone before the rim, so no disc edge is ever visible (Dom 2026-10-08: "a circle stand that looks fake").
  const blobTexture = (() => { const N = 64, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d')!, gr = g.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2); gr.addColorStop(0, 'rgba(0,0,0,0.5)'); gr.addColorStop(0.45, 'rgba(0,0,0,0.22)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, N, N); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const blobGeometry = new THREE.PlaneGeometry(1.5, 1.5).rotateX(-Math.PI / 2), blobMaterial = new THREE.MeshBasicMaterial({ map: blobTexture, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  let shown: number[] = [];
  const displaced = new Set<View>(), labelAt = new THREE.Vector3();   // clampLabels: the tags it moved last frame, and its one scratch point
  const down = new Map<number, number>();   // creature index -> seconds until it is back

  // A creature whose loadout row names a main-game rank look (`look`, e.g. /looks/goblin-L5.glb) is drawn in that whole fitted figure (the Pit's own armour): its body key is `<kind>@<file>`, so each rank look is fetched, warmed and shared once.
  // A creature whose look names a bare body (`look.body`, e.g. world/kit/goblin-bare.glb) is a different body from its kind's plain one (the rank look is the Pit's armour SET fitted onto it, wearLook, not a replacement body).
  // Its body key is `<kind>@<file>` (mob-looks.ts bodyKeyOf), so each is fetched, warmed, fitted and shared once; a creature with no such look keeps the kind as its key.
  const keyOf = (s: MobSpec): string => bodyKeyOf(s.body, mobLook(s.character));
  const rankLooks = new Map<string, Promise<RankLook>>();   // each look file fetched once (the Pit's loadRankLook), fitted to every creature that wears it
  const weaponShapes = new Map<string, Promise<THREE.Mesh | undefined>>();   // each graded weapon file fetched once (the Pit's loadShape)
  const reshapeWeapon = (v: View, weapon: WeaponId, rung: string | undefined) => {   // the Pit's per-rank weapon shape (weapon-shapes.ts shapeFor: plain 1-3, crafted 4-7, ornate 8-10) at the loadout's rung
    const level = rung ? TITLES.indexOf(rung as (typeof TITLES)[number]) + 1 : 0, url = level > 0 ? shapeFor(weapon, level) : undefined;
    if (!url) return;
    const p = weaponShapes.get(url) ?? loadShape(url).catch((error: unknown) => { console.warn(`weapon shape ${url} did not load; the plain part stays`, error); return undefined; }); weaponShapes.set(url, p);
    void p.then((mesh) => { if (mesh && v.actor) v.actor.reshape(mesh.clone()); });
  };
  const wearRankLook = (v: View, file: string) => {
    const p = rankLooks.get(file) ?? loadRankLook(file); rankLooks.set(file, p);
    void p.then((look) => { if (v.actor) v.actor.wearLook(look); }).catch((error: unknown) => { rankLooks.delete(file); console.warn(`rank look ${file} did not fit; the goblin stays as it is`, error); });
  };
  const urlOfKey = (key: string): string | undefined => {   // a look's own bare body (the file after `@`), else the kind's world or engine body
    const own = bodyFileOfKey(key);
    return own ? `${import.meta.env?.BASE_URL ?? '/'}${own}` : worldBodyUrl(key) ?? URLS[key];
  };
  // The loadout's armour pieces (loot ids `<opponent>.<slot>`) come from the roster's carrier file, once per kind, and are worn on the bare body with the engine's own `wear` (the Pit's machinery).
  const carrierFiles = import.meta.glob<string>('../../src/assets/loot/carriers-*.glb', { eager: true, query: '?url', import: 'default' });
  const carriers = new Map<string, THREE.SkinnedMesh[] | 'loading'>();
  const kitOf = (ids: readonly string[] | undefined): string | undefined => ids?.[0]?.split('.')[0];   // the carrier set a loadout's pieces come from: the body id its loot ids start with (executioner.Helmet -> carriers-executioner)
  const fitCache = new Map<string, THREE.SkinnedMesh[] | null>(); let fitMs = 0, fitRuns = 0;   // piece-fit.ts: the pieces fitted to each body KEY (the creatures of one body share its bind pose), and what that cost in all (browser checks read it); null = refused, never retried
  const fitOff = /[?&]fit=0\b/.test(location.search);
  const fitFor = (key: string, pieces: THREE.SkinnedMesh[], rig: THREE.Skeleton): THREE.SkinnedMesh[] | null => {   // fitted ONCE per body key, never per frame; a refusal is logged once and remembered, never thrown in the frame
    const known = fitCache.get(key); if (known !== undefined) return known;
    const t0 = performance.now();
    try { const out = fitPieces(pieces, rig); fitMs += performance.now() - t0; fitRuns++; fitCache.set(key, out); return out; }
    catch (error) { fitCache.set(key, null); if (error instanceof NotHeroRig) console.error(`${key}: ${error.message}; no armour is worn on this body`); else console.warn(`${key}: piece fit failed; no armour is worn on this body`, error); return null; }
  };
  const putOn = (v: View, key: string) => {
    const pieces = v.actor && v.wearIds ? carriers.get(kitOf(v.wearIds) ?? '') : undefined;
    if (!v.actor || !v.wearIds || !pieces || pieces === 'loading') return;
    const bodyMesh = (() => { let m: THREE.SkinnedMesh | undefined; v.actor!.anchor.traverse((o) => { if (!m && (o as THREE.SkinnedMesh).isSkinnedMesh && o.name === 'CreatureBody') m = o as THREE.SkinnedMesh; }); return m; })(), rig = bodyMesh?.skeleton;   // the body's own skeleton: the pieces are fitted to ITS proportions (piece-fit.ts), and re-skinned off any bone its skin never uses (the troll's hands)
    const fitted = rig && bodyMesh && !fitOff ? fitFor(key, pieces, rig) : pieces;   // ?fit=0 = the engine's plain retarget, for a before/after
    if (!fitted) { v.wearIds = undefined; return; }   // refused (logged once by fitFor): the creature stays as it is
    try { v.actor.wear(fitted.filter((p) => lootWorn(p, v.wearIds!)), (id, error) => console.warn(`loadout piece ${id} did not fit`, error), () => (v.wearRung ?? 'Recruit') as Tier); }   // the rank finish the loadout row names (Veteran = level 4 ... Master = level 7)
    catch (error) { v.wearIds = undefined; console.warn('loadout armour could not be worn; the creature stays as it is', error); }   // never breaks drawing the creature
  };
  const loadCarriers = (kind: string) => {
    const url = carrierFiles[`../../src/assets/loot/carriers-${kind}.glb`];
    if (!url || carriers.has(kind)) return;
    carriers.set(kind, 'loading');
    loadLoot(url).then((pieces) => { carriers.set(kind, pieces); for (const [i, v] of views) putOn(v, keyOf(specs[i]!)); }).catch((error: unknown) => { carriers.delete(kind); console.warn(`${kind} carriers did not load; no armour is worn`, error); });
  };
  const fetchBody = (kind: string) => {
    const url = urlOfKey(kind);
    if (bodies.has(kind) || !url) return;
    bodies.set(kind, 'loading');
    loader.loadAsync(url).then((gltf) => {
      gltf.scene.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = false; });
      if (opts.phone) budgetTextures(gltf.scene, FIGHTER_TEXTURE_CAP);
      bodies.set(kind, { scene: gltf.scene, clips: gltf.animations });
      if (gate) queueWarm(kind, { scene: gltf.scene });
    }).catch((error: unknown) => { bodies.set(kind, 'failed'); failedKinds.add(kind); console.warn(`${kind} body did not load; capsules stand in`, error); });
  };

  // Warm-up (Combat #1915, Claudecraft idioms; the Metal trace, 2026-10-08: the engage frame is 18 ms, the cost is the FIRST DRAW of a body: its programs link and its textures and geometry upload inside that frame, up to 179 ms).
  // So a body kind is revealed only after, per kind and off-frame: compileAsync of one probe clone (never the whole scene, which stalls), then its textures through initTexture and its geometries through a 4x4 proxy draw, one unit per frame.
  // Until the gate opens the creature stays the capsule it already is. On a phone only the kinds near the walker are fetched (memory), so only they are warmed; elsewhere the whole zone's kinds are fetched at entry.
  const gate = !!opts.renderer && !!opts.camera, warmed = new Set<string>(), failedKinds = new Set<string>(), kindsOfZone = [...new Set(specs.map(keyOf))];
  const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
  let eagerDone = false, pumping = false, lastHero = { x: 0, z: 0 };
  const pending = new Map<string, { scene: THREE.Object3D }>();   // kinds fetched and waiting for their warm-up: nearest to the walker first (Claudecraft orders its gates by camera distance)
  async function warmKind(kind: string, body: { scene: THREE.Object3D }) {
    const renderer = opts.renderer!, camera = opts.camera!, first = specs.find((x) => keyOf(x) === kind)!, look = mobVariant(first.character, first.id);
    const probe = clone(body.scene); if (look) dressMob(probe, look);
    const holder = new THREE.Group(); holder.add(probe);   // not in the scene: the scene is only the lights and fog the programs are keyed on
    await renderer.compileAsync(holder, camera, scene);
    const textures = new Set<THREE.Texture>(), geometries = new Set<THREE.BufferGeometry>();
    probe.traverse((o) => { const m = o as THREE.Mesh; if (!m.isMesh) return; geometries.add(m.geometry); for (const mat of Array.isArray(m.material) ? m.material : [m.material]) for (const v of Object.values(mat)) if (v && (v as THREE.Texture).isTexture) textures.add(v as THREE.Texture); });
    for (const t of textures) { renderer.initTexture(t); await frame(); }
    linkProxy(renderer, camera);
    for (const g of geometries) { drawProxy(renderer, camera, g); await frame(); }
  }
  const kindDist = (kind: string) => mobs.reduce((d, m, i) => (keyOf(specs[i]!) === kind ? Math.min(d, Math.hypot(m.x - lastHero.x, m.z - lastHero.z) - (m.mode === 'aggro' ? 1000 : 0)) : d), Infinity);   // a kind with a creature that has noticed him first (the one coming for him), then by distance
  let ungated = false;   // a warm-up compile never settled: every kind from here on is revealed without its gate
  async function pump() {   // one compileAsync in flight at a time (kept serial to bound the compile load; three 0.186's own compileAsync wait already drops disposed materials, WebGLRenderer.js, so no race to work around); each kind is revealed after WARM_BOUND_MS even if its warm-up is still running, and that is logged
    if (pumping) return; pumping = true;
    try {
      await opts.after?.catch(() => {});   // programs are keyed on the scene's environment map: warm only after its final swap (the sky), or every program links twice
      while (pending.size) {
        const kind = [...pending.keys()].sort((x, y) => kindDist(x) - kindDist(y))[0]!, body = pending.get(kind)!; pending.delete(kind);
        const g = await gateWithBound(kind, warmKind(kind, body), WARM_BOUND_MS);
        warmed.add(kind);   // revealed: warmed, failed or past the bound (logged by the gate)
        if (g.result === 'late' && !(await settleWithin(kind, g.settled, WARM_BOUND_MS))) { ungated = true; for (const k of pending.keys()) warmed.add(k); pending.clear(); }   // still one compile in flight, but only for one more bound: a compile that never settles must not leave the rest of the zone a capsule (they are revealed ungated, as on trunk, and logged)
      }
    } finally { pumping = false; }
  }
  const queueWarm = (kind: string, body: { scene: THREE.Object3D }) => { if (ungated) { warmed.add(kind); return; } pending.set(kind, body); void pump(); };
  const revealed = (kind: string) => !gate || warmed.has(kind);

  const modelHeight = (m?: THREE.Object3D | null) => { if (!m) return null; const b = new THREE.Box3().setFromObject(m); return +(b.max.y - b.min.y).toFixed(2); };
  function dress(v: View, s: MobSpec, body: Exclude<Body, 'loading' | 'failed'>) {
    // The shared fight engine's actor (src/fight/characters.ts, the one the Pit plays) on the creature's own body: its clips (idle, walk, bite, hurt, death) are posed by the engine's actorPose, solo = one actor, no opponent built.
    const look = mobVariant(s.character, s.id), weapon = look?.gear ?? (OPPONENTS as Record<string, { weapon: WeaponId } | undefined>)[s.body]?.weapon ?? 'longsword';   // a variant's loadout weapon (the zone row's spread.gear), else the body's own
    let actor: Actor;
    try { actor = buildWarriors({ scene: body.scene, animations: body.clips }, undefined, [weapon, weapon], true).player; }
    catch (error) {
      // A body missing its weapon's clip pack is a content bug that tests/creature-clips.test.ts fails in CI (trunk keeps it LOUD: the sandbox's silent fallback to the default weapon's clips is not ported); in the player's frame it is logged once and the kind stays a stand-in for the session (marked failed, so it is not retried every frame).
      if (error instanceof MissingClip) console.error(`${s.body} cannot wield ${weapon}: ${error.message}`); else console.warn(`${s.body} actor did not build; the capsule stays`, error);
      bodies.set(keyOf(s), 'failed'); failedKinds.add(keyOf(s)); return;
    }
    actor.anchor.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.castShadow = false; });   // phone perf (Dom's iPhone 15, Lead 2026-10-07): a creature casts no shadow map pass (a blob decal stands in) and is frustum culled again
    const row = loadoutRow(look?.loadout);
    if (look) dressMob(actor.anchor, row?.look ? { ...look, dressing: { soot: 0, burnt: 0 } } : look);   // scale + the cloth's tint and ash; a main-game rank look keeps its own colours (no tint, no ash); a figure with no look keeps the roster body as it is
    actor.update(0, Math.random() * 3, 'ready', 0, 'light', 0.35, 0);   // not in step with its neighbours
    v.group.add(actor.anchor); v.group.remove(v.stand); v.model = actor.anchor; v.actor = actor;
    if (row?.look && look?.body) { v.ranked = true; actor.anchor.traverse((o) => { if ((o as THREE.SkinnedMesh).isSkinnedMesh) o.name = 'Skin'; }); wearRankLook(v, row.look); reshapeWeapon(v, weapon, row.rung); }   // the bare body's one draw IS his skin and face: named as the look's keep list names it, so it stays under the armour (characters.ts wearLook)
    else if (row) { actor.anchor.traverse((o) => { if ((o as THREE.SkinnedMesh).isSkinnedMesh && !o.userData.slot) o.name = 'CreatureBody'; }); if ((look?.scale ?? 1) <= fxNum('mob-view.wear-max-scale')) { v.wearIds = row.pieces; v.wearRung = row.rung; loadCarriers(kitOf(row.pieces) ?? s.body); putOn(v, keyOf(s)); } reshapeWeapon(v, weapon, row.rung); }   // the loot pieces are hero-sized: on a body bigger than the row's scale (the troll) they clip and float, so only the weapon is shown until pieces are built for it   // `wear` hangs pieces on the creature-pipeline body draw, named CreatureBody (characters.ts)   // a loadout on a bare body: put its pieces on (now if the carriers are in, else when they land)
  }

  function viewOf(i: number): View {
    let v = views.get(i); if (v) return v;
    const s = specs[i]!, group = new THREE.Group(), look = mobVariant(s.character, s.id), height = Math.max(previewRule('mobHeightMin'), (s.named ? 2.75 : 2.35) * (look?.scale ?? 1));
    const stand = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 1.1, 4, 10), new THREE.MeshStandardMaterial({ color: look ? look.tint : 0x5a4a3a, roughness: 0.9 }));
    stand.position.y = 0.85;
    const label = labelSprite(`${s.name} · Lv ${s.level}`, s.named); label.position.y = height; label.userData.y0 = height;
    const bang = bangSprite(); bang.position.y = label.position.y + 0.55; bang.visible = false;
    const ring = new THREE.Mesh(new THREE.RingGeometry(s.aggro - RING.width, s.aggro, RING.segments), new THREE.MeshBasicMaterial({ color: RING.colorCalm, transparent: true, opacity: RING.opacityCalm, side: THREE.DoubleSide, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04;
    const blob = new THREE.Mesh(blobGeometry, blobMaterial); blob.position.y = 0.03; blob.scale.setScalar(look?.scale ?? 1);
    group.add(stand, label, bang, blob);
    v = { group, stand, model: null, ring, bang, label, speed: 0, px: NaN, pz: NaN, pending: 0, skip: i }; views.set(i, v);
    root.add(group, ring);
    return v;
  }

  let engaged: string | null = null;
  const driven = new Map<number, MobDrive>();
  const FAR_OFF = typeof location !== 'undefined' && /[?&;]fardetail=0\b/.test(location.search);   // look test only: `?fardetail=0` draws every piece at every range, to compare the stills
  const rankPieces = (v: View): THREE.Mesh[] => { const found: THREE.Mesh[] = []; v.model?.traverse((o) => { if ((o as THREE.Mesh).isMesh && o.userData.rankLook) found.push(o as THREE.Mesh); }); const size = (m: THREE.Mesh) => m.geometry.getAttribute('position').count; found.sort((a, b) => size(b) - size(a)); return found.slice(1); };   // a rank look's draws but its biggest (the body): the armour pieces a far creature need not draw
  const farDetail = (v: View, d: number, matters: boolean) => {   // a phone draws a far creature's rank-look body only (its arms, gloves, greaves and helmet are a few pixels at that range); back at once when it fights, hunts or is engaged. Only the pieces that were shown are touched, so a bake that turned one off is not undone.
    if (!v.ranked || FAR_OFF) return;
    const far = farHide(d, matters, fxNum('mob-view.piece-range'));
    if (far && !v.farOff) { const pieces = rankPieces(v); if (!pieces.length) return; v.farOff = pieces.filter((p) => p.visible); for (const p of v.farOff) p.visible = false; }
    else if (!far && v.farOff) { for (const p of v.farOff) p.visible = true; v.farOff = undefined; }
  };
  const mustDraw = (): Set<number> => {   // drawn above the phone cap: the creatures fighting the hero (driven), his engaged foe, any hunting him, and any standing at another visible player (a party's or a bystander's fight)
    const must = new Set<number>(driven.keys()), reach = fxNum('mob-view.player-reach'), others = opts.players?.() ?? [];
    mobs.forEach((m, i) => { if (m.mode === 'aggro' || specs[i]!.id === engaged || others.some((p) => Math.hypot(m.x - p.x, m.z - p.z) <= reach)) must.add(i); });
    return must;
  };
  // Calmer drawn movement in a fight (mob-calm.ts; Dom 2026-10-17: "a twitch FPS"). `?mobsmooth=0` turns it off to compare.
  const backOff = new Map<number, { x: number; z: number }>();   // each creature's eased stand-back vector (see the reach shift in update)
  const calm = new Map<number, Calm>(), SMOOTH = typeof location !== 'undefined' && /[?&;]mobsmooth=1\b/.test(location.search);   // OFF by default now (Dom 2026-10-17: the drawn body trailing the engine's position felt floaty; Combat's #3056 is the real fix); ?mobsmooth=1 turns it on to compare
  const calmed = (i: number, d: MobDrive, hero: { x: number; z: number }, dt: number): Calm => {
    const prev = calm.get(i), want: Calm = { x: d.x, z: d.z, facing: d.facing };
    const now = !prev || !SMOOTH ? want : calmStep(prev, want, hero, dt, { lateralTau: fxNum('mob-view.lateral-tau'), radialTau: fxNum('mob-view.radial-tau'), turnDps: fxNum('mob-view.turn-dps'), snapM: fxNum('mob-view.snap-m'), maxOrbitDps: fxNum('mob-view.max-orbit-dps'), maxLagM: fxNum('mob-view.max-lag-m') });
    calm.set(i, now); return now;
  };
  const zoneFinisher = createZoneFinisher(scene, { groundAt: opts.groundAt, bleed: opts.onCut });   // K6: a creature the engine killed with a decapitation loses its head (the row's bones), the Pit's own ballistics
  return {
    update(dt, hero, hideLabel) {
      lastHero = hero; zoneFinisher.update(dt);
      mobs.forEach((m, i) => { const d = driven.get(i), s = d ? calmed(i, d, hero, dt) : null; mobs[i] = d && s ? { ...m, x: s.x, z: s.z, facing: s.facing, mode: d.moving ? 'wander' : 'aggro' } : specs[i]!.legend ? m : stepMob(m, specs[i]!, hero, dt, stands[i]!); });   // a legend boss stands where it is placed (it never wanders or chases: the player walks up and taps it)
      for (const [i, t] of down) { if (t - dt <= 0) { down.delete(i); } else down.set(i, t - dt); }
      shown = (opts.phone ? pickDrawn(mobs, hero, cap, TUNING.range, mustDraw()) : pickVisible(mobs, hero, cap)).filter((i) => !down.has(i));   // a phone's cap never hides a creature that matters (draw-pick.ts, Dom 2026-10-20): the desktop pick is unchanged
      if (gate && !opts.phone && !eagerDone) { eagerDone = true; for (const k of kindsOfZone) fetchBody(k); }   // the whole zone's kinds at entry (not on a phone), so they are warmed before anyone walks near
      // Fetch a body kind the first time one of its creatures is near.
      mobs.forEach((m, i) => { if (Math.hypot(m.x - hero.x, m.z - hero.z) <= fetchRange) fetchBody(keyOf(specs[i]!)); });
      const on = new Set(shown);
      for (const [i, v] of views) if (!on.has(i)) { v.group.visible = false; v.ring.visible = false; }
      // One label per kind of creature: the nearest of that name. A field of scavengers read "Cinder scavenger · Cinder scavenger · Lv 11" side by side.
      const nearestOf = new Map<string, number>();
      for (const i of shown) { const n = specs[i]!.name, d = Math.hypot(mobs[i]!.x - hero.x, mobs[i]!.z - hero.z); if (d < (nearestOf.get(n + '#d') ?? Infinity)) { nearestOf.set(n + '#d', d); nearestOf.set(n, i); } }
      for (const i of shown) {
        const m = mobs[i]!, s = specs[i]!, v = viewOf(i), body = bodies.get(keyOf(s));
        if (!v.model && body && body !== 'loading' && body !== 'failed' && revealed(keyOf(s))) dress(v, s, body);
        v.group.visible = !hiddenInFight(s.id, engaged); v.ring.visible = v.group.visible && (opts.markers?.ring ?? true);
        const gy = opts.groundAt?.(m.x, m.z) ?? 0;   // the hills: a creature stands on the ground under it
        const dv = driven.get(i);
        const look = mobVariant(s.character, s.id), ux = m.x - hero.x, uz = m.z - hero.z, dh = Math.hypot(ux, uz) || 1;
        if (opts.phone) farDetail(v, dh, driven.has(i) || m.mode === 'aggro' || s.id === engaged);
        const off = look && look.scale > bodyScale(look.opponent) ? Math.max(0, mouthReach(look.opponent) * look.scale + HERO_EDGE + HERO_GAP * Math.min(1, (look.scale - bodyScale(look.opponent)) / fxNum('reach.full-scale')) - dh) : 0;   // the clear air grows with how much bigger the body is drawn than its rig (reach.full-scale = the excess that gets the whole reach.gap): a 6 m salamander keeps 2.2 m, a 1.25 goblin about 0.1 m, so it stands about where the engine has it, not 3 m out (the headless clip measured the drawn goblin 3.1 m from the hero vs Zone 1's 1.1, a 2.7x lever on every sweep)   // a body drawn bigger than its rig (a zone look's scale) stands back along the line to the hero until its MOUTH (the row's metres per unit of scale, from its centre) is HERO_GAP m short of his edge, not in his face or inside him; presentation only, the sim's contact distance is untouched
        // The stand-back vector eases (reach.dir-tau): it is up to ~4 m long for a salamander, and as a lever on the hero-to-creature line it turned a 1 m/s sweep of the engine's body into 3-4 m/s on screen (Dom: "moving left to right very quickly"); eased, the body sweeps at the engine's own speed.
        const want = { x: (ux / dh) * off, z: (uz / dh) * off }, cur = backOff.get(i) ?? want, k = 1 - Math.exp(-dt / fxNum('reach.dir-tau')); cur.x += (want.x - cur.x) * k; cur.z += (want.z - cur.z) * k; backOff.set(i, cur);
        v.group.position.set(m.x + cur.x, gy, m.z + cur.z); v.group.rotation.y = m.facing;
        v.ring.position.set(m.x, gy + 0.04, m.z);
        const aggro = m.mode === 'aggro', mat = v.ring.material as THREE.MeshBasicMaterial;
        if (aggro && !alerted.has(i)) { alerted.add(i); dispatchEvent(new CustomEvent('origins:creature', { detail: { body: s.body, cue: 'growl' } })); } else if (!aggro) alerted.delete(i);   // the "!" fires: ?look=creatures growls (creature-voice.ts)
        v.label.visible = s.id !== hideLabel && nearestOf.get(s.name) === i && (opts.markers?.name ?? true);   // the info card (creature-card.ts) carries this creature's name and level while it is up
        v.bang.visible = aggro && (opts.markers?.alert ?? true); mat.opacity = aggro ? RING.opacityAggro : RING.opacityCalm; mat.color.set(aggro ? RING.colorAggro : RING.colorCalm);
        if (!v.model) v.stand.position.y = 0.85 + (m.mode === 'wander' ? Math.abs(Math.sin(performance.now() / 220 + i)) * 0.04 : 0);
        if (v.actor) {
          // The gait follows the speed it actually covers (the engine's gait table); the pose comes from the engine's actorPose of the duel it is in, the death clip once it is down.
          const away = Math.hypot(m.x - v.px, m.z - v.pz) / Math.max(dt, previewRule('dtFloor')); v.px = m.x; v.pz = m.z;
          v.speed += ((Number.isFinite(away) ? Math.min(away, previewRule('mobSpeedMax')) : 0) - v.speed) * (1 - Math.exp(-dt * 14)); if (v.speed < 0.015) v.speed = 0;
          const posed = dv?.fall ? { pose: 'death' as const, progress: dv.fall, attack: 'light' as const, contact: 0.35 } : dv?.duel ? actorPose({ duel: dv.duel } as unknown as Practice, 1) : { pose: 'ready' as const, progress: 0, attack: 'light' as const, contact: 0.35 };
          const tick = (step: number) => v.actor!.update(v.speed, step, posed.pose, posed.progress, posed.attack, posed.contact, 0);
          if (Math.hypot(m.x - hero.x, m.z - hero.z) <= NEAR) { v.pending = 0; tick(dt); }   // beyond NEAR a body animates a quarter as often (same speed, coarser steps)
          else { v.pending += dt; if (++v.skip % 4 === 0) { tick(v.pending); v.pending = 0; } }
          if (dv?.fall) zoneFinisher.frame(s.id, s, v.actor as unknown as CutRig, dv.fall, dv.finisher, { x: m.x, z: m.z }, hero);
        }
      }
    },
    clampLabels(camera, floorPx, heightPx) {
      const ceiling = labelCeilingNdc(floorPx, heightPx), at = labelAt;
      for (const v of displaced) v.label.position.set(0, v.label.userData.y0 as number, 0);   // the tags that slid last frame go back home first (every other tag is already home: only this function moves one), then only the drawn creatures' tags are tested, not every view ever made
      displaced.clear();
      (globalThis as unknown as { __lap?: (k: string) => void }).__lap?.('cl.reset');
      for (const i of shown) {
        const v = views.get(i);
        if (!v || !v.label.visible || !v.group.visible) continue;
        (globalThis as unknown as { __lap?: (k: string) => void }).__lap?.('cl.loopHead'); v.group.updateMatrixWorld(true); (globalThis as unknown as { __lap?: (k: string) => void }).__lap?.('cl.skeletonMatrix'); v.label.getWorldPosition(at).project(camera);
        if (at.z > 1 || at.z < -1 || at.y <= ceiling) continue;   // behind the camera, or already clear of the HUD
        at.y = ceiling; at.unproject(camera); v.group.worldToLocal(at); v.label.position.copy(at); displaced.add(v);
      }
    },
    pick(ray) {
      const sphere = new THREE.Sphere(), hit = new THREE.Vector3(); let best: MobPick | null = null;
      for (const i of shown) {
        const m = mobs[i]!, s = specs[i]!;
        sphere.set(new THREE.Vector3(m.x, 1, m.z), s.named ? HIT.named : HIT.common);
        if (!ray.intersectSphere(sphere, hit)) continue;
        const dist = hit.distanceTo(ray.origin);
        if (!best || dist < best.dist) best = { spec: s, x: m.x, z: m.z, dist };
      }
      return best;
    },
    nearest(x, z, within) {
      let best: MobPick | null = null;
      for (const i of shown) { const d = Math.hypot(mobs[i]!.x - x, mobs[i]!.z - z); if (d <= within && (!best || d < best.dist)) best = { spec: specs[i]!, x: mobs[i]!.x, z: mobs[i]!.z, dist: d }; }
      return best;
    },
    within(x, z, r) { const out: MobNear[] = []; for (const i of shown) { const d = Math.hypot(mobs[i]!.x - x, mobs[i]!.z - z); if (d <= r && !specs[i]!.legend) out.push({ spec: specs[i]!, x: mobs[i]!.x, z: mobs[i]!.z, dist: d, hunting: driven.has(i) || mobs[i]!.mode === 'aggro' }); } return out; },
    drive(id, pose) { const i = specs.findIndex((sp) => sp.id === id); if (i < 0) return; if (pose) driven.set(i, pose); else { driven.delete(i); calm.delete(i); } },
    setAggro(id, aggro) { const i = specs.findIndex((s) => s.id === id); if (i < 0) return null; const was = specs[i]!.aggro; specs[i]!.aggro = aggro; return was; },
    anchorOf(id) { const i = specs.findIndex((s) => s.id === id); return i < 0 ? null : views.get(i)?.model ?? null; },
    rig(id) { const i = specs.findIndex((s) => s.id === id), a = i < 0 ? undefined : views.get(i)?.actor; return a ? { anchor: a.anchor, boneWorld: (n) => a.boneWorld(n) } : null; },
    find(id) { const i = specs.findIndex((s) => s.id === id); return i < 0 || down.has(i) ? null : { spec: specs[i]!, x: mobs[i]!.x, z: mobs[i]!.z, dist: 0 }; },
    engage(id) { engaged = id; },
    warmState: () => ({ kinds: gate ? kindsOfZone.filter((k) => urlOfKey(k) && (!opts.phone || bodies.has(k))) : [], warmed: [...new Set([...warmed, ...failedKinds])], failed: [...failedKinds] }),   // the kinds that can be fetched (a phone: only those fetched so far), and those settled: a failed GLB stays a capsule and counts as settled, so zone ready does not wait for it forever
    fell(id) { const i = specs.findIndex((s) => s.id === id); if (i >= 0) down.set(i, RESPAWN); zoneFinisher.release(id); },
    locate(body, x, z) { let best: { x: number; z: number; d: number } | null = null; specs.forEach((s, i) => { if (s.body !== body || s.legend || down.has(i)) return; const d = Math.hypot(mobs[i]!.x - x, mobs[i]!.z - z); if (!best || d < best.d) best = { x: mobs[i]!.x, z: mobs[i]!.z, d }; }); return best; },
    fellOthers(keep) { specs.forEach((s, i) => { if (s.id !== keep) down.set(i, RESPAWN); }); },   // `within` only sees what is drawn, so a salamander still out of draw range walked in and breathed fire on a 'goblin only' fight (the headless phone clip showed it)
    // What the creature card reads every 0.2 s (id, where, mode): cheap. debug() below is the browser checks' diagnostic (a skinned box and vertex scans per creature, ~40% of the main thread when called per frame, T4 profile 2026-10-20): never call it on the page's own clock.
    seen: () => specs.map((s, i) => ({ id: s.id, x: mobs[i]!.x, z: mobs[i]!.z, mode: mobs[i]!.mode })),
    debug: () => ({
      fit: { ms: +fitMs.toFixed(2), runs: fitRuns, tris: [...fitCache.values()].filter((p): p is THREE.SkinnedMesh[] => !!p).map((p) => p.reduce((n, m) => n + (m.geometry.index ? m.geometry.index.count : m.geometry.getAttribute('position').count) / 3, 0)), draws: [...fitCache.values()].filter((p): p is THREE.SkinnedMesh[] => !!p).map((p) => p.length), refused: [...fitCache].filter(([, p]) => !p).map(([k]) => k), bodies: [...fitCache].filter(([, p]) => !!p).map(([k]) => k) },   // piece-fit.ts: the one-time load cost, and the pieces' triangles and draws per fitted body key (`bodies` names them in the same order, `refused` the keys that wear nothing)
      meshesOf: specs.map((s, i) => { const v = views.get(i); if (!v?.model) return null; const rows: string[] = []; v.group.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) rows.push(`${(m as unknown as THREE.SkinnedMesh).isSkinnedMesh ? 'skin' : 'mesh'} ${o.name || '-'}${o.visible ? '' : ' (hidden)'} v${m.geometry.getAttribute('position').count}`); }); return { id: s.id.slice(-14), parts: rows.length, rows: rows.slice(0, 24) }; }).filter(Boolean),   // browser checks: every mesh drawn under a creature
      handMesh: specs.map((s, i) => {   // browser checks: where the skin that the right-hand bone drives actually is, against that bone (gap in metres): a hand drawn away from its bone holds a weapon in the air
        const v = views.get(i), a = v?.actor, bone = a?.boneWorld('hand_r'); if (!v?.model || !a || !bone) return null;
        let body: THREE.SkinnedMesh | undefined; v.model.traverse((o) => { if (!body && (o as THREE.SkinnedMesh).isSkinnedMesh && !o.userData.rankLook && !o.userData.slot) body = o as THREE.SkinnedMesh; }); if (!body) return null;
        const si = body.geometry.getAttribute('skinIndex'), sw = body.geometry.getAttribute('skinWeight'); if (!si || !sw) return null;
        const out: Record<string, unknown> = { id: s.id.slice(-14), body: s.body };
        for (const name of ['lowerarm_r', 'hand_r', 'middle_01_r', 'index_01_r', 'thumb_01_r', 'upperarm_r']) {
          const k = body.skeleton.bones.findIndex((b) => b.name === name); if (k < 0) { out[name] = 'no bone'; continue; }
          const sum = new THREE.Vector3(), p = new THREE.Vector3(); let n = 0;
          for (let j = 0; j < si.count; j++) for (let c = 0; c < 4; c++) if (si.getComponent(j, c) === k && sw.getComponent(j, c) > 0.4) { body.getVertexPosition(j, p); p.applyMatrix4(body.matrixWorld); sum.add(p); n++; break; }
          const bw = a.boneWorld(name); out[name] = n && bw ? `${n} verts, centre ${sum.divideScalar(n).distanceTo(bw).toFixed(2)} m from its bone` : `${n} verts`;
        }
        { // both forearms' skin tips against both hand bones and the weapon: which claw is the weapon nearest to
          const tips: Record<string, unknown> = {}, w = (() => { let x: THREE.Object3D | undefined; v.model.traverse((o) => { if (!x && o.userData.weaponShape) x = o; }); return x; })();
          for (const side of ['r', 'l']) {
            const k = body.skeleton.bones.findIndex((b) => b.name === `lowerarm_${side}`), hb = a.boneWorld(`hand_${side}`), el = a.boneWorld(`lowerarm_${side}`); if (k < 0 || !hb || !el) continue;
            const dir = hb.clone().sub(el).normalize(), p = new THREE.Vector3(); let best = -Infinity; const tip = new THREE.Vector3();
            for (let j = 0; j < si.count; j++) for (let c = 0; c < 4; c++) if (si.getComponent(j, c) === k && sw.getComponent(j, c) > 0.4) { body.getVertexPosition(j, p); p.applyMatrix4(body.matrixWorld); const t = p.clone().sub(el).dot(dir); if (t > best) { best = t; tip.copy(p); } break; }
            tips[side] = { hand: [+hb.x.toFixed(2), +hb.y.toFixed(2), +hb.z.toFixed(2)], elbow: [+el.x.toFixed(2), +el.y.toFixed(2), +el.z.toFixed(2)], skinTip: [+tip.x.toFixed(2), +tip.y.toFixed(2), +tip.z.toFixed(2)], handToTip: +hb.distanceTo(tip).toFixed(2) };
          }
          { const sums = new Map<number, { s: THREE.Vector3; n: number }>(), p = new THREE.Vector3(); for (let j = 0; j < si.count; j++) { let bi = -1, bw = 0; for (let c = 0; c < 4; c++) if (sw.getComponent(j, c) > bw) { bw = sw.getComponent(j, c); bi = si.getComponent(j, c); } body.getVertexPosition(j, p); p.applyMatrix4(body.matrixWorld); const e = sums.get(bi) ?? { s: new THREE.Vector3(), n: 0 }; e.s.add(p); e.n++; sums.set(bi, e); }
            out.skinVsBone = [...sums].filter(([, e]) => e.n >= 30).map(([bi, e]) => { const b = body!.skeleton.bones[bi]!, bw = a.boneWorld(b.name); return bw ? [b.name, e.n, +e.s.clone().divideScalar(e.n).distanceTo(bw).toFixed(2)] : null; }).filter(Boolean).sort((x, y) => (y as number[])[2]! - (x as number[])[2]!).slice(0, 10); }   // bones whose skin sits far from the bone (count, metres): where the rig and the mesh disagree
          { const count = new Map<string, number>(); for (let j = 0; j < si.count; j++) { let bi = -1, bw = 0; for (let c = 0; c < 4; c++) if (sw.getComponent(j, c) > bw) { bw = sw.getComponent(j, c); bi = si.getComponent(j, c); } const nm = body.skeleton.bones[bi]?.name ?? '?'; count.set(nm, (count.get(nm) ?? 0) + 1); } out.dominant = [...count].sort((x, y) => y[1] - x[1]).map(([n, c]) => `${n}:${c}`); out.boneCount = body.skeleton.bones.length; }   // every bone that is the main driver of some skin, by vertex count
          { const near = new Map<string, number>(), p = new THREE.Vector3(); for (let j = 0; j < si.count; j++) { body.getVertexPosition(j, p); p.applyMatrix4(body.matrixWorld); if (p.distanceTo(bone) > 0.3) continue; let bi = -1, bw = 0; for (let c = 0; c < 4; c++) if (sw.getComponent(j, c) > bw) { bw = sw.getComponent(j, c); bi = si.getComponent(j, c); } const nm = body.skeleton.bones[bi]?.name ?? '?'; near.set(nm, (near.get(nm) ?? 0) + 1); } out.nearHandBone = [...near].sort((x, y) => y[1] - x[1]).slice(0, 6).map(([n, c]) => `${n}:${c}`); }   // the bones that drive the skin within 0.3 m of the hand bone
          const wo = w ? new THREE.Vector3().setFromMatrixPosition(w.matrixWorld) : null; out.sides = tips; out.weapon = wo ? [+wo.x.toFixed(2), +wo.y.toFixed(2), +wo.z.toFixed(2)] : null; out.faceDir = (() => { const f = new THREE.Vector3(0, 0, 1).transformDirection(v.group.matrixWorld); return [+f.x.toFixed(2), +f.z.toFixed(2)]; })();
        }
        { // the forearm's skin against the hand bone: how far past the bone does the skin (the claw) reach, along the forearm
          const k = body.skeleton.bones.findIndex((b) => b.name === 'lowerarm_r'), holder = body.skeleton.bones[k]; if (holder) {
            const from = new THREE.Vector3().setFromMatrixPosition(holder.matrixWorld), dir = bone.clone().sub(from).normalize(), p = new THREE.Vector3(); let tip = -Infinity, tipAt = new THREE.Vector3();
            for (let j = 0; j < si.count; j++) for (let c = 0; c < 4; c++) if (si.getComponent(j, c) === k && sw.getComponent(j, c) > 0.4) { body.getVertexPosition(j, p); p.applyMatrix4(body.matrixWorld); const t = p.clone().sub(from).dot(dir); if (t > tip) { tip = t; tipAt = p.clone(); } break; }
            out.forearm = { boneLen: +bone.distanceTo(from).toFixed(2), skinTip: +tip.toFixed(2), tipFromHandBone: +tipAt.distanceTo(bone).toFixed(2), tipAt: [+tipAt.x.toFixed(2), +tipAt.y.toFixed(2), +tipAt.z.toFixed(2)], handBone: [+bone.x.toFixed(2), +bone.y.toFixed(2), +bone.z.toFixed(2)] };
          }
        }
        return out;
      }).filter(Boolean),
      grips: specs.map((s, i) => { const v = views.get(i), a = v?.actor, hand = a?.boneWorld('hand_r'); if (!v?.model || !a || !hand) return null; let w: THREE.Object3D | undefined; v.model.traverse((o) => { if (!w && o.userData.weaponShape) w = o; }); if (!w) return { id: s.id, shape: false }; const at = new THREE.Vector3().setFromMatrixPosition(w.matrixWorld), up = new THREE.Vector3(0, 1, 0).transformDirection(w.matrixWorld), box = new THREE.Box3().setFromObject(w), size = box.getSize(new THREE.Vector3()); const finger = a.boneWorld('middle_01_r'), scale = new THREE.Vector3().setFromMatrixScale(v.model.matrixWorld).x; return { id: s.id.slice(-14), shape: true, scale: +scale.toFixed(3), fist: finger ? +(hand.distanceTo(finger) / scale).toFixed(3) : null, gap: +at.distanceTo(hand).toFixed(2), axis: [+up.x.toFixed(2), +up.y.toFixed(2), +up.z.toFixed(2)], size: [+size.x.toFixed(2), +size.y.toFixed(2), +size.z.toFixed(2)], hand: [+hand.x.toFixed(2), +hand.y.toFixed(2), +hand.z.toFixed(2)], origin: [+at.x.toFixed(2), +at.y.toFixed(2), +at.z.toFixed(2)] }; }).filter(Boolean),   // browser checks: where each creature's weapon shape sits against its right-hand bone (gap in metres, the weapon's long axis, its size)
      total: specs.length, drawn: shown.length, cap, down: [...down.keys()].map((i) => specs[i]!.id), bodies: Object.fromEntries([...bodies].map(([k, b]) => [k, typeof b === 'string' ? b : 'ready'])),
      mobs: specs.map((s, i) => ({ id: s.id, name: s.name, zone: s.zone, body: s.body, level: s.level, x: +mobs[i]!.x.toFixed(2), z: +mobs[i]!.z.toFixed(2), mode: mobs[i]!.mode, drawn: shown.includes(i), model: !!views.get(i)?.model, height: modelHeight(views.get(i)?.model), at: views.get(i) ? [+views.get(i)!.group.position.x.toFixed(2), +views.get(i)!.group.position.z.toFixed(2)] : null, loadout: mobVariant(s.character, s.id)?.loadout ?? null, worn: (() => { const out: string[] = []; views.get(i)?.model?.traverse((o) => { if ((o as THREE.SkinnedMesh).isSkinnedMesh && o.userData.slot) out.push(`${o.userData.slot}`); }); return out; })(), mouth: (() => { const b = views.get(i)?.actor?.boneWorld('Head') ?? views.get(i)?.actor?.boneWorld('head'); return b ? [+b.x.toFixed(2), +b.y.toFixed(2), +b.z.toFixed(2)] : null; })() })),   // height: the model's world height in metres (size checks); at: where the body is DRAWN (after the stand-off); mouth: its head bone in the world
    }),
  };
}
