// Graft slice 1 — STILLS ONLY (block B, Lead 2026-09-24): the Witch's casting arm (skill: Witch-fire) on the player rig, three directions.
// A preview for Dom's pick, reached only through ?graft=a|b|c; nothing ships from this file as it stands. Her cloak hides both her arms,
// so the grafted arm is the player's own left arm (the triangles its bones own), re-skinned ashen like hers; his bracer comes off it. The three directions differ in how the seam
// is dressed, not in tint: (a) raw and stitched, (b) bound in bandage, (c) the arm burning with witch-fire in the veins (green, never orange: docs/briefs/witch.md).
import * as THREE from 'three';

export type GraftStyle = 'a' | 'b' | 'c';
const ARM = /^(upperarm|lowerarm|hand|index|middle|pinky|ring|thumb)_.*l$/;   // her left (casting) arm below the shoulder; the clavicle stays his
const SEAM = { along: 0.1, radius: 0.058 };   // metres from the shoulder joint down the upper arm, and the ring's radius there

// The triangles whose three corners are mostly owned by the arm's bones (weight > half), as a new index list over the same vertices.
function armTriangles(mesh: THREE.SkinnedMesh, keep: boolean): number[] {
  const index = mesh.geometry.index!, si = mesh.geometry.attributes.skinIndex, sw = mesh.geometry.attributes.skinWeight;
  const arm = new Set(mesh.skeleton.bones.map((b, i) => (ARM.test(b.name) ? i : -1)).filter(i => i >= 0));
  const owned = (v: number) => { let w = 0; for (let k = 0; k < 4; k++) if (arm.has(si.getComponent(v, k))) w += sw.getComponent(v, k); return w > 0.5; };
  const out: number[] = [];
  for (let t = 0; t < index.count; t += 3) {
    const a = index.getX(t), b = index.getX(t + 1), c = index.getX(t + 2), inArm = owned(a) && owned(b) && owned(c);
    if (inArm === keep) out.push(a, b, c);
  }
  return out;
}

// Veins for (c): branching lines in the arm's own UV space, drawn once into a canvas and used as an emissive map.
function veinTexture(): THREE.CanvasTexture {
  const size = 512, canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  const g = canvas.getContext('2d')!; g.fillStyle = '#000'; g.fillRect(0, 0, size, size);
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  g.lineCap = 'round';
  for (let v = 0; v < 90; v++) {
    let x = rnd() * size, y = rnd() * size, a = rnd() * Math.PI * 2;
    g.strokeStyle = `rgba(${60 + Math.round(rnd() * 70)},255,90,${0.55 + rnd() * 0.45})`;
    g.lineWidth = 1 + rnd() * 2.2; g.beginPath(); g.moveTo(x, y);
    for (let s = 0; s < 14; s++) { a += (rnd() - 0.5) * 0.9; x += Math.cos(a) * 9; y += Math.sin(a) * 9; g.lineTo(x, y); }
    g.stroke();
  }
  const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; t.flipY = false; return t;
}

// A ring (or band) around the upper arm at the seam, on his upperarm_l bone, oriented along the bone toward the elbow.
function aroundArm(upper: THREE.Bone, lower: THREE.Bone, geometry: THREE.BufferGeometry, material: THREE.Material, along: number): THREE.Mesh {
  upper.updateWorldMatrix(true, false); lower.updateWorldMatrix(true, false);
  const axisLocal = upper.worldToLocal(lower.getWorldPosition(new THREE.Vector3())).normalize();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axisLocal);
  mesh.position.copy(axisLocal).multiplyScalar(along / upper.getWorldScale(new THREE.Vector3()).x);
  mesh.name = 'graft-seam'; mesh.castShadow = true; upper.add(mesh); return mesh;
}

export type GraftReport = { armVertices: number; armTriangles: number; bytes: { geometry: number; texture: number } };

// Graft her arm onto the player rig under `anchor` in the chosen style. Returns what the arm costs, for the dist-bytes line.
export function graftArm(anchor: THREE.Object3D, witch: THREE.Object3D, style: GraftStyle): GraftReport {
  let body: THREE.SkinnedMesh | undefined, skin: THREE.SkinnedMesh | undefined; const bracers: THREE.SkinnedMesh[] = [];
  witch.traverse(o => { if (o instanceof THREE.SkinnedMesh && o.name === 'CreatureBody') body = o; });
  anchor.traverse(o => { if (o instanceof THREE.SkinnedMesh && (o.material as THREE.Material).name === 'Skin') skin = o; if (o instanceof THREE.SkinnedMesh && (o.material as THREE.Material).name === 'Wrap' && o.userData.slot === 'Arms') bracers.push(o); });
  if (!body || !skin) throw new Error('graft: need her CreatureBody and his Skin');
  // Her CreatureBody keeps both arms inside the cloak (her upperarm_l owns no vertices), so a cut of "her arm" is only sleeve rags with
  // no upper arm. The grafted arm is therefore HIS arm's own geometry on his own bones (it fits by construction), skinned ashen and
  // dead like hers. (Her sleeve rags were tried as a cuff and read as a loose black shard at the wrist; dropped.)
  for (const own of bracers) { const g = own.geometry.clone(); g.setIndex(armTriangles(own, false)); own.geometry = g; }
  const armIndex = armTriangles(skin, true), rest = skin.geometry.clone(); rest.setIndex(armTriangles(skin, false));
  const armGeometry = skin.geometry.clone(); armGeometry.setIndex(armIndex); skin.geometry = rest;
  const ash = (skin.material as THREE.MeshStandardMaterial).clone(); ash.name = 'GraftSkin';
  ash.color.set('#7f8c78'); ash.roughness = 0.9;   // a factor only darkens the map: grey-green, bloodless
  if (style === 'c') { ash.emissive.set('#7dff6a'); ash.emissiveMap = veinTexture(); ash.emissiveIntensity = 1.6; }
  const arm = new THREE.SkinnedMesh(armGeometry, ash); arm.name = 'graft-arm'; arm.castShadow = arm.receiveShadow = true; arm.frustumCulled = false;
  arm.bind(skin.skeleton, skin.bindMatrix); skin.parent!.add(arm);
  const byName = new Map<string, THREE.Bone>(); skin.skeleton.bones.forEach(b => byName.set(b.name, b));
  // The seam.
  const upper = byName.get('upperarm_l')!, lower = byName.get('lowerarm_l')!;
  if (style === 'a') {   // raw: a livid weal of sewn flesh, and black thread crossing it
    aroundArm(upper, lower, new THREE.TorusGeometry(SEAM.radius, 0.016, 8, 28).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#6e1f1c', roughness: 0.55 }), SEAM.along);
    const thread = new THREE.MeshStandardMaterial({ color: '#141010', roughness: 0.8 });
    for (let k = 0; k < 14; k++) {
      const stitch = new THREE.BoxGeometry(0.006, 0.05, 0.006).rotateZ(k % 2 ? 0.5 : -0.5);
      const a = (k / 14) * Math.PI * 2; stitch.translate(Math.cos(a) * (SEAM.radius + 0.008), 0, Math.sin(a) * (SEAM.radius + 0.008)); stitch.rotateY(0);
      aroundArm(upper, lower, stitch, thread, SEAM.along);
    }
  } else if (style === 'b') {   // bound: three turns of dirty linen over the seam, one slipped lower
    const linen = new THREE.MeshStandardMaterial({ color: '#b9ab8f', roughness: 0.95, side: THREE.DoubleSide });
    for (const [along, r, h, tilt] of [[0.07, SEAM.radius + 0.012, 0.05, 0.12], [0.11, SEAM.radius + 0.01, 0.045, -0.18], [0.15, SEAM.radius + 0.004, 0.04, 0.08]] as const)
      aroundArm(upper, lower, new THREE.CylinderGeometry(r, r * 0.96, h, 24, 1, true).rotateZ(tilt), linen, along);
  } else {   // witch-fire: the seam itself glows, where her fire meets his flesh
    aroundArm(upper, lower, new THREE.TorusGeometry(SEAM.radius, 0.013, 8, 28).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#0b1a08', emissive: '#7dff6a', emissiveIntensity: 3 }), SEAM.along);
  }
  // Cost: the arm reuses his vertices, so what it adds is one index list (plus the vein canvas in (c), drawn at runtime, not shipped).
  return { armVertices: new Set(armIndex).size, armTriangles: armIndex.length / 3, bytes: { geometry: armIndex.length * 4, texture: 0 } };
}

// The in-game hook's entry (scene.ts, ?graft=): her GLB loaded on its own, then the same graft as the studio sheet.
export async function graftFromUrl(anchor: THREE.Object3D, witchUrl: string, style: GraftStyle): Promise<GraftReport> {
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js'), { MeshoptDecoder } = await import('three/addons/libs/meshopt_decoder.module.js');
  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(witchUrl);
  return graftArm(anchor, gltf.scene, style);
}
