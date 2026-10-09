import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { beastBodyUrl } from '../../src/beast-scale.ts';
import { actorPose, buildWarriors, type Practice } from '../../src/fight/index.ts';
import { OPPONENTS, type WeaponId } from '../../src/moves.ts';
import type { Duel } from '../../src/duel.ts';
import goblinUrl from '../../src/assets/goblin.glb?url';
import knightUrl from '../../src/assets/knight.glb?url';
import pitbornUrl from '../../src/assets/pitborn.glb?url';
import witchUrl from '../../src/assets/witch.glb?url';
import { budgetTextures, FIGHTER_TEXTURE_CAP } from '../../src/quality.ts';
import type { Build, Frontier } from './frontier-plan.ts';
import { dressMob } from './mob-dress.ts';
import { mobVariant } from './mob-looks.ts';
import { gateWithBound, settleWithin } from '../../src/warm-gate.ts';
import { TUNING, hiddenInFight, mobSpecs, previewRows, mobStand, newMob, pickVisible, stepMob, type Mob, type MobSpec, labelCeilingNdc } from './mobs.ts';

// ?region=1: the Frontier's creatures drawn (bite 1: visible and wandering, nothing fights). This module is its own chunk and main.ts imports
// it only when the hero first reaches the west road, so the Pit/Exchange page never pays for it. The bodies are the roster's own GLBs (the
// Pit fights with the same files), one download per body kind, fetched only when a creature of that kind first comes within reach; every
// creature of a kind is a SkeletonUtils clone of that one scene with its own tinted materials. Until its body lands a capsule stands in.
const URLS: Record<string, string> = { goblin: goblinUrl, knight: knightUrl, pitborn: pitbornUrl, witch: witchUrl };   // the wolf is served from WORLD_URLS (public/world), not bundled
// The open world draws Characters' 8k-tri world bodies (same rig and clip names) where they exist; the duel keeps the roster GLB.
const WORLD_URLS: Record<string, string> = { goblin: '/world/goblin.glb', wolf: '/world/wolf.glb', bear: '/world/bear.glb', boar: beastBodyUrl('boar') };   // public/world (#1716): served by URL, never bundled, so check-budget does not count them as fighters
const FETCH_RANGE = TUNING.range + 15;   // m: a body kind is fetched when one of its creatures is this near
const FETCH_RANGE_PHONE = 28;            // m: on a phone only when one is close (~4 MB a body kind; the goblin serves every common creature)
// How each creature is dressed (scale, cloth tint, soot) is Characters' (mob-looks.ts + mob-dress.ts); this view only asks.
const NEAR = 25;   // m: inside it a creature's mixer ticks every frame

type Body = { scene: THREE.Group; clips: THREE.AnimationClip[] } | 'loading' | 'failed';
type Actor = ReturnType<typeof buildWarriors>['player'];
type View = { group: THREE.Group; stand: THREE.Mesh; model: THREE.Object3D | null; actor?: Actor; ring: THREE.Mesh; bang: THREE.Sprite; label: THREE.Sprite; speed: number; px: number; pz: number; pending: number; skip: number };

function labelSprite(text: string, named: boolean): THREE.Sprite {
  const c = document.createElement('canvas'); c.width = 512; c.height = 96;
  const g = c.getContext('2d')!;
  g.font = '600 40px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  let size = 40; while (size > 20 && g.measureText(text).width > c.width - 24) { size -= 2; g.font = `600 ${size}px Georgia, serif`; }
  g.lineWidth = 7; g.strokeStyle = 'rgba(10,8,6,0.85)'; g.strokeText(text, c.width / 2, c.height / 2);
  g.fillStyle = named ? '#f2c66d' : '#ece0c8'; g.fillText(text, c.width / 2, c.height / 2);
  const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, fog: false, sizeAttenuation: false }));
  s.scale.set(0.2, 0.0375, 1); return s;   // sizeAttenuation off: the same size on screen at any distance (a creature next to the camera no longer fills it)
}
function bangSprite(): THREE.Sprite {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d')!;
  g.font = '800 56px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 8; g.strokeStyle = 'rgba(10,8,6,0.9)'; g.strokeText('!', 32, 34); g.fillStyle = '#ff5a3c'; g.fillText('!', 32, 34);
  const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, fog: false, sizeAttenuation: false }));
  s.scale.set(0.045, 0.045, 1); return s;
}

export type MobDrive = { x: number; z: number; facing: number; moving: boolean; duel?: Duel; fall?: number };   // World's combat loop (world-combat.ts) drives a creature while it fights: its position, the duel it is in (the engine's actor poses it: bite, hurt) and, once down, the death clip's progress (0..1)
export type MobPick = { spec: MobSpec; x: number; z: number; dist: number };
export type Mobs = {
  update(dt: number, hero: { x: number; z: number }, hideLabel?: string | null): void; debug(): unknown;
  clampLabels(camera: THREE.Camera, floorPx: number, heightPx: number): void;   // before the draw: a name tag under the HUD slides down the view to just below it
  pick(ray: THREE.Ray): MobPick | null;   // the nearest drawn creature the ray passes through (a generous sphere: a thumb is not a pixel)
  find(id: string): MobPick | null;       // a creature by id, where it stands now (null while it is down)
  nearest(x: number, z: number, within: number): MobPick | null;
  within(x: number, z: number, r: number): MobPick[];   // every drawn creature inside r metres
  drive(id: string, pose: MobDrive | null): void;   // null gives the creature back to its own wander   // the closest drawn creature inside `within` metres of a point (the lock-on and the attack buttons)
  engage(id: string | null): void;        // a world duel is up: this creature is the duel's foe, drawn by the duel, so it is not drawn here (null: back). Every other creature keeps wandering and animating
  fell(id: string): void;                 // a creature that lost the fight: gone for RESPAWN seconds, then back at its round
  warmState(): { kinds: string[]; warmed: string[]; failed: string[] };   // the zone's body kinds, and which of them have their programs linked and textures and geometry uploaded (a kind is revealed only then); empty `kinds` with no renderer
};
const RESPAWN = 90;   // s
const WARM_BOUND_MS = 4000;   // a body kind is revealed after this long even if its warm-up has not finished (a bound Claudecraft's gates lack; it is logged)
const HIT = { common: 1.5, named: 1.9 };   // m: the tap sphere's radius round a creature's chest

export function createMobs(scene: THREE.Scene, frontier: Frontier, build: Build, opts: { phone: boolean; groundAt?: (x: number, z: number) => number; renderer?: THREE.WebGLRenderer; after?: Promise<unknown>; camera?: THREE.Camera }): Mobs {
  const specs = mobSpecs(frontier, build, previewRows(location.search)), zones = new Map(frontier.zones.map((z) => [z.zone, z])), stands = specs.map((s) => mobStand(build, zones.get(s.zone)!));
  const mobs: Mob[] = specs.map((s, i) => newMob(s, i)), views = new Map<number, View>(), bodies = new Map<string, Body>(), alerted = new Set<number>();
  const cap = opts.phone ? 4 : TUNING.cap, fetchRange = opts.phone ? FETCH_RANGE_PHONE : FETCH_RANGE;   // a phone draws fewer skinned bodies at once
  const root = new THREE.Group(); root.name = 'frontier-mobs'; scene.add(root);
  // One soft contact shadow under every creature (they cast no real shadow, for phone perf): a radial gradient that is darkest at the feet and gone before the rim, so no disc edge is ever visible (Dom 2026-10-08: "a circle stand that looks fake").
  const blobTexture = (() => { const N = 64, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d')!, gr = g.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2); gr.addColorStop(0, 'rgba(0,0,0,0.5)'); gr.addColorStop(0.45, 'rgba(0,0,0,0.22)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, N, N); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const blobGeometry = new THREE.PlaneGeometry(1.5, 1.5).rotateX(-Math.PI / 2), blobMaterial = new THREE.MeshBasicMaterial({ map: blobTexture, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  let shown: number[] = [];
  const down = new Map<number, number>();   // creature index -> seconds until it is back

  const fetchBody = (kind: string) => {
    const url = WORLD_URLS[kind] ?? URLS[kind];
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
  const gate = !!opts.renderer && !!opts.camera, warmed = new Set<string>(), failedKinds = new Set<string>(), kindsOfZone = [...new Set(specs.map((x) => x.body))];
  const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
  let eagerDone = false, pumping = false, lastHero = { x: 0, z: 0 };
  const pending = new Map<string, { scene: THREE.Object3D }>();   // kinds fetched and waiting for their warm-up: nearest to the walker first (Claudecraft orders its gates by camera distance)
  async function warmKind(kind: string, body: { scene: THREE.Object3D }) {
    const renderer = opts.renderer!, camera = opts.camera!, first = specs.find((x) => x.body === kind)!, look = mobVariant(first.character, first.id);
    const probe = clone(body.scene); if (look) dressMob(probe, look);
    const holder = new THREE.Group(); holder.add(probe);   // not in the scene: the scene is only the lights and fog the programs are keyed on
    await renderer.compileAsync(holder, camera, scene);
    const textures = new Set<THREE.Texture>(), geometries = new Set<THREE.BufferGeometry>();
    probe.traverse((o) => { const m = o as THREE.Mesh; if (!m.isMesh) return; geometries.add(m.geometry); for (const mat of Array.isArray(m.material) ? m.material : [m.material]) for (const v of Object.values(mat)) if (v && (v as THREE.Texture).isTexture) textures.add(v as THREE.Texture); });
    for (const t of textures) { renderer.initTexture(t); await frame(); }
    const proxy = new THREE.MeshBasicMaterial(), tmp = new THREE.Scene(), target = new THREE.WebGLRenderTarget(4, 4);
    try { for (const g of geometries) { const mesh = new THREE.Mesh(g, proxy), prev = renderer.getRenderTarget(); mesh.frustumCulled = false; tmp.add(mesh); renderer.setRenderTarget(target); try { renderer.render(tmp, camera); } finally { renderer.setRenderTarget(prev); tmp.remove(mesh); } await frame(); } }
    finally { target.dispose(); proxy.dispose(); }
  }
  const kindDist = (kind: string) => mobs.reduce((d, m, i) => (specs[i]!.body === kind ? Math.min(d, Math.hypot(m.x - lastHero.x, m.z - lastHero.z) - (m.mode === 'aggro' ? 1000 : 0)) : d), Infinity);   // a kind with a creature that has noticed him first (the one coming for him), then by distance
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
    const weapon = (OPPONENTS as Record<string, { weapon: WeaponId } | undefined>)[s.body]?.weapon ?? 'longsword', look = mobVariant(s.character, s.id);
    let actor: Actor;
    try { actor = buildWarriors({ scene: body.scene, animations: body.clips }, undefined, [weapon, weapon], true).player; }
    catch (error) { console.warn(`${s.body} actor did not build; the capsule stays`, error); bodies.set(s.body, 'failed'); failedKinds.add(s.body); return; }
    actor.anchor.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.castShadow = false; });   // phone perf (Dom's iPhone 15, Lead 2026-10-07): a creature casts no shadow map pass (a blob decal stands in) and is frustum culled again
    if (look) dressMob(actor.anchor, look);   // scale + the cloth's tint and ash; a figure with no look keeps the roster body as it is
    actor.update(0, Math.random() * 3, 'ready', 0, 'light', 0.35, 0);   // not in step with its neighbours
    v.group.add(actor.anchor); v.group.remove(v.stand); v.model = actor.anchor; v.actor = actor;
  }

  function viewOf(i: number): View {
    let v = views.get(i); if (v) return v;
    const s = specs[i]!, group = new THREE.Group(), look = mobVariant(s.character, s.id), height = Math.max(1.9, (s.named ? 2.75 : 2.35) * (look?.scale ?? 1));
    const stand = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 1.1, 4, 10), new THREE.MeshStandardMaterial({ color: look ? look.tint : 0x5a4a3a, roughness: 0.9 }));
    stand.position.y = 0.85;
    const label = labelSprite(`${s.name} · Lv ${s.level}`, s.named); label.position.y = height; label.userData.y0 = height;
    const bang = bangSprite(); bang.position.y = label.position.y + 0.55; bang.visible = false;
    const ring = new THREE.Mesh(new THREE.RingGeometry(s.aggro - 0.12, s.aggro, 48), new THREE.MeshBasicMaterial({ color: '#d8c9a8', transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04;
    const blob = new THREE.Mesh(blobGeometry, blobMaterial); blob.position.y = 0.03; blob.scale.setScalar(look?.scale ?? 1);
    group.add(stand, label, bang, blob);
    v = { group, stand, model: null, ring, bang, label, speed: 0, px: NaN, pz: NaN, pending: 0, skip: i }; views.set(i, v);
    root.add(group, ring);
    return v;
  }

  let engaged: string | null = null;
  const driven = new Map<number, MobDrive>();
  return {
    update(dt, hero, hideLabel) {
      lastHero = hero;
      mobs.forEach((m, i) => { const d = driven.get(i); mobs[i] = d ? { ...m, x: d.x, z: d.z, facing: d.facing, mode: d.moving ? 'wander' : 'aggro' } : stepMob(m, specs[i]!, hero, dt, stands[i]!); });
      for (const [i, t] of down) { if (t - dt <= 0) { down.delete(i); } else down.set(i, t - dt); }
      shown = pickVisible(mobs, hero, cap).filter((i) => !down.has(i));
      if (gate && !opts.phone && !eagerDone) { eagerDone = true; for (const k of kindsOfZone) fetchBody(k); }   // the whole zone's kinds at entry (not on a phone), so they are warmed before anyone walks near
      // Fetch a body kind the first time one of its creatures is near.
      mobs.forEach((m, i) => { if (Math.hypot(m.x - hero.x, m.z - hero.z) <= fetchRange) fetchBody(specs[i]!.body); });
      const on = new Set(shown);
      for (const [i, v] of views) if (!on.has(i)) { v.group.visible = false; v.ring.visible = false; }
      // One label per kind of creature: the nearest of that name. A field of scavengers read "Cinder scavenger · Cinder scavenger · Lv 11" side by side.
      const nearestOf = new Map<string, number>();
      for (const i of shown) { const n = specs[i]!.name, d = Math.hypot(mobs[i]!.x - hero.x, mobs[i]!.z - hero.z); if (d < (nearestOf.get(n + '#d') ?? Infinity)) { nearestOf.set(n + '#d', d); nearestOf.set(n, i); } }
      for (const i of shown) {
        const m = mobs[i]!, s = specs[i]!, v = viewOf(i), body = bodies.get(s.body);
        if (!v.model && body && body !== 'loading' && body !== 'failed' && revealed(s.body)) dress(v, s, body);
        v.group.visible = v.ring.visible = !hiddenInFight(s.id, engaged);
        const gy = opts.groundAt?.(m.x, m.z) ?? 0;   // the hills: a creature stands on the ground under it
        const dv = driven.get(i);
        v.group.position.set(m.x, gy, m.z); v.group.rotation.y = m.facing;
        v.ring.position.set(m.x, gy + 0.04, m.z);
        const aggro = m.mode === 'aggro', mat = v.ring.material as THREE.MeshBasicMaterial;
        if (aggro && !alerted.has(i)) { alerted.add(i); dispatchEvent(new CustomEvent('origins:creature', { detail: { body: s.body, cue: 'growl' } })); } else if (!aggro) alerted.delete(i);   // the "!" fires: ?look=creatures growls (creature-voice.ts)
        v.label.visible = s.id !== hideLabel && nearestOf.get(s.name) === i;   // the info card (creature-card.ts) carries this creature's name and level while it is up
        v.bang.visible = aggro; mat.opacity = aggro ? 0.34 : 0.1; mat.color.set(aggro ? '#e0553a' : '#d8c9a8');
        if (!v.model) v.stand.position.y = 0.85 + (m.mode === 'wander' ? Math.abs(Math.sin(performance.now() / 220 + i)) * 0.04 : 0);
        if (v.actor) {
          // The gait follows the speed it actually covers (the engine's gait table); the pose comes from the engine's actorPose of the duel it is in, the death clip once it is down.
          const away = Math.hypot(m.x - v.px, m.z - v.pz) / Math.max(dt, 1e-3); v.px = m.x; v.pz = m.z;
          v.speed += ((Number.isFinite(away) ? Math.min(away, 8) : 0) - v.speed) * (1 - Math.exp(-dt * 14)); if (v.speed < 0.015) v.speed = 0;
          const posed = dv?.fall ? { pose: 'death' as const, progress: dv.fall, attack: 'light' as const, contact: 0.35 } : dv?.duel ? actorPose({ duel: dv.duel } as unknown as Practice, 1) : { pose: 'ready' as const, progress: 0, attack: 'light' as const, contact: 0.35 };
          const tick = (step: number) => v.actor!.update(v.speed, step, posed.pose, posed.progress, posed.attack, posed.contact, 0);
          if (Math.hypot(m.x - hero.x, m.z - hero.z) <= NEAR) { v.pending = 0; tick(dt); }   // beyond NEAR a body animates a quarter as often (same speed, coarser steps)
          else { v.pending += dt; if (++v.skip % 4 === 0) { tick(v.pending); v.pending = 0; } }
        }
      }
    },
    clampLabels(camera, floorPx, heightPx) {
      const ceiling = labelCeilingNdc(floorPx, heightPx), at = new THREE.Vector3();
      for (const v of views.values()) {
        const y0 = v.label.userData.y0 as number; v.label.position.set(0, y0, 0);   // back home every frame, then clamped from there
        if (!v.label.visible || !v.group.visible) continue;
        v.group.updateMatrixWorld(true); v.label.getWorldPosition(at).project(camera);
        if (at.z > 1 || at.z < -1 || at.y <= ceiling) continue;   // behind the camera, or already clear of the HUD
        at.y = ceiling; at.unproject(camera); v.group.worldToLocal(at); v.label.position.copy(at);
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
    within(x, z, r) { const out: MobPick[] = []; for (const i of shown) { const d = Math.hypot(mobs[i]!.x - x, mobs[i]!.z - z); if (d <= r) out.push({ spec: specs[i]!, x: mobs[i]!.x, z: mobs[i]!.z, dist: d }); } return out; },
    drive(id, pose) { const i = specs.findIndex((sp) => sp.id === id); if (i < 0) return; if (pose) driven.set(i, pose); else driven.delete(i); },
    find(id) { const i = specs.findIndex((s) => s.id === id); return i < 0 || down.has(i) ? null : { spec: specs[i]!, x: mobs[i]!.x, z: mobs[i]!.z, dist: 0 }; },
    engage(id) { engaged = id; },
    warmState: () => ({ kinds: gate ? kindsOfZone.filter((k) => (WORLD_URLS[k] ?? URLS[k]) && (!opts.phone || bodies.has(k))) : [], warmed: [...new Set([...warmed, ...failedKinds])], failed: [...failedKinds] }),   // the kinds that can be fetched (a phone: only those fetched so far), and those settled: a failed GLB stays a capsule and counts as settled, so zone ready does not wait for it forever
    fell(id) { const i = specs.findIndex((s) => s.id === id); if (i >= 0) down.set(i, RESPAWN); },
    debug: () => ({
      total: specs.length, drawn: shown.length, cap, down: [...down.keys()].map((i) => specs[i]!.id), bodies: Object.fromEntries([...bodies].map(([k, b]) => [k, typeof b === 'string' ? b : 'ready'])),
      mobs: specs.map((s, i) => ({ id: s.id, name: s.name, zone: s.zone, body: s.body, level: s.level, x: +mobs[i]!.x.toFixed(2), z: +mobs[i]!.z.toFixed(2), mode: mobs[i]!.mode, drawn: shown.includes(i), model: !!views.get(i)?.model, height: modelHeight(views.get(i)?.model) })),   // height: the model's world height in metres (size checks)
    }),
  };
}
