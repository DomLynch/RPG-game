// The town's people as characters (beta blocker #8, Dom: "start putting some NPCs there ... one of the humanoids"). A plan people row that names a `body` (a catalogue row id) stands as that
// character's world body (public/world/<id>.glb: the same rig and clip names the Pit's fighters use), turned to the row's `face`, in the row's `pose` clip; the greybox capsule stays for a row
// with no body, until the file lands, and past the row's `near` range. A body file is fetched only when one of its people first comes within `near` metres, so a walker who never gets
// there never downloads it. Rows only: no person, body, role, range or position is named here. `role` is the stall the person will run later (shop data is empty for now).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { catalogueRow } from '../../src/fight/index.ts';   // the engine's door (K7/K12): no deep import of catalogue-rows.ts
import type { Figure } from './exchange-plan.ts';
import { previewRule } from './preview-rules.ts';

export type Stander = { readonly id: string; readonly url: string; readonly x: number; readonly y: number; readonly z: number; readonly face: number; readonly pose: string; readonly near: number; readonly role?: string; readonly far?: string; readonly full?: number };   // far/full: the cheap body's file and the metres inside which the full body draws (the row's own band; absent = the full body to `near`)

/** The site-root URL of catalogue row `id`'s world body, or undefined for an id with no row or no world body (that person keeps the capsule). */
export const bodyUrlOf = (id: string): string | undefined => { const row = catalogueRow(id); return row?.world ? `/${row.world.asset.replace(/^public\//, '')}` : undefined; };

/** The people who stand as a body: a row with an `npc` whose body has a file. Pure. */
export function standers(people: readonly Figure[], urlOf: (body: string) => string | undefined = bodyUrlOf): Stander[] {
  const out: Stander[] = [];
  for (const f of people) { const n = f.npc; const url = n && urlOf(n.body); if (n && url) out.push({ id: n.id, url, x: f.x, y: f.y ?? 0, z: f.z, face: n.face, pose: n.pose, near: n.near, ...(n.role ? { role: n.role } : {}), ...(n.far ? { far: n.far, full: n.full! } : {}) }); }
  return out;
}

/** Whether a stander is inside its own `near` range of a point. Pure. */
export const within = (s: Pick<Stander, 'x' | 'z' | 'near'>, x: number, z: number): boolean => Math.hypot(s.x - x, s.z - z) <= s.near;

/** Which body a stander draws at a point: the full one inside its row's `full` range, the far one out to `near` (when the row has one), none beyond. Pure. */
export type Reach = { readonly inFull: boolean; readonly inNear: boolean };   // inFull: inside the full body's range; inNear: inside the row's outer range (the far body draws where inNear and not inFull)
export const reachOf = (s: Pick<Stander, 'x' | 'z' | 'near' | 'far' | 'full'>, x: number, z: number): Reach => { const d = Math.hypot(s.x - x, s.z - z); return { inFull: d <= (s.far !== undefined && s.full !== undefined ? s.full : s.near), inNear: d <= s.near }; };

export type TownPeople = { readonly group: THREE.Group; update(dt: number, x: number, z: number): void };

/** The people's bodies, in a group of their own. `shown(id, visible)` is called when a person's body appears or goes (the greybox capsule takes the opposite state). */
export function townPeople(list: readonly Stander[], shown: (id: string, bodyVisible: boolean) => void, warm?: (body: THREE.Object3D) => Promise<void>): TownPeople {
  const group = new THREE.Group(); group.name = 'town-people';
  const files = new Map<string, Promise<{ scene: THREE.Object3D; clips: THREE.AnimationClip[] } | null>>();
  // `warm` (the page's compile for the drawn target) runs once per file before any of its people is revealed, so the first draw of a body never lands inside a walking frame; it is bounded (a warm-up that never settles
  // must not leave the people capsules for good), and a warm-up that throws reveals the body anyway.
  const bounded = (p: Promise<void>): Promise<void> => Promise.race([p.catch(() => {}), new Promise<void>((r) => setTimeout(r, previewRule('warmBound')))]);
  const fetchFile = (url: string) => { let p = files.get(url); if (!p) files.set(url, (p = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(url).then(async (g) => { if (warm) await bounded(warm(g.scene)); return { scene: g.scene, clips: g.animations }; }).catch(() => null))); return p; };   // a failed file keeps those people as capsules
  type Built = { root: THREE.Object3D; mixer: THREE.AnimationMixer | null };
  type Slot = undefined | 'loading' | 'failed' | Built;
  const state = new Map<string, { full: Slot; far: Slot; on: boolean }>();   // per person: the full body, the far body (rows with a `far` file), whether a body is showing
  const build = (s: Stander, file: { scene: THREE.Object3D; clips: THREE.AnimationClip[] }, index: number): Built => {
    const root = clone(file.scene); root.position.set(s.x, s.y, s.z); root.rotation.y = s.face; root.visible = false;
    root.traverse((o) => { (o as THREE.Mesh).frustumCulled = false; });   // the mixer moves the bones; a bind-pose bound would cull a pose
    group.add(root);
    const clip = file.clips.find((c) => c.name === s.pose); let mixer: THREE.AnimationMixer | null = null;
    if (clip) { mixer = new THREE.AnimationMixer(root); const a = mixer.clipAction(clip); a.time = (index / list.length) * clip.duration; a.play(); }   // each person starts the pose at their own moment (evenly spread over the clip)
    return { root, mixer };
  };
  return {
    group,
    update(dt, x, z) {
      list.forEach((s, i) => {
        const { inFull, inNear } = reachOf(s, x, z);
        if (!inNear && !state.has(s.id)) return;
        let cur = state.get(s.id); if (!cur) state.set(s.id, (cur = { full: undefined, far: undefined, on: false }));
        const slots = cur;
        const want = (kind: 'full' | 'far', url: string) => { if (slots[kind] !== undefined) return; slots[kind] = 'loading'; void fetchFile(url).then((f) => { slots[kind] = f ? build(s, f, i) : 'failed'; }); };
        if (inFull) want('full', s.url);
        if (inNear && s.far !== undefined) want('far', s.far);   // the cheap body is also what stands in while the full one loads
        const built = (k: Slot): k is Built => k !== undefined && k !== 'loading' && k !== 'failed';
        const showFull = inFull && built(cur.full), showFar = inNear && built(cur.far) && !showFull;
        if (built(cur.full)) cur.full.root.visible = showFull;
        if (built(cur.far)) cur.far.root.visible = showFar;
        if (cur.on !== (showFull || showFar)) { cur.on = showFull || showFar; shown(s.id, cur.on); }
        if (showFull && built(cur.full)) cur.full.mixer?.update(dt); else if (showFar && built(cur.far)) cur.far.mixer?.update(dt);
      });
    },
  };
}
