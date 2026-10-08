// The Zone 1 OUTLAW CAMP (Dom's PvP design, 2026-10-08): a small caravan camp away from town with a bank chest, one trader and NO guards; reds respawn at its fire. Characters' caravan kit
// (public/world/camp/caravan-kit.glb + caravan-kit.json: `layout` = [piece, x, z, headingDeg] from the fire in glTF axes, `anchors`, `camp_radius_m`) is placed here BY NAME at the Ferry Landing
// spot World picked. Pure placement is node-tested; the draw is the page's (main.ts, behind the region and `?camp=0`). Roles (the trader NPC row, the bank interaction, the red respawn) are Backend's
// and Combat's: this file only says WHERE (anchors in world metres).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';

export const OUTLAW_CAMP = { id: 'outlaw-camp', zone: 'ferry-landing', at: { x: -146, z: -72 }, heading: Math.atan2(14, 22),   // the camp's front (and its sign) face the road end (-132,-50): (+14,+22) from the fire; Characters' convention: rotate the whole layout by H and add H to each piece's heading
   kit: '/world/camp/caravan-kit.glb', manifest: '/world/camp/caravan-kit.json' } as const;
export type KitManifest = { layout: ReadonlyArray<readonly [string, number, number, number]>; anchors: Record<'bank' | 'trader' | 'fire' | 'red_respawn', readonly [number, number, number]>; camp_radius_m: number };
export type Placement = { piece: string; x: number; z: number; rotY: number };

/** Camp-local (x, z) -> world, for a camp at `at` turned `heading` radians about +Y (three's rotation.y: +x -> -z for a positive turn). */
export const toWorld = (at: { x: number; z: number }, heading: number, lx: number, lz: number) => ({ x: at.x + lx * Math.cos(heading) + lz * Math.sin(heading), z: at.z - lx * Math.sin(heading) + lz * Math.cos(heading) });
export function campPlacements(m: Pick<KitManifest, 'layout'>, at = OUTLAW_CAMP.at, heading = OUTLAW_CAMP.heading): Placement[] {
  return m.layout.map(([piece, lx, lz, deg]) => ({ piece, ...toWorld(at, heading, lx, lz), rotY: heading + (deg * Math.PI) / 180 }));
}
export function campAnchors(m: Pick<KitManifest, 'anchors'>, at = OUTLAW_CAMP.at, heading = OUTLAW_CAMP.heading) {
  const w = (a: readonly [number, number, number]) => toWorld(at, heading, a[0], a[2]);
  return { bank: w(m.anchors.bank), trader: w(m.anchors.trader), fire: w(m.anchors.fire), redRespawn: w(m.anchors.red_respawn) };
}
/** The kit must supply every placed piece by node name; returns the names it cannot find (a test and the page both check this). */
export const missingPieces = (m: Pick<KitManifest, 'layout'>, nodeNames: ReadonlySet<string>): string[] => [...new Set(m.layout.map((p) => p[0]))].filter((n) => !nodeNames.has(n));

/** Draw the camp into `scene`; resolves to the anchors in world metres (or null when the kit did not load: the page goes on without a camp). */
export async function drawOutlawCamp(scene: THREE.Scene, groundY: (x: number, z: number) => number = () => 0, base = '/'): Promise<ReturnType<typeof campAnchors> | null> {
  try {
    const [manifest, gltf] = await Promise.all([fetch(base.replace(/\/$/, '') + OUTLAW_CAMP.manifest).then((r) => (r.ok ? (r.json() as Promise<KitManifest>) : Promise.reject(new Error(String(r.status))))), new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(base.replace(/\/$/, '') + OUTLAW_CAMP.kit)]);
    const nodes = new Map<string, THREE.Object3D>(); gltf.scene.traverse((o) => { if (o.name && !nodes.has(o.name)) nodes.set(o.name, o); });
    const lost = missingPieces(manifest, new Set(nodes.keys())); if (lost.length) console.warn('outlaw camp: kit nodes missing', lost);
    const group = new THREE.Group(); group.name = OUTLAW_CAMP.id;
    for (const p of campPlacements(manifest)) { const n = nodes.get(p.piece); if (!n) continue; const o = clone(n); o.position.set(p.x, groundY(p.x, p.z), p.z); o.rotation.set(0, p.rotY, 0); o.traverse((c) => { const m = c as THREE.Mesh; if (m.isMesh) { m.castShadow = false; m.receiveShadow = true; } }); group.add(o); }
    const a = campAnchors(manifest), fire = new THREE.PointLight(0xff8a3c, 14, 16, 2); fire.position.set(a.fire.x, groundY(a.fire.x, a.fire.z) + 1.0, a.fire.z); group.add(fire);
    scene.add(group); return a;
  } catch (error) { console.warn('outlaw camp did not load', error); return null; }
}
