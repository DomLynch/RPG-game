import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { ArenaMaterials } from '../../src/arena.ts';

// Greybox of the walk out (Origins look prototype, not the build): the passage behind the Pit's gate, the Concord Exchange plaza and the
// bank's front. Blocking only: massing, scale, light and the arena's own materials, so Dom judges proportion and mood before any asset.
// The Pit's gate faces −z (arena.ts LAYOUT.gate = π). Everything here sits outside the Pit's parapet (r > 23.2 m) except the passage.

export const PASSAGE = { halfWidth: 1.25, from: -15.4, to: -25 };
export const PLAZA = { halfWidth: 16, near: -25, far: -66.5 };
export const STONE_CENTRE = { x: 0, z: -45, radius: 2.6 };
export const BANK_STEP_Z = -67;
export const FORGE = { x: -10.5, z: -60.5, halfX: 2.2, halfZ: 2.6 };   // the blacksmith (Dom 2026-10-06: NPC upgrade service), open toward the plaza

type Tint = [number, number, number];
const SANDSTONE: Tint = [1.05, 1, 0.92], DARKSTONE: Tint = [0.62, 0.6, 0.57], PAVING: Tint = [0.86, 0.83, 0.78], SOOT: Tint = [0.1, 0.09, 0.08];

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
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const column = (r: number, h: number) => new THREE.CylinderGeometry(r * 0.88, r, h, 14);

// The kit's column (Concord Exchange kit, slice 1): a base plinth and torus, a shaft with entasis (a slight swell, narrower at the neck) and 16 flutes,
// and a capital of necking, echinus and abacus. Same footprint as the greybox column (radius r, height h from `base`), so nothing around it moves.
function flutedShaft(r: number, h: number): THREE.BufferGeometry {
  const profile = [[0.9, 0], [1, 0.03], [1.01, 0.4], [1, 0.62], [0.92, 1]].map(([k, t]) => new THREE.Vector2(r * k, t * h));
  const g = new THREE.LatheGeometry(profile, 32).toNonIndexed(), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), f = 1 - 0.045 * Math.abs(Math.sin(Math.atan2(z, x) * 8)) ** 0.6; p.setXYZ(i, x * f, p.getY(i), z * f); }
  return g;
}
function fluteColumn(out: THREE.BufferGeometry[], x: number, z: number, h: number, r: number, base = 0) {
  const cap = 0.55, shaft = h - 0.3 - cap;   // plinth .3 + torus, shaft, then neck + echinus + abacus (cap)
  out.push(piece(box(r * 2.7, 0.3, r * 2.7), x, base + 0.15, z, DARKSTONE, 0, base),
    piece(new THREE.CylinderGeometry(r * 1.18, r * 1.28, 0.16, 20), x, base + 0.38, z, DARKSTONE, 0, base),
    piece(flutedShaft(r, shaft).translate(0, 0.46, 0), x, base, z, SANDSTONE, 0, base),
    piece(new THREE.CylinderGeometry(r * 0.92, r * 0.86, 0.1, 20), x, base + h - cap + 0.05, z, DARKSTONE, 0, base),
    piece(new THREE.CylinderGeometry(r * 1.45, r * 0.95, 0.28, 20), x, base + h - cap + 0.24, z, SANDSTONE, 0, base),
    piece(box(r * 3.0, 0.17, r * 3.0), x, base + h - 0.085, z, SANDSTONE, 0, base));
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

export type Exchange = { group: THREE.Group; braziers: THREE.Vector3[]; hearth: THREE.Vector3; update(time: number): void };

export function buildExchange(scene: THREE.Scene, m: ArenaMaterials): Exchange {
  const group = new THREE.Group(); group.name = 'concord-exchange'; scene.add(group);
  const stones: THREE.BufferGeometry[] = [], irons: THREE.BufferGeometry[] = [], soot: THREE.BufferGeometry[] = [];
  const P = PASSAGE, Z = PLAZA;

  // The passage: the gate's dark tunnel carried on under the stands and out through the parapet; a vault of slabs, lit only at its mouth.
  const len = P.from - P.to, mid = (P.from + P.to) / 2;
  for (const side of [-1, 1]) stones.push(piece(box(0.7, 3.2, len), side * (P.halfWidth + 0.35), 1.6, mid, DARKSTONE, 0, 0));
  stones.push(piece(box(P.halfWidth * 2 + 1.4, 0.5, len), 0, 3.45, mid, DARKSTONE));
  stones.push(piece(box(P.halfWidth * 2, 0.1, len), 0, -0.05, mid, SOOT));
  // The outer gate's arch on the plaza side: posts, lintel and a heavy keystone, proud of the parapet.
  for (const side of [-1, 1]) stones.push(piece(box(1.1, 4.4, 1.4), side * (P.halfWidth + 0.55), 2.2, P.to - 0.2, SANDSTONE, 0, 0));
  stones.push(piece(box(P.halfWidth * 2 + 2.6, 0.9, 1.6), 0, 4.85, P.to - 0.2, SANDSTONE), piece(box(1, 1.2, 1.7), 0, 5.2, P.to - 0.25, SANDSTONE));
  irons.push(piece(box(P.halfWidth * 2 + 0.1, 0.12, 0.12), 0, 3.15, P.to + 0.2, SOOT));   // the raised portcullis' bottom bar, parked in the slot

  // The plaza: a paved terrace on the island's rock, its kerb and a skirt of rock falling away under it (Arena 1 floats over the abyss).
  const depth = Z.near - Z.far + 6, cz = (Z.near + Z.far) / 2 - 2;
  stones.push(piece(box(Z.halfWidth * 2 + 8, 0.4, depth), 0, -0.2, cz, PAVING));
  for (let i = 0; i < 18; i++) {   // flagstone joints: a few darker slabs break the field so scale reads
    const x = ((i * 7.31) % 28) - 14, z = Z.near - 3 - ((i * 11.7) % 36);
    stones.push(piece(box(1.8 + (i % 3) * 0.5, 0.02, 1.2 + (i % 2) * 0.6), x, 0.01, z, DARKSTONE));
  }
  stones.push(piece(box(Z.halfWidth * 2 + 9, 26, depth + 1), 0, -13.4, cz, DARKSTONE, 0, -26));
  for (const side of [-1, 1]) stones.push(piece(box(0.6, 1.1, depth - 4), side * (Z.halfWidth + 3.6), 0.55, cz, SANDSTONE, 0, 0));   // balustrade over the drop

  // The two stoas: deep colonnades either side where the vaults, the contract board and the counters will live.
  for (const side of [-1, 1]) {
    const x = side * (Z.halfWidth - 1.5), back = side * (Z.halfWidth + 3), from = Z.near - 6, to = Z.far + 6;
    for (let z = from; z >= to; z -= 4) fluteColumn(stones, x, z, 5.2, 0.32);
    stones.push(piece(box(5.4, 0.7, from - to + 2), (x + back) / 2, 5.55, (from + to) / 2, SANDSTONE));
    for (let z = from; z >= to; z -= 4) stones.push(piece(box(5.4, 0.32, 0.5), (x + back) / 2, 5.05, z, DARKSTONE, 0, 4.9));   // a beam across every bay, under the roof slab, over each column
    stones.push(piece(box(0.4, 0.5, from - to + 2), x, 5.0, (from + to) / 2, DARKSTONE, 0, 4.8));                                  // the architrave the beams rest on
    stones.push(piece(box(0.8, 5.2, from - to + 2), back, 2.6, (from + to) / 2, DARKSTONE, 0, 0));
    for (let z = from - 2; z > to; z -= 8) soot.push(piece(box(0.1, 2.6, 1.6), back - side * 0.42, 1.3, z, SOOT));   // doorways into the back rooms
  }
  // The contract board, under the left stoa: a timber frame and pinned notices.
  stones.push(piece(box(0.25, 2.6, 0.25), -12.2, 1.3, -34.6, SOOT), piece(box(0.25, 2.6, 0.25), -12.2, 1.3, -37.4, SOOT), piece(box(0.14, 1.5, 3.1), -12.2, 1.75, -36, [0.5, 0.36, 0.24]),
    piece(box(0.4, 0.12, 3.5), -12.2, 2.66, -36, SOOT), piece(box(0.3, 0.1, 3.3), -12.2, 2.78, -36, [0.45, 0.33, 0.22]), piece(box(0.22, 0.08, 3.3), -12.2, 1.0, -36, SOOT));   // posts, board, a crossbar with a little hood and a ledge
  for (let i = 0; i < 9; i++) stones.push(piece(box(0.02, 0.36, 0.28), -12.1, 1.3 + (i % 3) * 0.45, -35 - Math.floor(i / 3) * 0.95 + (i % 2) * 0.12, [1.5, 1.42, 1.25]));

  // The Covenant Stone at the centre: why rivals may meet here without blades. A stepped round plinth and a tall dark stele.
  const S = STONE_CENTRE;
  stones.push(piece(new THREE.CylinderGeometry(S.radius, S.radius + 0.2, 0.4, 24), S.x, 0.2, S.z, DARKSTONE, 0, 0),
    piece(new THREE.CylinderGeometry(S.radius - 0.7, S.radius - 0.6, 0.4, 24), S.x, 0.6, S.z, DARKSTONE, 0, 0),
    piece(box(1.1, 6.2, 0.7), S.x, 3.9, S.z, [0.42, 0.4, 0.4], 0, 0.8), piece(new THREE.ConeGeometry(0.62, 0.9, 4), S.x, 7.45, S.z, [0.42, 0.4, 0.4], Math.PI / 4));

  // The bank's front: a podium of steps, eight columns, the entablature and pediment, the great iron doors.
  const B = BANK_STEP_Z, W = 26;
  for (let i = 0; i < 4; i++) { const h = 0.3 * (i + 1), d = 12 - i * 0.9; stones.push(piece(box(W - i * 1.2, h, d), 0, h / 2, B - i * 0.9 - d / 2, SANDSTONE, 0, 0)); }   // front edge steps back 0.9 m a riser
  const deck = 1.2, front = B - 3.2;
  for (let i = 0; i < 8; i++) fluteColumn(stones, -10.5 + i * 3, front, 9, 0.55, deck);
  stones.push(piece(box(W - 1, 1.5, 2.2), 0, deck + 9 + 0.75, front, SANDSTONE),
    piece(box(W, 0.4, 2.6), 0, deck + 10.7, front, SANDSTONE));
  const tri = new THREE.Shape([new THREE.Vector2(-W / 2, 0), new THREE.Vector2(W / 2, 0), new THREE.Vector2(0, 3.4)]);
  stones.push(piece(new THREE.ExtrudeGeometry(tri, { depth: 2.2, bevelEnabled: false }).translate(0, 0, -1.1), 0, deck + 10.9, front, SANDSTONE));
  stones.push(piece(box(W - 2, 12.5, 6), 0, deck + 6.25, front - 5.2, DARKSTONE, 0, deck));   // the hall behind the portico
  soot.push(piece(box(4.6, 6.2, 0.3), 0, deck + 3.1, front - 2.1, SOOT));                      // the doorway's depth
  for (const side of [-1, 1]) irons.push(piece(box(2.1, 5.8, 0.18), side * 1.1, deck + 2.9, front - 1.85, [1.6, 1.2, 0.75]));   // bronze-faced iron leaves
  for (let i = 0; i < 24; i++) irons.push(piece(new THREE.SphereGeometry(0.07, 6, 4), (i % 2 ? 1 : -1) * (0.4 + (i % 4 < 2 ? 0 : 1.3)), deck + 0.8 + Math.floor(i / 4) * 0.9, front - 1.74, [2.2, 1.6, 0.9]));

  // The blacksmith: an open-fronted smithy beside the bank, its mouth to the plaza. Back and side walls, a timber roof, a tall chimney,
  // the hearth's coals, an anvil and a quench trough; a hanging sign. Greybox massing only.
  const F = FORGE, TIMBER: Tint = [0.42, 0.3, 0.2];
  stones.push(piece(box(0.6, 4, F.halfZ * 2), F.x - F.halfX, 2, F.z, DARKSTONE, 0, 0));
  for (const side of [-1, 1]) stones.push(piece(box(F.halfX * 2, 4, 0.5), F.x, 2, F.z + side * F.halfZ, DARKSTONE, 0, 0));
  stones.push(piece(box(F.halfX * 2 + 1.2, 0.3, F.halfZ * 2 + 0.8), F.x + 0.3, 4.15, F.z, TIMBER));
  stones.push(piece(box(1.3, 7.5, 1.3), F.x - F.halfX + 0.5, 3.75, F.z - 1.2, DARKSTONE, 0, 0));
  stones.push(piece(box(1.6, 0.9, 1.6), F.x - F.halfX + 1.1, 0.45, F.z - 1.2, DARKSTONE, 0, 0));
  irons.push(piece(box(0.9, 0.5, 0.35), F.x + 0.4, 0.75, F.z + 0.3, SOOT), piece(box(0.4, 0.5, 0.3), F.x + 0.4, 0.25, F.z + 0.3, SOOT));
  stones.push(piece(box(0.6, 0.55, 1.6), F.x + 0.6, 0.28, F.z + 1.7, TIMBER, 0, 0));
  stones.push(piece(box(0.12, 0.9, 1.8), F.x + F.halfX + 0.7, 3.2, F.z - F.halfZ - 0.4, TIMBER));
  // Braziers: the light language of the Pit carried out here (coal glow; the flames are the arena's own flicker in main.ts).
  const braziers = [new THREE.Vector3(-4, 0, B - 1.2), new THREE.Vector3(4, 0, B - 1.2), new THREE.Vector3(-3.4, 0, P.to - 2), new THREE.Vector3(3.4, 0, P.to - 2), new THREE.Vector3(-4.2, 0, S.z), new THREE.Vector3(4.2, 0, S.z)];
  const coal: THREE.BufferGeometry[] = [piece(new THREE.BoxGeometry(1.3, 0.08, 1.3), FORGE.x - FORGE.halfX + 1.1, 0.94, FORGE.z - 1.2, [1, 1, 1])];
  for (const b of braziers) {
    for (let k = 0; k < 3; k++) {   // a tripod: three legs splayed from the bowl's ring to the flags, joined by a low hoop
      const a = (k / 3) * Math.PI * 2 + 0.4, lx = Math.cos(a), lz = Math.sin(a), leg = new THREE.CylinderGeometry(0.035, 0.045, 1.25, 6);
      leg.rotateZ(-lx * 0.17).rotateX(lz * 0.17);
      irons.push(piece(leg, b.x + lx * 0.2, 0.62, b.z + lz * 0.2, SOOT, 0, 0));
    }
    irons.push(piece(new THREE.TorusGeometry(0.3, 0.03, 6, 14).rotateX(Math.PI / 2), b.x, 0.45, b.z, SOOT, 0, 0),
      piece(new THREE.TorusGeometry(0.5, 0.045, 6, 18).rotateX(Math.PI / 2), b.x, 1.46, b.z, SOOT),
      piece(new THREE.CylinderGeometry(0.5, 0.26, 0.38, 14, 1, true), b.x, 1.29, b.z, [0.6, 0.5, 0.4]),
      piece(new THREE.CylinderGeometry(0.26, 0.05, 0.1, 10), b.x, 1.07, b.z, SOOT));
    coal.push(piece(new THREE.CylinderGeometry(0.42, 0.42, 0.06, 12), b.x, 1.46, b.z, [1, 1, 1]));
  }

  // Market stalls under awnings, right of the stone; cloth in the Pit's muted dyes.
  const dyes = ['#6e2a20', '#7a5a26', '#2f3a4e', '#4e3a2a'];
  const awnings: THREE.Mesh[] = [];
  for (let i = 0; i < 4; i++) {
    const x = 8.5, z = -31 - i * 6.5;
    const wood: Tint = [0.45, 0.33, 0.22];
    stones.push(piece(box(2.6, 0.12, 1.2), x, 1.0, z, [0.55, 0.42, 0.3], 0, 0), piece(box(2.5, 0.88, 0.1), x, 0.5, z + 0.55, [0.5, 0.38, 0.26], 0, 0),   // the counter top and its front board
      piece(box(0.1, 0.88, 1.0), x - 1.25, 0.5, z, wood, 0, 0), piece(box(0.1, 0.88, 1.0), x + 1.25, 0.5, z, wood, 0, 0), piece(box(2.5, 0.08, 1.1), x, 0.3, z, wood, 0, 0),   // its ends and a lower shelf
      piece(box(2.7, 0.1, 0.1), x, 2.28, z - 0.8, wood, 0, 0), piece(box(2.7, 0.1, 0.1), x, 2.28, z + 0.8, wood, 0, 0));                                                      // the beams the awning hangs from
    for (const dx of [-1.25, 1.25]) for (const dz of [-0.8, 0.8]) stones.push(piece(box(0.1, 2.3, 0.1), x + dx, 1.15, z + dz, wood, 0, 0));
    for (let c = 0; c < 4; c++) stones.push(piece(new THREE.CylinderGeometry(0.15, 0.17, 0.2, 8), x - 0.8 + c * 0.55, 1.16, z + 0.05, [0.62 - c * 0.04, 0.5, 0.36 + c * 0.03], 0, 0));   // wares: jars along the counter
    const awning = new THREE.Mesh(new THREE.PlaneGeometry(3, 2.2, 6, 4), new THREE.MeshStandardMaterial({ color: dyes[i], roughness: 1, side: THREE.DoubleSide }));
    awning.position.set(x, 2.35, z); awning.rotation.set(-Math.PI / 2 + 0.18, 0, 0); awning.castShadow = awning.receiveShadow = true;
    group.add(awning); awnings.push(awning);
  }

  // Envoys and traders standing about (scale figures only: 1.8 m capsules in cloth tones).
  const people: [number, number, string][] = [[-2.5, -33, '#5a4a3a'], [-1.8, -33.8, '#3a3a44'], [5.2, -40, '#6e5a40'], [6, -40.6, '#4a2a24'], [-9.5, -36, '#2e3640'], [-10, -35.2, '#5a4a3a'],
    [-3.5, -52, '#4a2a24'], [-2.8, -52.8, '#7a6a50'], [6.5, -56, '#3a3a44'], [1.5, -61, '#5a4a3a'], [-6, -60, '#2e3640'], [10.5, -47, '#4e3a2a'], [11, -34, '#6e2a20'], [-13, -50, '#3a3a44']];
  for (const [x, z, c] of people) {
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.27, 1.2, 4, 10), new THREE.MeshStandardMaterial({ color: c, roughness: 0.95 }));
    body.position.set(x, 0.87, z); body.castShadow = true; group.add(body);
  }

  const add = (parts: THREE.BufferGeometry[], material: THREE.Material, name: string) => {
    const mesh = new THREE.Mesh(mergeGeometries(parts), material); mesh.name = name; mesh.castShadow = mesh.receiveShadow = true; group.add(mesh); return mesh;
  };
  add(stones, m.stone, 'exchange-stone'); add(irons, m.iron, 'exchange-iron');
  add(soot, new THREE.MeshStandardMaterial({ color: '#0d0b0a', roughness: 1 }), 'exchange-dark');
  add(coal, m.coal, 'exchange-coal').castShadow = false;
  const frieze = new THREE.Mesh(new THREE.PlaneGeometry(14, 1.3), inscription('CONCORD  ·  EXCHANGE'));
  frieze.position.set(0, deck + 9.75, front + 1.12); group.add(frieze);

  return {
    group, braziers, hearth: new THREE.Vector3(FORGE.x - FORGE.halfX + 1.1, 1.3, FORGE.z - 1.2),
    update(time: number) { awnings.forEach((a, i) => { a.rotation.x = -Math.PI / 2 + 0.18 + Math.sin(time * 1.3 + i) * 0.015; }); },
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
