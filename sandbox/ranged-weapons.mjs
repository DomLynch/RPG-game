// COPY of scripts/build-ranged-weapons.mjs from branch char/ranged-weapons (Characters & Art, c1ff9a19a), CLI block removed so the sandbox page can import it. Replace with the lane's newer version when it changes.
// Sandbox ranged weapons, first pass (Dom's order via the Combat/sandbox dev, 2026-10-15): a staff, a bow and a crossbow as real models for the combat sandbox, OFF TRUNK
// (own branch char/ranged-weapons; no entry in build-weapon.mjs WEAPON_BUILDS, no WeaponId, so none of the weapon-lane pins is touched). Same contract as every part in build-weapon.mjs:
// a Group named `WeaponDrawn`, the grip at the origin, local +Y along the weapon, plain three.js geometry, the game's own material names (no new textures). The hero build hangs a part
// under hand_r with SwordDrawn's transform (rotation x +90 deg, translation 0, .08, .015); the BOW is held in hand_l with the string nocked to the right hand (`userData.nock`).
//   node scripts/build-ranged-weapons.mjs <staff-v1|bow-v1|crossbow-v1>     writes the part alone to src/assets/source/ranged-weapons/<id>.glb
import * as T from 'three';

const mat = (name, color, roughness, metalness = 0) => new T.MeshStandardMaterial({ name, color, roughness, metalness });
const materials = () => ({
  wood: mat('Wood', '#5a3b22', 0.9),
  dark: mat('Haft', '#3f2d1f', 0.92),
  leather: mat('Waxed leather', '#4a3426', 0.85),
  brass: mat('Antique brass', '#a07a42', 0.45, 0.85),
  steel: mat('Steel', '#a2a8ae', 0.45, 0.85),
  bowWood: mat('Wood', '#b98448', 0.8),
  cord: mat('Cord', '#d2c7a4', 0.95),
  ivory: Object.assign(mat('Bone', '#ece6d6', 0.6), { emissive: new T.Color('#fff4d8'), emissiveIntensity: 0.55 }),
});
const piece = (group, geometry, material, [x, y, z] = [0, 0, 0]) => { const mesh = new T.Mesh(geometry, material); mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; group.add(mesh); return mesh; };
const cyl = (rTop, rBottom, from, to, seg = 12) => new T.CylinderGeometry(rTop, rBottom, to - from, seg).translate(0, (from + to) / 2, 0);
// A thin rod between two points (a prong, a string, a limb tip).
const rod = (a, b, r, seg = 6) => {
  const from = new T.Vector3(...a), to = new T.Vector3(...b), dir = to.clone().sub(from), g = new T.CylinderGeometry(r, r, dir.length(), seg);
  g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), dir.normalize())); g.translate(...from.clone().add(to).multiplyScalar(0.5).toArray()); return g;
};
const tube = (points, r, seg = 28) => new T.TubeGeometry(new T.CatmullRomCurve3(points.map((p) => new T.Vector3(...p))), seg, r, 8, false);

// STAFF: a tall wooden staff (butt -.65, head to 1.38: about 2.0 m, hero height plus the head), a wrapped grip, brass rings, and a three-pronged cradle that holds a pale orb (the white-orb bolt leaves from it).
export function staff() {
  const m = materials(), group = new T.Group(); group.name = 'WeaponDrawn';
  piece(group, cyl(0.034, 0.027, -0.62, 1.2, 16), m.wood);                        // shaft, a little thicker at the top
  piece(group, cyl(0.041, 0.041, -0.12, 0.26, 16), m.leather);                   // grip wrap
  for (let i = 0; i < 5; i++) piece(group, new T.TorusGeometry(0.0415, 0.005, 6, 16).rotateX(Math.PI / 2), m.cord, [0, -0.1 + i * 0.075, 0]);
  piece(group, cyl(0.036, 0.035, -0.68, -0.6, 14), m.brass);                      // butt ferrule
  piece(group, new T.TorusGeometry(0.037, 0.0075, 7, 16).rotateX(Math.PI / 2), m.brass, [0, 1.16, 0]);
  piece(group, new T.TorusGeometry(0.037, 0.0075, 7, 16).rotateX(Math.PI / 2), m.brass, [0, 1.0, 0]);
  for (let k = 0; k < 3; k++) {                                                    // the cradle: three prongs curling out and in around the orb
    const a = (k / 3) * Math.PI * 2 + 0.5, at = (r, y) => [Math.cos(a) * r, y, Math.sin(a) * r];
    piece(group, tube([at(0.03, 1.2), at(0.085, 1.28), at(0.1, 1.36), at(0.07, 1.45)], 0.016, 14), m.dark);
  }
  piece(group, new T.SphereGeometry(0.075, 20, 16), m.ivory, [0, 1.36, 0]);        // the orb in its cradle
  group.userData = { weapon: 'staff-v1', hand: 'hand_r', muzzle: [0, 1.36, 0], contact: { from: 1.0, to: 1.45 } };
  return group;
}

// BOW: held in hand_l, grip at the origin, limbs curving toward +Z (the archer's side) so the string runs straight between the tips on the +Z side (1.46 m tip to tip). `userData.nock` is the string's
// middle, where the right hand takes it.
export function bow() {
  const m = materials(), group = new T.Group(); group.name = 'WeaponDrawn';
  const TIP = 0.72, BACK = 0.17;
  for (const s of [1, -1]) {
    const pts = [[0, s * 0.08, 0], [0, s * 0.26, 0.02], [0, s * 0.46, 0.085], [0, s * 0.62, 0.14], [0, s * TIP, BACK]];
    piece(group, tube(pts, 0.024, 26), m.bowWood);                                    // a limb
    piece(group, new T.SphereGeometry(0.03, 10, 8), m.dark, [0, s * TIP, BACK]);    // the tip nock
  }
  piece(group, cyl(0.034, 0.034, -0.11, 0.11, 16), m.leather);                          // grip wrap
  for (let i = 0; i < 3; i++) piece(group, new T.TorusGeometry(0.0345, 0.0045, 6, 16).rotateX(Math.PI / 2), m.cord, [0, -0.06 + i * 0.06, 0]);
  piece(group, rod([0, -TIP, BACK], [0, TIP, BACK], 0.0055), m.cord);               // the string
  piece(group, new T.BoxGeometry(0.026, 0.07, 0.03), m.dark, [0.026, 0.13, 0.004]);   // the arrow rest, a small shelf above the grip
  group.userData = { weapon: 'bow-v1', hand: 'hand_l', nock: [0, 0, BACK], contact: { from: 0.1, to: 0.7 } };
  return group;
}

// CROSSBOW: a wooden stock with a pistol grip, a steel prod across the front, a string, a stirrup. Grip at the origin; +Y is the shooting direction (the muzzle), +Z the top of the stock. Two-handed look: the
// forend is long enough for the left hand.
export function crossbow() {
  const m = materials(), group = new T.Group(); group.name = 'WeaponDrawn';
  piece(group, new T.BoxGeometry(0.078, 0.78, 0.088), m.wood, [0, 0.26, 0.02]);                // the tiller
  piece(group, new T.BoxGeometry(0.05, 0.64, 0.016), m.dark, [0, 0.32, 0.066]);                  // the flight groove strip
  piece(group, new T.BoxGeometry(0.066, 0.13, 0.13).rotateX(0.35), m.wood, [0, -0.03, -0.09]);   // the pistol grip, raked back
  piece(group, new T.BoxGeometry(0.09, 0.075, 0.08), m.brass, [0, 0.09, 0.03]);                // the lock plate
  piece(group, new T.BoxGeometry(0.01, 0.02, 0.05), m.steel, [0, 0.04, -0.03]);                 // the trigger
  const PY = 0.56;                                                                             // the prod's seat on the stock
  piece(group, tube([[-0.44, PY + 0.14, 0.02], [-0.26, PY + 0.06, 0.02], [0, PY, 0.02], [0.26, PY + 0.06, 0.02], [0.44, PY + 0.14, 0.02]], 0.03, 28), m.steel);
  piece(group, new T.BoxGeometry(0.15, 0.07, 0.1), m.dark, [0, PY - 0.005, 0.02]);              // the prod's saddle on the stock
  piece(group, rod([-0.44, PY + 0.14, 0.02], [0.44, PY + 0.14, 0.02], 0.0055), m.cord);            // the string, let down
  piece(group, new T.TorusGeometry(0.06, 0.011, 7, 16).rotateX(Math.PI / 2), m.steel, [0, PY + 0.17, 0.02]);   // hmm: a stirrup hoop at the muzzle
  group.userData = { weapon: 'crossbow-v1', hand: 'hand_r', muzzle: [0, PY + 0.14, 0.05], contact: { from: 0.3, to: 0.7 } };
  return group;
}

export const RANGED_BUILDS = { 'staff-v1': staff, 'bow-v1': bow, 'crossbow-v1': crossbow };
