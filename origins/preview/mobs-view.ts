import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import goblinUrl from '../../src/assets/goblin.glb?url';
import knightUrl from '../../src/assets/knight.glb?url';
import pitbornUrl from '../../src/assets/pitborn.glb?url';
import witchUrl from '../../src/assets/witch.glb?url';
import wolfUrl from '../../src/assets/wolf.glb?url';
import { budgetTextures, FIGHTER_TEXTURE_CAP } from '../../src/quality.ts';
import type { Build, Frontier } from './frontier-plan.ts';
import { dressMob } from './mob-dress.ts';
import { mobVariant } from './mob-looks.ts';
import { TUNING, mobSpecs, previewRows, mobStand, newMob, pickVisible, stepMob, type Mob, type MobSpec } from './mobs.ts';

// ?region=1: the Frontier's creatures drawn (bite 1: visible and wandering, nothing fights). This module is its own chunk and main.ts imports
// it only when the hero first reaches the west road, so the Pit/Exchange page never pays for it. The bodies are the roster's own GLBs (the
// Pit fights with the same files), one download per body kind, fetched only when a creature of that kind first comes within reach; every
// creature of a kind is a SkeletonUtils clone of that one scene with its own tinted materials. Until its body lands a capsule stands in.
const URLS: Record<string, string> = { goblin: goblinUrl, knight: knightUrl, pitborn: pitbornUrl, witch: witchUrl, wolf: wolfUrl };
// The open world draws Characters' 8k-tri world bodies (same rig and clip names) where they exist; the duel keeps the roster GLB.
const WORLD_URLS: Record<string, string> = { goblin: '/world/goblin.glb', wolf: '/world/wolf.glb' };   // public/world (#1716): served by URL, never bundled, so check-budget does not count them as fighters
const FETCH_RANGE = TUNING.range + 15;   // m: a body kind is fetched when one of its creatures is this near
const FETCH_RANGE_PHONE = 28;            // m: on a phone only when one is close (~4 MB a body kind; the goblin serves every common creature)
// How each creature is dressed (scale, cloth tint, soot) is Characters' (mob-looks.ts + mob-dress.ts); this view only asks.
const NEAR = 25;   // m: inside it a creature's mixer ticks every frame
const TWEEN = 6;   // 1/s: how quickly a walk/idle blend and a turn settle

type Body = { scene: THREE.Group; clips: THREE.AnimationClip[] } | 'loading' | 'failed';
type View = { group: THREE.Group; stand: THREE.Mesh; model: THREE.Object3D | null; mixer?: THREE.AnimationMixer; idle?: THREE.AnimationAction; walk?: THREE.AnimationAction; ring: THREE.Mesh; bang: THREE.Sprite; label: THREE.Sprite; walkW: number; pending: number; skip: number };

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

export type MobPick = { spec: MobSpec; x: number; z: number; dist: number };
export type Mobs = {
  update(dt: number, hero: { x: number; z: number }, hideLabel?: string | null): void; debug(): unknown;
  pick(ray: THREE.Ray): MobPick | null;   // the nearest drawn creature the ray passes through (a generous sphere: a thumb is not a pixel)
  find(id: string): MobPick | null;       // a creature by id, where it stands now (null while it is down)
  nearest(x: number, z: number, within: number): MobPick | null;   // the closest drawn creature inside `within` metres of a point (the lock-on and the attack buttons)
  freeze(hero: { x: number; z: number }, radius: number, hideId: string | null): void;   // a world duel is up: the creatures stand where they are; those past `radius` metres, and `hideId` (the duel's foe is drawn by the duel), are hidden
  fell(id: string): void;                 // a creature that lost the fight: gone for RESPAWN seconds, then back at its round
};
const RESPAWN = 90;   // s
const HIT = { common: 1.5, named: 1.9 };   // m: the tap sphere's radius round a creature's chest

export function createMobs(scene: THREE.Scene, frontier: Frontier, build: Build, opts: { phone: boolean }): Mobs {
  const specs = mobSpecs(frontier, build, previewRows(location.search)), zones = new Map(frontier.zones.map((z) => [z.zone, z])), stands = specs.map((s) => mobStand(build, zones.get(s.zone)!));
  const mobs: Mob[] = specs.map((s, i) => newMob(s, i)), views = new Map<number, View>(), bodies = new Map<string, Body>(), alerted = new Set<number>();
  const cap = opts.phone ? 4 : TUNING.cap, fetchRange = opts.phone ? FETCH_RANGE_PHONE : FETCH_RANGE;   // a phone draws fewer skinned bodies at once
  const root = new THREE.Group(); root.name = 'frontier-mobs'; scene.add(root);
  const blobGeometry = new THREE.CircleGeometry(0.6, 20).rotateX(-Math.PI / 2), blobMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.38, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });   // one shared soft-looking shadow under every creature
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
    }).catch((error: unknown) => { bodies.set(kind, 'failed'); console.warn(`${kind} body did not load; capsules stand in`, error); });
  };

  const modelHeight = (m?: THREE.Object3D) => { if (!m) return null; const b = new THREE.Box3().setFromObject(m); return +(b.max.y - b.min.y).toFixed(2); };
  function dress(v: View, s: MobSpec, body: Exclude<Body, 'loading' | 'failed'>) {
    const model = clone(body.scene), look = mobVariant(s.character, s.id);
    model.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.castShadow = false; });   // phone perf (Dom's iPhone 15, Lead 2026-10-07): a creature casts no shadow map pass (a blob decal stands in) and is frustum culled again
    if (look) dressMob(model, look);   // scale + the cloth's tint and ash; a figure with no look keeps the roster body as it is
    v.mixer = new THREE.AnimationMixer(model);
    const act = (name: string) => { const c = THREE.AnimationClip.findByName(body.clips, name); return c ? v.mixer!.clipAction(c) : undefined; };
    v.idle = act('Idle'); v.walk = act('Walk'); v.idle?.play(); v.walk?.play(); v.walk?.setEffectiveWeight(0);
    v.mixer.setTime(Math.random() * 3);   // not in step with its neighbours
    v.group.add(model); v.group.remove(v.stand); v.model = model;
  }

  function viewOf(i: number): View {
    let v = views.get(i); if (v) return v;
    const s = specs[i]!, group = new THREE.Group(), look = mobVariant(s.character, s.id), height = Math.max(1.9, (s.named ? 2.75 : 2.35) * (look?.scale ?? 1));
    const stand = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 1.1, 4, 10), new THREE.MeshStandardMaterial({ color: look ? look.tint : 0x5a4a3a, roughness: 0.9 }));
    stand.position.y = 0.85;
    const label = labelSprite(`${s.name} · Lv ${s.level}`, s.named); label.position.y = height;
    const bang = bangSprite(); bang.position.y = label.position.y + 0.55; bang.visible = false;
    const ring = new THREE.Mesh(new THREE.RingGeometry(s.aggro - 0.12, s.aggro, 48), new THREE.MeshBasicMaterial({ color: '#d8c9a8', transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04;
    const blob = new THREE.Mesh(blobGeometry, blobMaterial); blob.position.y = 0.03; blob.scale.setScalar(look?.scale ?? 1);
    group.add(stand, label, bang, blob);
    v = { group, stand, model: null, ring, bang, label, walkW: 0, pending: 0, skip: i }; views.set(i, v);
    root.add(group, ring);
    return v;
  }

  return {
    update(dt, hero, hideLabel) {
      mobs.forEach((m, i) => { mobs[i] = stepMob(m, specs[i]!, hero, dt, stands[i]!); });
      for (const [i, t] of down) { if (t - dt <= 0) down.delete(i); else down.set(i, t - dt); }
      shown = pickVisible(mobs, hero, cap).filter((i) => !down.has(i));
      // Fetch a body kind the first time one of its creatures is near.
      mobs.forEach((m, i) => { if (Math.hypot(m.x - hero.x, m.z - hero.z) <= fetchRange) fetchBody(specs[i]!.body); });
      const on = new Set(shown);
      for (const [i, v] of views) if (!on.has(i)) { v.group.visible = false; v.ring.visible = false; }
      // One label per kind of creature: the nearest of that name. A field of scavengers read "Cinder scavenger · Cinder scavenger · Lv 11" side by side.
      const nearestOf = new Map<string, number>();
      for (const i of shown) { const n = specs[i]!.name, d = Math.hypot(mobs[i]!.x - hero.x, mobs[i]!.z - hero.z); if (d < (nearestOf.get(n + '#d') ?? Infinity)) { nearestOf.set(n + '#d', d); nearestOf.set(n, i); } }
      for (const i of shown) {
        const m = mobs[i]!, s = specs[i]!, v = viewOf(i), body = bodies.get(s.body);
        if (!v.model && body && body !== 'loading' && body !== 'failed') dress(v, s, body);
        v.group.visible = v.ring.visible = true;
        v.group.position.set(m.x, 0, m.z); v.group.rotation.y = m.facing;
        v.ring.position.set(m.x, 0.04, m.z);
        const aggro = m.mode === 'aggro', mat = v.ring.material as THREE.MeshBasicMaterial;
        if (aggro && !alerted.has(i)) { alerted.add(i); dispatchEvent(new CustomEvent('origins:creature', { detail: { body: s.body, cue: 'growl' } })); } else if (!aggro) alerted.delete(i);   // the "!" fires: ?look=creatures growls (creature-voice.ts)
        v.label.visible = s.id !== hideLabel && nearestOf.get(s.name) === i;   // the info card (creature-card.ts) carries this creature's name and level while it is up
        v.bang.visible = aggro; mat.opacity = aggro ? 0.34 : 0.1; mat.color.set(aggro ? '#e0553a' : '#d8c9a8');
        if (!v.model) v.stand.position.y = 0.85 + (m.mode === 'wander' ? Math.abs(Math.sin(performance.now() / 220 + i)) * 0.04 : 0);
        if (v.mixer && v.idle && v.walk) {
          v.walkW = THREE.MathUtils.damp(v.walkW, m.mode === 'wander' ? 1 : 0, TWEEN, dt);
          v.walk.setEffectiveWeight(v.walkW); v.idle.setEffectiveWeight(1 - v.walkW);
          if (Math.hypot(m.x - hero.x, m.z - hero.z) <= NEAR) { v.pending = 0; v.mixer.update(dt); }   // beyond NEAR a body animates a quarter as often (same speed, coarser steps)
          else { v.pending += dt; if (++v.skip % 4 === 0) { v.mixer.update(v.pending); v.pending = 0; } }
        }
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
    find(id) { const i = specs.findIndex((s) => s.id === id); return i < 0 || down.has(i) ? null : { spec: specs[i]!, x: mobs[i]!.x, z: mobs[i]!.z, dist: 0 }; },
    freeze(hero, radius, hideId) {
      for (const [i, v] of views) {
        const m = mobs[i]!, hide = specs[i]!.id === hideId || Math.hypot(m.x - hero.x, m.z - hero.z) > radius;
        if (hide) { v.group.visible = false; v.ring.visible = false; }
      }
    },
    fell(id) { const i = specs.findIndex((s) => s.id === id); if (i >= 0) down.set(i, RESPAWN); },
    debug: () => ({
      total: specs.length, drawn: shown.length, cap, down: [...down.keys()].map((i) => specs[i]!.id), bodies: Object.fromEntries([...bodies].map(([k, b]) => [k, typeof b === 'string' ? b : 'ready'])),
      mobs: specs.map((s, i) => ({ id: s.id, name: s.name, zone: s.zone, body: s.body, level: s.level, x: +mobs[i]!.x.toFixed(2), z: +mobs[i]!.z.toFixed(2), mode: mobs[i]!.mode, drawn: shown.includes(i), model: !!views.get(i)?.model, height: modelHeight(views.get(i)?.model) })),   // height: the model's world height in metres (size checks)
    }),
  };
}
