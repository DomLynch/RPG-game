import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { ArenaMaterials } from '../../src/arena.ts';
import { exchangeAnchors, exchangePlan, FORGE_HALF, KERB_INSET, STONE_RADIUS, type Piece, type Plan, type Shape, type Tint } from './exchange-plan.ts';

// Greybox of the walk out (Origins look prototype, not the build): the passage behind the Pit's gate, the Concord Exchange plaza and the
// bank's front. Blocking only: massing, scale, light and the arena's own materials, so Dom judges proportion and mood before any asset.
// The Pit's gate faces −z (arena.ts LAYOUT.gate = π). Everything here sits outside the Pit's parapet (r > 23.2 m) except the passage.
// Where it all stands is the world data (origins/world/concord.ts); exchange-plan.ts lays the pieces out, this file only builds them.
const A = exchangeAnchors();
export const PASSAGE = A.passage;
export const PLAZA = { halfWidth: A.halfWidth - KERB_INSET, near: A.gate.z, far: A.bank.z + 0.5 };
export const STONE_CENTRE = { ...A.stone, radius: STONE_RADIUS };
export const BANK_STEP_Z = A.bank.z;
export const FORGE = { ...A.forge, halfX: FORGE_HALF.x, halfZ: FORGE_HALF.z };   // the blacksmith (Dom 2026-10-06: NPC upgrade service), open toward the plaza

// One placed piece: world transform, box-projected UVs in metres (the arena's stone texture tiles at 2 m), a tint darkened toward its foot.
function piece(geometry: THREE.BufferGeometry, x: number, y: number, z: number, tint: Tint, rotY = 0, foot = y - 10): THREE.BufferGeometry {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotY, 0)), new THREE.Vector3(1, 1, 1)));
  g.computeVertexNormals();
  const p = g.attributes.position, n = g.attributes.normal, uv = new Float32Array(p.count * 2), color = new Float32Array(p.count * 3), tile = 2;
  for (let i = 0; i < p.count; i++) {
    const px = p.getX(i), py = p.getY(i), pz = p.getZ(i), nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i)), nz = Math.abs(n.getZ(i));
    const [u, v] = ny >= nx && ny >= nz ? [px, pz] : nx >= nz ? [pz, py] : [px, py];
    uv[i * 2] = u / tile; uv[i * 2 + 1] = v / tile;
    const shade = 0.7 + 0.3 * Math.min(1, Math.max(0, (py - foot) / 0.8));
    color[i * 3] = tint[0] * shade; color[i * 3 + 1] = tint[1] * shade; color[i * 3 + 2] = tint[2] * shade;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.BufferAttribute(color, 3));
  return g;
}
function geometryOf(s: Shape): THREE.BufferGeometry {
  switch (s[0]) {
    case 'box': return new THREE.BoxGeometry(s[1], s[2], s[3]);
    case 'cylinder': return new THREE.CylinderGeometry(s[1], s[2], s[3], s[4]);
    case 'cone': return new THREE.ConeGeometry(s[1], s[2], s[3]);
    case 'sphere': return new THREE.SphereGeometry(s[1], s[2], s[3]);
    case 'pediment': {
      const tri = new THREE.Shape([new THREE.Vector2(-s[1] / 2, 0), new THREE.Vector2(s[1] / 2, 0), new THREE.Vector2(0, s[2])]);
      return new THREE.ExtrudeGeometry(tri, { depth: s[3], bevelEnabled: false }).translate(0, 0, -s[3] / 2);
    }
  }
}

// The frieze inscription: carved letters on a stone-coloured canvas (greybox signage, not final art).
function inscription(text: string): THREE.MeshStandardMaterial {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 96;
  const g = c.getContext('2d')!;
  g.fillStyle = '#8f8676'; g.fillRect(0, 0, c.width, c.height);
  g.font = '600 62px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#d2c8b4'; g.fillText(text, c.width / 2 + 2, c.height / 2 + 3);   // the lit lower lip of each cut
  g.fillStyle = '#2b2620'; g.fillText(text, c.width / 2, c.height / 2);
  const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8;
  return new THREE.MeshStandardMaterial({ map, roughness: 0.95 });
}

// Every piece of a plan, merged into one mesh per layer (stone, iron, dark, coal) named `<prefix>-<layer>`, added to the group.
// `own` gives the stone and paving layers materials of their own (the Exchange's clones, so a look can tint them without touching the arena's).
export function meshPieces(group: THREE.Group, pieces: readonly Piece[], m: ArenaMaterials, prefix: string, own: { stone?: THREE.Material; paving?: THREE.Material } = {}): void {
  const layers: Record<string, THREE.BufferGeometry[]> = { stone: [], paving: [], iron: [], soot: [], coal: [] };
  for (const p of pieces) layers[p.layer]!.push(piece(geometryOf(p.shape), p.x, p.y, p.z, p.tint, p.rotY, p.foot));
  const add = (parts: THREE.BufferGeometry[], material: THREE.Material, name: string) => {
    if (!parts.length) return;
    const mesh = new THREE.Mesh(mergeGeometries(parts), material); mesh.name = `${prefix}-${name}`; mesh.castShadow = name !== 'coal'; mesh.receiveShadow = true; group.add(mesh);
  };
  add(layers.stone!, own.stone ?? m.stone, 'stone'); add(layers.paving!, own.paving ?? m.stone, 'paving'); add(layers.iron!, m.iron, 'iron');
  add(layers.soot!, new THREE.MeshStandardMaterial({ color: '#0d0b0a', roughness: 1 }), 'dark');
  add(layers.coal!, m.coal, 'coal');
}

export type Exchange = { group: THREE.Group; braziers: THREE.Vector3[]; hearth: THREE.Vector3; ground: THREE.MeshStandardMaterial; stone: THREE.MeshStandardMaterial; update(time: number): void };

export function buildExchange(scene: THREE.Scene, m: ArenaMaterials, plan: Plan = exchangePlan(A)): Exchange {
  const group = new THREE.Group(); group.name = 'concord-exchange'; scene.add(group);

  const awnings: THREE.Mesh[] = [];
  for (const a of plan.awnings) {
    const awning = new THREE.Mesh(new THREE.PlaneGeometry(3, 2.2, 6, 4), new THREE.MeshStandardMaterial({ color: a.color, roughness: 1, side: THREE.DoubleSide }));
    awning.position.set(a.x, a.y, a.z); awning.rotation.set(-Math.PI / 2 + 0.18, 0, 0); awning.castShadow = awning.receiveShadow = true;
    group.add(awning); awnings.push(awning);
  }
  for (const f of plan.people) {
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.27, 1.2, 4, 10), new THREE.MeshStandardMaterial({ color: f.color, roughness: 0.95 }));
    body.position.set(f.x, 0.87, f.z); body.castShadow = true; group.add(body);
  }

  // The paving and the masonry each get a clone of the arena's stone, so a look (look.ts) can grade them apart; untinted they are the arena's stone to the eye.
  const ground = m.stone.clone(), stone = m.stone.clone();
  meshPieces(group, plan.pieces, m, 'exchange', { stone, paving: ground });
  const frieze = new THREE.Mesh(new THREE.PlaneGeometry(14, 1.3), inscription(plan.frieze.text));
  frieze.position.set(plan.frieze.x, plan.frieze.y, plan.frieze.z); group.add(frieze);

  return {
    group, ground, stone, braziers: plan.braziers.map((b) => new THREE.Vector3(b.x, 0, b.z)), hearth: new THREE.Vector3(plan.hearth.x, plan.hearth.y, plan.hearth.z),
    update(time: number) {
      for (const c of [ground, stone]) if (c.map !== m.stone.map) { c.map = m.stone.map; c.normalMap = m.stone.normalMap; c.needsUpdate = true; }   // the arena swaps its heavy stone textures in late; the clones follow
      awnings.forEach((a, i) => { a.rotation.x = -Math.PI / 2 + 0.18 + Math.sin(time * 1.3 + i) * 0.015; });
    },
  };
}

// Where the walker may stand: the Pit's sand, the passage, the plaza (not through the stone or up the bank's steps).
export function walkable(x: number, z: number): boolean {
  if (Math.hypot(x, z) < 8.3) return true;
  if (Math.abs(x) < PASSAGE.halfWidth - 0.35 && z < -6 && z > PASSAGE.to - 0.5) return true;
  if (Math.abs(x - FORGE.x) < FORGE.halfX + 0.3 && Math.abs(z - FORGE.z) < FORGE.halfZ + 0.3) return x > FORGE.x - FORGE.halfX + 2;   // inside the smithy, short of the hearth
  if (Math.abs(x) < PLAZA.halfWidth + 2.5 && z <= PLAZA.near && z > BANK_STEP_Z + 0.6) return Math.hypot(x - STONE_CENTRE.x, z - STONE_CENTRE.z) > STONE_CENTRE.radius + 0.4;
  return false;
}
