// COPY of scripts/build-ranged-weapons.mjs from branch char/ranged-weapons (Characters & Art, 47c653222), CLI block removed so the sandbox page can import it. Replace with the lane's newer version when it changes.
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
  bowWood: mat('Wood', '#5b3d25', 0.88),
  darkWood: mat('Wood', '#3a2716', 0.92),
  horn: mat('Bone', '#cbbd97', 0.7),
  bronze: mat('Bronze', '#8f6d38', 0.5, 0.7),
  oldLeather: mat('Waxed leather', '#2e2015', 0.9),
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
// A tube that narrows from r0 at its start to r1 at its end (a bow limb, a prod arm).
const taper = (points, r0, r1, seg = 30, radial = 10) => {
  const curve = new T.CatmullRomCurve3(points.map((p) => new T.Vector3(...p))), fr = curve.computeFrenetFrames(seg, false), pos = [], idx = [];
  for (let i = 0; i <= seg; i++) {
    const c = curve.getPoint(i / seg), r = r0 + (r1 - r0) * (i / seg);
    for (let j = 0; j < radial; j++) { const a = (j / radial) * Math.PI * 2, d = fr.normals[i].clone().multiplyScalar(Math.cos(a) * r).add(fr.binormals[i].clone().multiplyScalar(Math.sin(a) * r)); pos.push(c.x + d.x, c.y + d.y, c.z + d.z); }
  }
  for (let i = 0; i < seg; i++) for (let j = 0; j < radial; j++) { const a = i * radial + j, b = i * radial + ((j + 1) % radial), c = (i + 1) * radial + j, d = (i + 1) * radial + ((j + 1) % radial); idx.push(a, b, c, b, d, c); }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
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

// BOW: a Roman / steppe composite recurve in dark worn wood: a thick grip with a leather wrap, limbs that sweep toward the archer (+Z) and end in stiff recurved "ears" bent back away, horn nocks, a plain
// string between them (1.5 m tip to tip). Held in hand_l, grip at the origin; `userData.nock` is the string's middle, where the right hand takes it.
export function bow() {
  const m = materials(), group = new T.Group(); group.name = 'WeaponDrawn';
  const TIP = 0.76, BACK = 0.15;
  for (const s of [1, -1]) {
    const pts = [[0, s * 0.07, 0], [0, s * 0.2, 0.025], [0, s * 0.38, 0.09], [0, s * 0.56, 0.155], [0, s * 0.69, 0.185], [0, s * 0.75, 0.17], [0, s * TIP, BACK]];
    piece(group, taper(pts, 0.03, 0.017, 34, 10), m.bowWood);                                  // a limb: thick at the grip, slim at the ear
    piece(group, taper([[0, s * 0.1, 0.012], [0, s * 0.3, 0.07], [0, s * 0.5, 0.14]], 0.011, 0.009, 14, 8), m.darkWood, [0.0, 0, 0.0]);   // the darker back strip along the limb
    piece(group, new T.CylinderGeometry(0.016, 0.02, 0.05, 8).rotateX(s * 0.5).translate(0, s * (TIP + 0.01), BACK - 0.005), m.horn);   // the horn nock on the ear
  }
  piece(group, cyl(0.038, 0.038, -0.12, 0.12, 14), m.oldLeather);                              // the leather grip wrap
  for (let i = 0; i < 4; i++) piece(group, new T.TorusGeometry(0.0385, 0.005, 6, 16).rotateX(Math.PI / 2), m.cord, [0, -0.085 + i * 0.058, 0]);
  piece(group, cyl(0.045, 0.045, 0.12, 0.15, 14), m.darkWood);                                 // the riser's shoulder above the grip
  piece(group, cyl(0.045, 0.045, -0.15, -0.12, 14), m.darkWood);                               // and below
  piece(group, new T.BoxGeometry(0.03, 0.07, 0.034), m.darkWood, [0.03, 0.15, 0.0]);             // the arrow shelf
  piece(group, rod([0, -TIP, BACK], [0, TIP, BACK], 0.0045), m.cord);                          // the string
  group.userData = { weapon: 'bow-v1', hand: 'hand_l', nock: [0, 0, BACK], contact: { from: 0.1, to: 0.7 } };
  return group;
}

// CROSSBOW: a hand ballista in the style of the Greek gastraphetes and the Roman manuballista: a heavy wooden stock with a rounded chest rest at the back, a bronze-clad prod (a thick short bow) across the front,
// a bronze lock housing and a plain trigger, a wrapped grip, a bronze stirrup. Grip at the origin; +Y is the shooting direction, +Z the top of the stock. Nothing shiny: worn bronze, dark wood, old leather.
export function crossbow() {
  const m = materials(), group = new T.Group(); group.name = 'WeaponDrawn';
  piece(group, new T.BoxGeometry(0.1, 0.86, 0.1), m.darkWood, [0, 0.28, 0.0]);                  // the heavy stock
  piece(group, new T.BoxGeometry(0.07, 0.62, 0.03), m.wood, [0, 0.36, 0.06]);                  // the slide: a lighter board on top, the bolt's trough
  piece(group, new T.BoxGeometry(0.03, 0.62, 0.02), m.darkWood, [0, 0.36, 0.085]);              // the trough's groove
  piece(group, new T.CylinderGeometry(0.075, 0.075, 0.13, 14).rotateZ(Math.PI / 2), m.darkWood, [0, -0.17, -0.005]);   // the rounded chest rest at the back
  piece(group, cyl(0.04, 0.036, -0.13, 0.1, 12).rotateX(0.3), m.oldLeather, [0, -0.05, -0.1]);   // the wrapped pistol grip, raked back
  for (let i = 0; i < 3; i++) piece(group, new T.TorusGeometry(0.039, 0.005, 6, 14).rotateX(Math.PI / 2 + 0.3), m.cord, [0, -0.07 + i * 0.045, -0.115 + i * 0.012]);
  piece(group, new T.BoxGeometry(0.115, 0.17, 0.12), m.bronze, [0, 0.12, 0.01]);                // the bronze lock housing
  piece(group, new T.BoxGeometry(0.012, 0.025, 0.07), m.bronze, [0, 0.06, -0.08]);              // the trigger
  const PY = 0.62;
  for (const y of [0.18, 0.42]) piece(group, new T.BoxGeometry(0.108, 0.035, 0.108), m.bronze, [0, y, 0]);   // bronze bands round the stock
  piece(group, new T.BoxGeometry(0.16, 0.09, 0.13), m.bronze, [0, PY, 0.01]);                   // the prod's bronze saddle
  const arm = (s) => [[s * 0.07, PY, 0.01], [s * 0.2, PY + 0.015, 0.01], [s * 0.34, PY + 0.07, 0.01], [s * 0.45, PY + 0.15, 0.01]];
  for (const s of [1, -1]) {
    piece(group, taper(arm(s), 0.034, 0.022, 26, 10), m.darkWood);                              // the prod's wooden core
    piece(group, taper(arm(s).map(([x, y, z]) => [x * 0.98, y, z]).slice(0, 3), 0.04, 0.03, 18, 10), m.bronze);   // the bronze sheath over its inner two thirds
  }
  piece(group, rod([-0.45, PY + 0.15, 0.01], [0.45, PY + 0.15, 0.01], 0.0055), m.cord);         // the string, let down
  piece(group, new T.TorusGeometry(0.058, 0.011, 7, 16).rotateX(Math.PI / 2), m.bronze, [0, PY + 0.24, 0.01]);   // the stirrup ring at the muzzle
  piece(group, rod([0, PY + 0.04, 0.01], [0, PY + 0.185, 0.01], 0.012), m.bronze);
  group.userData = { weapon: 'crossbow-v1', hand: 'hand_r', muzzle: [0, PY + 0.15, 0.05], contact: { from: 0.3, to: 0.7 } };
  return group;
}

export const RANGED_BUILDS = { 'staff-v1': staff, 'bow-v1': bow, 'crossbow-v1': crossbow };
