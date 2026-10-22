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

export type Stander = { readonly id: string; readonly url: string; readonly x: number; readonly y: number; readonly z: number; readonly face: number; readonly pose: string; readonly near: number; readonly role?: string };

/** The site-root URL of catalogue row `id`'s world body, or undefined for an id with no row or no world body (that person keeps the capsule). */
export const bodyUrlOf = (id: string): string | undefined => { const row = catalogueRow(id); return row?.world ? `/${row.world.asset.replace(/^public\//, '')}` : undefined; };

/** The people who stand as a body: a row with an `npc` whose body has a file. Pure. */
export function standers(people: readonly Figure[], urlOf: (body: string) => string | undefined = bodyUrlOf): Stander[] {
  const out: Stander[] = [];
  for (const f of people) { const n = f.npc; const url = n && urlOf(n.body); if (n && url) out.push({ id: n.id, url, x: f.x, y: f.y ?? 0, z: f.z, face: n.face, pose: n.pose, near: n.near, ...(n.role ? { role: n.role } : {}) }); }
  return out;
}

/** Whether a stander is inside its own `near` range of a point. Pure. */
export const within = (s: Pick<Stander, 'x' | 'z' | 'near'>, x: number, z: number): boolean => Math.hypot(s.x - x, s.z - z) <= s.near;

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
  const state = new Map<string, 'loading' | 'failed' | Built>();
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
        const near = within(s, x, z), cur = state.get(s.id);
        if (near && cur === undefined) { state.set(s.id, 'loading'); void fetchFile(s.url).then((f) => { state.set(s.id, f ? build(s, f, i) : 'failed'); }); return; }
        if (!cur || cur === 'loading' || cur === 'failed') return;
        if (cur.root.visible !== near) { cur.root.visible = near; shown(s.id, near); }
        if (near) cur.mixer?.update(dt);
      });
    },
  };
}
