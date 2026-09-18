// Weapons lane. A weapon is a rigid part for the shared rig plus the clips that swing it: pure Three.js geometry under the same
// materials rule as the sword (worn bronze, dark ash, leather — no new textures), attached under hand_r with SwordDrawn's transform
// so its local Y runs along the shaft, and `extras.contact = { from, to }` (metres along Y) marks the striking segment the bake
// samples — the trident's tines, never the shaft. Clips are authored offline on the rig with build-warrior's two-bone reach, as
// Heavy, Riposte and Kick were: the body comes from the CC0 loops (Armed, ArmedWalk, Strafe*, Hit, Death), both arms are re-solved
// onto the shaft every key. Timings are data (src/moves.ts WEAPONS.trident); a clip only fixes where the contact key sits (.34 / .48).
//   build-warrior.mjs, WARRIOR_WEAPON=trident|cleaver [WEAPON_VARIANT=…]   the fighter carries that weapon (and its clips, if it has any)
//   node scripts/build-weapon.mjs <weapon> [variant]                        writes the part alone to src/assets/weapons/<weapon>/<weapon>.glb
// Weapons: the trident (own clip set, two-handed) and the Pitborn's CLEAVER (the longsword's clip family — same length — with its own
// edge-leading Heavy keys; no new clips, so the renderer needs nothing to draw it).
import * as T from 'three';

// Silhouette variants for the owner's pick (2026-09-16): tine length / spread and shaft length. Rig units (the fighter's .9/.97
// scale applies on export). `butt` and `socket` are metres along local Y from the rear hand (y 0 = the rear grip's centre).
// `fore` is the front grip's centre along the shaft (the rear grip is at 0).
export const VARIANTS = {
  A: { name: 'A · balanced: 2.0 m, 0.40 m tines, 0.16 m spread', butt: -.35, fore: .55, socket: 1.15, tines: .40, side: .34, spread: .16 },
  B: { name: 'B · wide fork: 2.0 m, 0.46 m tines, 0.22 m spread', butt: -.35, fore: .55, socket: 1.09, tines: .46, side: .40, spread: .22 },
  C: { name: 'C · long shaft: 2.15 m, 0.30 m tines, 0.13 m spread', butt: -.45, fore: .55, socket: 1.30, tines: .30, side: .26, spread: .13 },
  // The owner's pick (2026-09-16): B's fat, wide fork on a stick 60% as long (shaft 1.44 → 0.86 m; 1.42 m butt to tip), brown shaft.
  short: { name: 'short · owner\'s pick: B\'s wide fork, 60% shaft (1.42 m)', butt: -.20, fore: .40, socket: .66, tines: .46, side: .40, spread: .22 },
};
export const DEFAULT_VARIANT = 'short';

// The trident: ash shaft with a bronze butt cap, two leather grips (rear at the hand, front on the shaft), a bronze socket, a
// crossbar and three tines — the centre one longest, the outer two leaning out. Museum bronze (the Veteran's approved helm
// values: 0.62/0.545/0.415, roughness .63, metalness .80), not the sword's brass furniture, so head and helm read as one metal.
export function trident({ T: three = T, withAoUv = g => g, leather, variant = DEFAULT_VARIANT } = {}) {
  const v = VARIANTS[variant] ?? VARIANTS[DEFAULT_VARIANT];
  const bronze = new three.MeshStandardMaterial({ name: 'TridentBronze', color: new three.Color(0.62, 0.545, 0.415), roughness: .63, metalness: .8 });
  const ash = new three.MeshStandardMaterial({ name: 'Ash', color: '#64452f', roughness: .86 }); // brown oiled ash (owner: "brown shaft" — #3b2d22 read black), no sheen
  const wrap = leather ?? new three.MeshStandardMaterial({ name: 'Leather', color: '#4a3527', roughness: .8 });
  const group = new three.Group(); group.name = 'WeaponDrawn';
  const piece = (geometry, material, y = 0, x = 0, z = 0) => { const mesh = new three.Mesh(withAoUv(geometry), material); mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; group.add(mesh); return mesh; };
  const cyl = (rTop, rBottom, from, to, segments = 12) => new three.CylinderGeometry(rTop, rBottom, to - from, segments).translate(0, (from + to) / 2, 0);
  const crossbar = v.socket + .10, tip = crossbar + v.tines;
  piece(cyl(.019, .019, v.butt, v.butt + .04), bronze);                                   // butt cap
  piece(cyl(.015, .0175, v.butt + .04, v.socket), ash, 0, 0, 0, 10);                        // shaft, tapering to the head
  piece(cyl(.0185, .0185, -.11, .11), wrap);                                                // rear grip (the hand)
  piece(cyl(.0185, .0185, v.fore - .11, v.fore + .11), wrap);                                // front grip
  piece(cyl(.021, .026, v.socket - .02, crossbar), bronze);                                 // socket
  piece(new three.BoxGeometry(v.spread + .04, .026, .026), bronze, crossbar);                // crossbar
  for (const x of [-1, 1]) piece(new three.SphereGeometry(.016, 10, 8), bronze, crossbar, x * (v.spread + .04) / 2);
  const tine = (length, lean, x) => { // a tapered, flattened spike: round at the root, a point at the tip
    const g = new three.CylinderGeometry(.0035, .014, length, 10).translate(0, length / 2, 0).scale(1, 1, .72).rotateZ(lean).translate(x, crossbar, 0);
    return piece(g, bronze);
  };
  tine(v.tines, 0, 0);
  for (const s of [-1, 1]) tine(v.side, -s * .09, s * v.spread / 2);
  group.userData.contact = { from: crossbar, to: tip }; // the striking segment: the head's tines
  group.userData.weapon = 'trident'; group.userData.variant = variant;
  return group;
}

// Clip authoring on the fighter's rig. ctx comes from build-warrior.mjs: { T, base, skeleton, poseMixer, clips, reachArm, weapon }.
// Goals are given in the chest's frame (spine_03: x right, y up, z forward at rest) so the weapon rides the body's own motion —
// the walk's bob, the hit's flinch, the death's fall. Each key: { t, body: [clip, time], r: [x, y, z] rear-hand goal, dir: shaft
// direction, l: the front hand's distance along the shaft, spine: [yaw, pitch] added on top of the body pose }.
export function tridentClips({ T: three = T, base, skeleton, poseMixer, clips, reachArm, weapon }) {
  const bone = name => base.scene.getObjectByName(name);
  const chest = bone('spine_03'), handR = bone('hand_r'), handL = bone('hand_l');
  const play = (name, t) => { const clip = clips.find(c => c.name === name); if (!clip) throw new Error(`build-weapon: the rig has no ${name} clip`); poseMixer.clipAction(clip).play(); poseMixer.setTime(Math.min(t, .999999) * clip.duration); base.scene.updateMatrixWorld(true); };
  const Y = new three.Vector3(0, 1, 0), Z = new three.Vector3(0, 0, 1);
  // The chest's rest orientation: goals turn with the chest's deviation from it — its yaw only for loops and the flinch (the pole stays
  // level while he walks or takes a hit), the full rotation for the death (the pole goes down with him).
  play('Armed', 0); const restChest = chest.getWorldQuaternion(new three.Quaternion());
  // The right hand already holds a pole correctly (the sword's authored grip: shaft along the weapon node, fingers from Sword_Idle).
  // The left hand's grip is that grip mirrored across the vertical plane through the shaft: the same hold, on the other side.
  // Hand frames from their own landmarks — fingers (middle_01) and thumb — so the mirror maps the right hand's frame onto the left's.
  const basisOf = hand => { const e1 = bone(`middle_01_${hand}`).position.clone().normalize(), t = bone(`thumb_01_${hand}`).position.clone(); const e2 = t.addScaledVector(e1, -t.dot(e1)).normalize(); const e3 = e1.clone().cross(e2); if (hand === 'l') e3.negate(); return new three.Matrix4().makeBasis(e1, e2, e3); };
  const Br = basisOf('r'), Bl = basisOf('l'), column = (m, i) => new three.Vector3().setFromMatrixColumn(m, i);
  const shaftR = Y.clone().applyQuaternion(weapon.quaternion), gripR = weapon.position.clone();           // the shaft in hand_r's frame: direction and where it passes
  const palmSign = Math.sign(gripR.dot(column(Br, 2))) || 1;                                             // the shaft lies on the palm side of the wrist: which way that is
  const palmR = column(Br, 2).multiplyScalar(palmSign), palmL = column(Bl, 2).multiplyScalar(palmSign);
  const toLeft = v => v.clone().applyMatrix4(Br.clone().transpose()).applyMatrix4(Bl);                      // right-hand coordinates → the left hand's mirrored frame
  const shaftL = toLeft(shaftR).normalize(), gripL = toLeft(gripR);
  const frameFrom = (u1, u2) => { const a = u1.clone().normalize(), b = u2.clone().addScaledVector(a, -u2.dot(a)).normalize(); return new three.Matrix4().makeBasis(a, b, a.clone().cross(b)); };
  const leftLocal = frameFrom(shaftL, palmL);
  // Fingers: the right hand's curl (Sword_Idle grips) mirrored onto the left. The rig's mirror convention is found, not assumed: the
  // sign pattern whose curled fingertips land furthest on the palm side is the mirror.
  const fingers = ['index', 'middle', 'ring', 'pinky', 'thumb'].flatMap(f => ['01', '02', '03'].map(n => `${f}_${n}`));
  const mirror = [[1, -1, -1, 1], [-1, 1, -1, 1], [-1, -1, 1, 1]].map(pattern => {
    play('Armed', 0); for (const f of fingers) { const q = bone(`${f}_r`).quaternion; bone(`${f}_l`).quaternion.set(q.x * pattern[0], q.y * pattern[1], q.z * pattern[2], q.w * pattern[3]); }
    base.scene.updateMatrixWorld(true); const wrist = handL.getWorldPosition(new three.Vector3()), palm = palmL.clone().applyQuaternion(handL.getWorldQuaternion(new three.Quaternion()));
    const curl = fingers.filter(f => /_03$/.test(f)).reduce((s, f) => s + bone(`${f}_l`).getWorldPosition(new three.Vector3()).sub(wrist).dot(palm), 0);
    poseMixer.stopAllAction(); return { pattern, curl };
  }).sort((a, b) => b.curl - a.curl)[0].pattern;
  function pose({ body, r, dir, l, spine = [0, 0], roll = 0, follow = 'none' }) {
    play(body[0], body[1]);
    if (spine[0]) { bone('pelvis').rotation.y += spine[0] * .35; bone('spine_01').rotation.y += spine[0] * .65; }
    if (spine[1]) bone('spine_02').rotation.x += spine[1];
    base.scene.updateMatrixWorld(true);
    // Goals ride the chest's position in the fighter's own frame (the rig faces +Z; the bladed sword stance twists the chest, so its
    // yaw is no reference). 'full' turns them with the chest as well — the death, where the pole goes down with him.
    const frame = follow === 'full' ? chest.getWorldQuaternion(new three.Quaternion()).multiply(restChest.clone().invert()) : new three.Quaternion();
    const origin = chest.getWorldPosition(new three.Vector3());
    const goal = origin.clone().add(new three.Vector3(...r).applyQuaternion(frame)), shaft = new three.Vector3(...dir).normalize().applyQuaternion(frame);
    reachArm('r', goal); base.scene.updateMatrixWorld(true);
    const orientation = new three.Quaternion().setFromAxisAngle(shaft, roll).multiply(new three.Quaternion().setFromUnitVectors(Y, shaft));
    handR.quaternion.copy(handR.parent.getWorldQuaternion(new three.Quaternion()).invert().multiply(orientation).multiply(weapon.quaternion.clone().invert()));
    base.scene.updateMatrixWorld(true);
    // The left hand: mirror the right's palm normal across the vertical plane through the shaft, orient the hand so its own shaft
    // direction and palm normal meet the shaft and that mirrored normal, then put its grip point on the shaft `l` metres along.
    const palmWorld = palmR.clone().applyQuaternion(handR.getWorldQuaternion(new three.Quaternion()));
    let across = shaft.clone().cross(Y); if (across.length() < .1) across = new three.Vector3(1, 0, 0).applyQuaternion(frame); across.normalize();
    const mirrored = palmWorld.addScaledVector(across, -2 * palmWorld.dot(across));
    const orientL = new three.Quaternion().setFromRotationMatrix(frameFrom(shaft, mirrored).multiply(leftLocal.clone().transpose()));
    reachArm('l', weapon.localToWorld(new three.Vector3(0, l, 0)).sub(gripL.clone().applyQuaternion(orientL))); base.scene.updateMatrixWorld(true);
    handL.quaternion.copy(handL.parent.getWorldQuaternion(new three.Quaternion()).invert().multiply(orientL));
    for (const f of fingers) { const q = bone(`${f}_r`).quaternion; bone(`${f}_l`).quaternion.set(q.x * mirror[0], q.y * mirror[1], q.z * mirror[2], q.w * mirror[3]); }
    base.scene.updateMatrixWorld(true);
    const values = new Map(skeleton.bones.map(b => [b.name, [...b.quaternion.toArray()]])), position = [...bone('pelvis').position.toArray()];
    poseMixer.stopAllAction();
    return { values, position };
  }
  const make = (name, duration, keys) => {
    const times = keys.map(k => k.t), poses = keys.map(pose), positions = poses.flatMap(p => p.position);
    return new three.AnimationClip(name, duration, [new three.VectorKeyframeTrack('pelvis.position', times, positions), ...skeleton.bones.map(b => new three.QuaternionKeyframeTrack(b.name + '.quaternion', times, poses.flatMap(p => p.values.get(b.name))))]);
  };
  // A loop: the body clip sampled at n frames with one constant grip; the last key repeats the first so it joins seamlessly.
  const loop = (name, body, duration, n, grip, wrap = true) => make(name, duration, Array.from({ length: n + 1 }, (_, i) => ({ t: i / n * duration, body: [body, wrap && i === n ? 0 : i / n], ...grip })));
  // The rest grip: rear hand at the right hip, tines forward and a little up at the opponent's chest, front hand a forearm along the shaft.
  // Grips along the shaft (`l`) fit the short trident (front grip at .40; the socket at .66): at full extension the rear hand drives
  // up to the front one, the classic spear thrust, so the tines go as far as the long trident's did.
  const REST = { r: [.26, -.30, .10], dir: [-.10, .18, .97], l: .40, spine: [.12, 0] };
  const GUARD = { r: [.26, -.22, .26], dir: [-.78, .45, .43], l: .46, spine: [-.05, 0] }; // the shaft across the body: a guard of wood
  const out = [
    loop('Trident_Idle', 'Armed', 1.667, 8, REST),
    loop('Trident_Walk', 'ArmedWalk', 1.333, 8, REST),
    loop('Trident_StrafeLeft', 'StrafeLeft', .8, 6, REST),
    loop('Trident_StrafeRight', 'StrafeRight', .8, 6, REST),
    // Thrust: the rear hand drives from behind the hip to the hip, the front arm extends; contact at .34 like the sword's stab, the
    // tines at the opponent's chest (~1.2 m up) from ~1.4 m in front (the sword's stab reaches 1.14).
    make('Trident_Thrust', 1, [
      { t: 0, body: ['Armed', 0], ...REST },
      { t: .18, body: ['Armed', 0], r: [.28, -.30, -.32], dir: [-.03, .13, 1], l: .44, spine: [.22, 0] },
      { t: .34, body: ['Armed', 0], r: [.20, -.12, .44], dir: [0, .06, 1], l: .22, spine: [-.14, .08] },   // the short spear's thrust: the rear arm drives out to full extension, the front hand just ahead of it
      { t: .55, body: ['Armed', 0], r: [.20, -.12, .44], dir: [0, .06, 1], l: .22, spine: [-.14, .08] },
      { t: 1, body: ['Armed', 0], ...REST },
    ]),
    make('Trident_ThrustChain', 1, [ // the second thrust: half withdrawn, out again
      { t: 0, body: ['Armed', 0], r: [.26, -.24, .00], dir: [-.02, .11, 1], l: .34, spine: [.10, 0] },
      { t: .34, body: ['Armed', 0], r: [.20, -.12, .46], dir: [0, .06, 1], l: .22, spine: [-.16, .08] },
      { t: .6, body: ['Armed', 0], r: [.20, -.12, .46], dir: [0, .06, 1], l: .22, spine: [-.16, .08] },
      { t: 1, body: ['Armed', 0], ...REST },
    ]),
    // Low sweep: the tines swing across the front at knee height, right to left; contact in front at .34.
    make('Trident_Sweep', 1, [
      { t: 0, body: ['Armed', 0], ...REST },
      { t: .15, body: ['Armed', 0], r: [.34, -.40, -.10], dir: [.66, -.26, .70], l: .38, spine: [.28, 0] },
      { t: .34, body: ['Armed', 0], r: [.10, -.40, .26], dir: [-.06, -.30, .95], l: .34, spine: [-.04, .06] },
      { t: .5, body: ['Armed', 0], r: [-.10, -.40, .16], dir: [-.60, -.24, .76], l: .36, spine: [-.28, .06] },
      { t: .7, body: ['Armed', 0], r: [.06, -.38, -.02], dir: [-.30, .05, .95], l: .40, spine: [-.12, 0] },
      { t: 1, body: ['Armed', 0], ...REST },
    ]),
    // Overhead pin: raised over the head, driven down into the torso (tines at ~1.0 m from ~1.2 m out); contact at .48 like the sword's heavy.
    make('Trident_High', 1, [
      { t: 0, body: ['Armed', 0], ...REST },
      { t: .28, body: ['Armed', 0], r: [.22, .28, -.30], dir: [-.06, .84, .54], l: .42, spine: [.15, -.08] },
      { t: .48, body: ['Armed', 0], r: [.20, -.04, .12], dir: [0, -.12, .99], l: .40, spine: [-.08, .14] },
      { t: .64, body: ['Armed', 0], r: [.18, -.18, .16], dir: [0, -.24, .97], l: .40, spine: [-.08, .16] },
      { t: 1, body: ['Armed', 0], ...REST },
    ]),
    make('Trident_Guard', 1, [{ t: 0, body: ['Armed', 0], ...REST }, { t: .5, body: ['Armed', 0], ...GUARD }, { t: 1, body: ['Armed', 0], ...GUARD }]),
    // Block impact: the guard takes the blow on the shaft and gives — hands shoved back, chest folds — then settles.
    make('Trident_BlockImpact', 1, [
      { t: 0, body: ['Armed', 0], ...GUARD },
      { t: .12, body: ['Armed', 0], r: [.22, -.24, .10], dir: [-.78, .45, .43], l: .46, spine: [-.05, .08] },
      { t: .35, body: ['Armed', 0], r: [.24, -.23, .16], dir: [-.78, .45, .43], l: .46, spine: [-.05, .05] },
      { t: .65, body: ['Armed', 0], ...GUARD },
      { t: 1, body: ['Armed', 0], ...GUARD },
    ]),
    // Deflected: the thrust is turned aside — tines knocked out to the right and up, the line lost — then the rest grip again.
    make('Trident_Deflected', 1, [
      { t: 0, body: ['Armed', 0], r: [.20, -.12, .44], dir: [0, .06, 1], l: .22, spine: [-.14, .08] },
      { t: .12, body: ['Armed', 0], r: [.28, -.20, .16], dir: [.48, .28, .83], l: .30, spine: [.10, 0] },
      { t: .35, body: ['Armed', 0], r: [.34, -.16, -.06], dir: [.62, .36, .70], l: .36, spine: [.24, -.04] },
      { t: .65, body: ['Armed', 0], r: [.26, -.30, -.02], dir: [.20, .20, .96], l: .40, spine: [.16, 0] },
      { t: 1, body: ['Armed', 0], ...REST },
    ]),
    loop('Trident_Hit', 'Hit', .333, 4, REST, false),                        // the flinch keeps the pole level (yaw only)
    loop('Trident_Death', 'Death', 2.4, 10, { ...REST, follow: 'full' }, false), // the pole goes down with him
  ];
  return out;
}

// ── The cleaver (the Pitborn's, owner 2026-09-16: "a fat scythe-type cleaver, wider and the same length as the longsword").
// Single-edged: the EDGE is on local +x — the side that leads the sword's forehand cut (measured from the bake: the Attack's tip
// moves along the node's +x at contact, the Return along −x). So the forehand chops with the edge, the backhand hits with the
// spine (a cleaver's back is a hammer: its own move, see moves.ts), and the overhead is re-keyed as a diagonal hack (CLEAVER_KEYS)
// because the sword's straight overhead comes down with the flat. Same length as the sword: blade .10–.86 along Y.
export const CLEAVER_VARIANTS = {
  // A blade is a centreline c(t) (its forward sweep toward the edge side, +x) with a width envelope w(t) split 60/40 edge/spine, closing
  // to a point at the tip. t 0 = root (at the ferrule), 1 = tip. The edge sits on the INSIDE of the bend: a scythe / falx, not a falchion.
  A: { name: 'A · fat scythe: 0.19 m belly out near the tip, hooked', c: t => .20 * t ** 2.2, w: t => t <= .72 ? .045 + .145 * (t / .72) ** 1.6 : .19 * (1 - (t - .72) / .28) ** .75, split: .58 },
  B: { name: 'B · broad chopper: 0.17 m, slight bend, square-cut tip', c: t => .06 * t ** 2, w: t => t < .94 ? .05 + .12 * Math.min(1, t / .45) : .17 * (1 - t) / .06, split: 1 },
  C: { name: 'C · long sickle: 0.14 m, mass at the tip, 0.28 m bend', c: t => .28 * t ** 2, w: t => t <= .78 ? .04 + .10 * (t / .78) ** 1.8 : .14 * (1 - (t - .78) / .22) ** .8, split: .6 },
};
export const CLEAVER_DEFAULT = 'A';
export function cleaver({ T: three = T, withAoUv = g => g, variant = CLEAVER_DEFAULT } = {}) {
  const v = CLEAVER_VARIANTS[variant] ?? CLEAVER_VARIANTS[CLEAVER_DEFAULT];
  const iron = new three.MeshStandardMaterial({ name: 'CleaverIron', color: '#4c4946', metalness: .85, roughness: .62 }); // pitted, oiled iron: darker and rougher than the sword's steel, still lights
  const haft = new three.MeshStandardMaterial({ name: 'Haft', color: '#4a3220', roughness: .9 });                            // dark wood grip
  const group = new three.Group(); group.name = 'WeaponDrawn';
  const piece = (geometry, material, y = 0, x = 0, z = 0) => { const mesh = new three.Mesh(withAoUv(geometry), material); mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; group.add(mesh); return mesh; };
  // The blade: a loft of wedge rings — sharp on the edge side, a thick spine — along a bent centreline, closing to a point at the tip.
  const y0 = .10, y1 = .86, segments = 26, positions = [], uvs = [];
  const ring = i => {
    const t = i / segments, y = y0 + t * (y1 - y0), th = .014 * (1 - .5 * t), c = v.c(t), w = v.w(t), e = c + v.split * w, sp = c - (1 - v.split) * w, mid = sp + .3 * (e - sp);
    if (i === segments) return Array.from({ length: 5 }, () => [c, y, 0]);
    return [[e, y, 0], [mid, y, th * .5], [sp, y, th * .35], [sp, y, -th * .35], [mid, y, -th * .5]];
  };
  for (let i = 0; i < segments; i++) {
    const a = ring(i), b = ring(i + 1);
    for (let k = 0; k < 5; k++) { const n = (k + 1) % 5; for (const [p, u, w] of [[a[k], k, i], [a[n], k + 1, i], [b[n], k + 1, i + 1], [a[k], k, i], [b[n], k + 1, i + 1], [b[k], k, i + 1]]) { positions.push(...p); uvs.push(u / 5, w / segments); } }
  }
  const root = ring(0); for (let k = 1; k < 4; k++) for (const [p, u] of [[root[0], 0], [root[k + 1], k + 1], [root[k], k]]) { positions.push(...p); uvs.push(u / 5, 0); } // the root cap
  const g = new three.BufferGeometry(); g.setAttribute('position', new three.Float32BufferAttribute(positions, 3)); g.setAttribute('uv', new three.Float32BufferAttribute(uvs, 2)); g.computeVertexNormals();
  piece(g, iron);
  const cyl = (rTop, rBottom, from, to, seg = 10) => new three.CylinderGeometry(rTop, rBottom, to - from, seg).translate(0, (from + to) / 2, 0);
  piece(cyl(.021, .021, .07, .115, 12), iron);                       // ferrule at the blade's root
  piece(cyl(.016, .0175, -.11, .075), haft);                         // the grip
  piece(cyl(.020, .020, -.125, -.105, 12), iron);                    // butt cap
  for (const y of [-.06, .0, .05]) for (const z of [-1, 1]) piece(new three.SphereGeometry(.006, 6, 4), iron, y, 0, z * .017); // rivets through the grip
  group.userData.contact = { from: .14, to: y1 };                    // the edge, ferrule to tip (the sim sweeps the node's axis: the bend is presentation)
  group.userData.weapon = 'cleaver'; group.userData.variant = variant;
  return group;
}
// The cleaver's Heavy on the sword's authored-key grammar ([phase, hand position, blade direction], build-warrior.mjs): a diagonal
// hack from high on the fighter's off side, across and down through the front, so the motion at contact runs along the blade's
// width axis and the EDGE leads (the sword's straight overhead moves along its thickness axis: the flat leads). Contact key at
// .48 like the sword's Heavy. Its riposte / counter / critical ride the same clip.
export const CLEAVER_KEYS = {
  Heavy: [[0, [.18, 1.3, .3], [0, 0, 1]], [.28, [-.30, 1.72, .02], [-.42, .78, .46]], [.48, [.02, 1.22, .42], [.10, -.08, .99]], [.64, [.30, .96, .34], [.62, -.55, .56]], [1, [.18, 1.3, .3], [0, 0, 1]]],
};

// ── The knife (the goblin's, owner's brief 2026-09-16: "a short hooked knife"). Built like the cleaver — the sword's clip family on the
// goblin's own re-proportioned rig, a single-edged loft with the edge on local +x — but SHORT: rig units are scaled ×0.81 in his hand
// (BUILD.goblin root .835 × his arm bones), so a .52 blade is a 0.42 m blade in the world. The hook is double-edged over its last third
// (the outer curve sharpened) so the backhand slash (the sword's Return, spine-leading) still cuts: a rip with the hook's back.
// Variants for the owner: A the sica (forward grip, inward hook — the Thracian gladiator's knife), B the reverse-grip hook (the character
// lane's suggestion: the sword's transform turned 180° so the blade runs back along the forearm; the contact then sits behind the fist),
// C a straight long knife (a seax). Contact = the blade from the ferrule to the tip.
export const KNIFE_VARIANTS = {
  A: { name: 'A · sica: 0.42 m, inward hook, forward grip', grip: 'forward', y1: .52, c: t => .12 * t ** 2, w: t => t < .8 ? .028 + .022 * Math.sin(Math.PI * Math.min(t / .8, 1)) : .05 * (1 - (t - .8) / .2) ** .8, split: .62 },
  B: { name: 'B · reverse-grip hook: 0.30 m, strong hook, blade along the forearm', grip: 'reverse', y1: .38, c: t => .14 * t ** 1.8, w: t => t < .75 ? .03 + .02 * Math.sin(Math.PI * Math.min(t / .75, 1)) : .05 * (1 - (t - .75) / .25) ** .8, split: .62 },
  C: { name: 'C · long knife: 0.46 m, straight, clipped point', grip: 'forward', y1: .58, c: t => .02 * t ** 2, w: t => t < .85 ? .03 + .012 * Math.min(t / .3, 1) : .042 * (1 - (t - .85) / .15), split: .6 },
};
export const KNIFE_DEFAULT = 'A';
export function knife({ T: three = T, withAoUv = g => g, variant = KNIFE_DEFAULT } = {}) {
  const v = KNIFE_VARIANTS[variant] ?? KNIFE_VARIANTS[KNIFE_DEFAULT];
  const iron = new three.MeshStandardMaterial({ name: 'KnifeIron', color: '#57534d', metalness: .8, roughness: .6 });   // scavenged iron, dull
  const haft = new three.MeshStandardMaterial({ name: 'Haft', color: '#3f2d1f', roughness: .92 });                       // greasy dark wood
  const cord = new three.MeshStandardMaterial({ name: 'Cord', color: '#6b5a44', roughness: .95 });                       // string wrap
  const group = new three.Group(); group.name = 'WeaponDrawn';
  const piece = (geometry, material, y = 0, x = 0, z = 0) => { const mesh = new three.Mesh(withAoUv(geometry), material); mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; group.add(mesh); return mesh; };
  const y0 = .09, y1 = v.y1, segments = 22, positions = [], uvs = [];
  const ring = i => {
    const t = i / segments, y = y0 + t * (y1 - y0), th = .007 * (1 - .5 * t), c = v.c(t), w = v.w(t), e = c + v.split * w, sp = c - (1 - v.split) * w, mid = sp + .3 * (e - sp);
    if (i === segments) return Array.from({ length: 5 }, () => [c, y, 0]);
    const sharpBack = t > .66 ? Math.min(1, (t - .66) / .2) : 0;   // the hook's outer curve thins to an edge over the last third: double-edged tip
    return [[e, y, 0], [mid, y, th * .5], [sp, y, th * .35 * (1 - sharpBack)], [sp, y, -th * .35 * (1 - sharpBack)], [mid, y, -th * .5]];
  };
  for (let i = 0; i < segments; i++) {
    const a = ring(i), b = ring(i + 1);
    for (let k = 0; k < 5; k++) { const n = (k + 1) % 5; for (const [p, u, w] of [[a[k], k, i], [a[n], k + 1, i], [b[n], k + 1, i + 1], [a[k], k, i], [b[n], k + 1, i + 1], [b[k], k, i + 1]]) { positions.push(...p); uvs.push(u / 5, w / segments); } }
  }
  const root = ring(0); for (let k = 1; k < 4; k++) for (const [p, u] of [[root[0], 0], [root[k + 1], k + 1], [root[k], k]]) { positions.push(...p); uvs.push(u / 5, 0); }
  const g = new three.BufferGeometry(); g.setAttribute('position', new three.Float32BufferAttribute(positions, 3)); g.setAttribute('uv', new three.Float32BufferAttribute(uvs, 2)); g.computeVertexNormals();
  piece(g, iron);
  const cyl = (rTop, rBottom, from, to, seg = 10) => new three.CylinderGeometry(rTop, rBottom, to - from, seg).translate(0, (from + to) / 2, 0);
  piece(cyl(.016, .016, .065, .095, 10), iron);                      // ferrule
  piece(cyl(.013, .0145, -.10, .07), haft);                          // grip
  for (let i = 0; i < 5; i++) piece(new three.TorusGeometry(.0145, .0025, 5, 12).rotateX(Math.PI / 2), cord, -.07 + i * .028);   // cord wrap
  piece(cyl(.015, .015, -.115, -.10, 10), iron);                     // butt cap
  group.userData.contact = { from: .12, to: y1 };
  group.userData.weapon = 'knife'; group.userData.variant = variant; group.userData.grip = v.grip;
  return group;
}

// ── The estoc (the Nightborn's; his brief §"Weapon: estoc"): a long, thin, thrust-first blade — a stiff square-section rod drawn to
// a point, no cutting edge — a black iron guard, a wire grip, a faceted pommel. The sword's clip family, NOT re-keyed: every clip is the
// Nightborn's own (his parity test holds), only the node under hand_r changes. Contact = the last 40 cm (the point is all that matters;
// a "cut" with an estoc is a whack with a rod, and the data prices it so). Variants for the owner: A the estoc (1.05 m blade, straight
// cross + a side ring), B the rapier cut (0.95 m, swept ring guard), C the long tuck (1.15 m, plain long cross).
export const ESTOC_VARIANTS = {
  A: { name: 'A · estoc: 1.05 m blade, straight cross + side ring', y1: 1.15, cross: .22, ring: .026, width: .020 },
  B: { name: 'B · rapier cut: 0.95 m blade, swept ring guard', y1: 1.05, cross: .16, ring: .040, width: .018 },
  C: { name: 'C · long tuck: 1.15 m blade, plain long cross', y1: 1.25, cross: .26, ring: 0, width: .022 },
};
export const ESTOC_DEFAULT = 'A';
export function estoc({ T: three = T, withAoUv = g => g, variant = ESTOC_DEFAULT } = {}) {
  const v = ESTOC_VARIANTS[variant] ?? ESTOC_VARIANTS[ESTOC_DEFAULT];
  const steel = new three.MeshStandardMaterial({ name: 'EstocSteel', color: '#b4b8bc', metalness: .9, roughness: .34 });   // bright, a straight pale line at 3 m; roughness keeps it from chroming
  const black = new three.MeshStandardMaterial({ name: 'BlackIron', color: '#1d1c1f', metalness: .8, roughness: .62 });     // black-oiled iron furniture, his kit's tone
  const wire = new three.MeshStandardMaterial({ name: 'Wire', color: '#6e7074', metalness: .75, roughness: .5 });           // twisted steel wire over the grip
  const group = new three.Group(); group.name = 'WeaponDrawn';
  const piece = (geometry, material, y = 0, x = 0, z = 0) => { const mesh = new three.Mesh(withAoUv(geometry), material); mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; group.add(mesh); return mesh; };
  // The blade: a square-section rod (a diamond ring of four points, equal width and thickness — no edge) tapering to the point.
  const y0 = .10, y1 = v.y1, segments = 16, positions = [], uvs = [];
  const ring = i => { const t = i / segments, y = y0 + t * (y1 - y0), w = i === segments ? 0 : v.width * (1 - .78 * t) / 2; return [[w, y, 0], [0, y, w], [-w, y, 0], [0, y, -w]]; };
  for (let i = 0; i < segments; i++) {
    const a = ring(i), b = ring(i + 1);
    for (let k = 0; k < 4; k++) { const n = (k + 1) % 4; for (const [p, u, w] of [[a[k], k, i], [a[n], k + 1, i], [b[n], k + 1, i + 1], [a[k], k, i], [b[n], k + 1, i + 1], [b[k], k, i + 1]]) { positions.push(...p); uvs.push(u / 4, w / segments); } }
  }
  const g = new three.BufferGeometry(); g.setAttribute('position', new three.Float32BufferAttribute(positions, 3)); g.setAttribute('uv', new three.Float32BufferAttribute(uvs, 2)); g.computeVertexNormals();
  piece(g, steel);
  const cyl = (rTop, rBottom, from, to, seg = 10) => new three.CylinderGeometry(rTop, rBottom, to - from, seg).translate(0, (from + to) / 2, 0);
  piece(new three.BoxGeometry(v.cross, .014, .014), black, .098);                                        // the straight cross
  for (const x of [-1, 1]) piece(new three.SphereGeometry(.011, 8, 6), black, .098, x * v.cross / 2);      // its finials
  if (v.ring) piece(new three.TorusGeometry(v.ring, .0045, 6, 20).rotateY(Math.PI / 2), black, .098 - v.ring - .004, 0, .006);   // a side ring under the cross (the duelist's finger guard)
  piece(cyl(.012, .013, .088, .105, 10), black);                                                            // the guard's block
  piece(cyl(.011, .012, -.11, .088), wire);                                                                // the grip core
  for (let i = 0; i < 10; i++) piece(new three.TorusGeometry(.0125, .0018, 3, 10).rotateX(Math.PI / 2), wire, -.10 + i * .019);   // the wire's turns (the brief's ≤ 2k tris: ten turns, not fourteen)
  piece(new three.CylinderGeometry(.017, .013, .026, 8).translate(0, -.123, 0), black);                    // faceted pommel
  group.userData.contact = { from: +(y1 - .40).toFixed(3), to: y1 };                                       // the last 40 cm: the point
  group.userData.weapon = 'estoc'; group.userData.variant = variant;
  return group;
}

// ── The scythe (the Executioner's; owner 2026-09-18: "a scythe or axe" — the scythe, weapons-lane recommendation accepted: the edge-arc,
// zero-thrust grammar nobody owns; the axe is the cleaver's fight and the Northman's planned identity). A war scythe: a long haft, and at
// its top a blade mounted TRANSVERSE — it runs along local +x, swept forward (+z), the edge on the concave (+z) side like the cleaver's
// bend (the edge leads or trails per the reap keys, task 3; the cleaver lesson: measured from the bake, not assumed). No point anywhere:
// it cannot thrust. CONTACT WRINKLE (frozen contract: one segment along local Y): the blade is off-axis, so extras.contact marks the
// HEAD — the arc the haft's top traces is what the bake samples and what the data's reach prices; the blade's inner half is the surface
// that connects, the tip overhangs past the target by design (a real reap). The Stab button: the short hooking heel-jab, contact at the
// head (the handover brief's proposal, combat lead's nod pending — REQUESTS.md). Mesh-only on the sword's clip family for the variant
// picks (this entry); the own clip family lands with task 3.
export const SCYTHE_VARIANTS = {
  A: { name: 'A · war scythe: 1.55 m haft, 0.60 m swept blade (2.15 m butt to tip)', butt: -.45, fore: .55, head: 1.55, blade: .60, sweep: .20, belly: .16, split: .58 },
  B: { name: 'B · executioner\'s tool: 1.32 m haft, 0.74 m heavy blade, mass in the head', butt: -.40, fore: .50, head: 1.32, blade: .74, sweep: .16, belly: .20, split: .58 },
  C: { name: 'C · garden-tooled: 1.15 m haft, 0.45 m small crescent (the readability floor)', butt: -.35, fore: .45, head: 1.15, blade: .45, sweep: .26, belly: .12, split: .6 },
};
export const SCYTHE_DEFAULT = 'A';
export function scythe({ T: three = T, withAoUv = g => g, leather, variant = SCYTHE_DEFAULT } = {}) {
  const v = SCYTHE_VARIANTS[variant] ?? SCYTHE_VARIANTS[SCYTHE_DEFAULT];
  const iron = new three.MeshStandardMaterial({ name: 'ScytheIron', color: '#4c4946', metalness: .85, roughness: .62 });   // pitted black-oiled iron, the cleaver's values: his kit's blackened metal, still lights
  const haft = new three.MeshStandardMaterial({ name: 'Haft', color: '#3a2a1c', roughness: .9 });                            // dark oiled wood
  const wrap = leather ?? new three.MeshStandardMaterial({ name: 'Leather', color: '#4a3527', roughness: .8 });
  const group = new three.Group(); group.name = 'WeaponDrawn';
  const piece = (geometry, material, y = 0, x = 0, z = 0) => { const mesh = new three.Mesh(withAoUv(geometry), material); mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; group.add(mesh); return mesh; };
  const cyl = (rTop, rBottom, from, to, segments = 12) => new three.CylinderGeometry(rTop, rBottom, to - from, segments).translate(0, (from + to) / 2, 0);
  const H = v.head;
  piece(cyl(.021, .023, v.butt, v.butt + .05), iron);                      // butt cap
  piece(cyl(.016, .0195, v.butt + .05, H - .10), haft, 0, 0, 0, 10);       // the haft, tapering to the head
  piece(cyl(.0195, .0195, -.11, .11), wrap);                               // rear grip (the hand)
  piece(cyl(.0195, .0195, v.fore - .11, v.fore + .11), wrap);              // front grip
  piece(cyl(.021, .026, H - .12, H + .01), iron);                          // the socket the blade is mounted in
  // The blade: a loft of wedge rings in the horizontal plane at the head — centreline along +x, swept toward +z, edge on the concave
  // (+z) side, closing to a point at the tip. Ring layout mirrors the cleaver's, thickness vertical (+y) instead of the blade plane.
  const x0 = .02, segments = 24, positions = [], uvs = [];
  const ring = i => {
    const t = i / segments, x = x0 + t * v.blade, zc = v.sweep * t ** 1.8, th = .016 * (1 - .5 * t);
    const w = t <= .72 ? .035 + v.belly * (t / .72) ** 1.6 : (.035 + v.belly) * (1 - (t - .72) / .28) ** .75;
    const e = zc + v.split * w, sp = zc - (1 - v.split) * w, mid = sp + .3 * (e - sp);
    if (i === segments) return Array.from({ length: 5 }, () => [x, H, zc + .02]);
    return [[x, H, e], [x, H + th * .5, mid], [x, H + th * .35, sp], [x, H - th * .35, sp], [x, H - th * .5, mid]];
  };
  for (let i = 0; i < segments; i++) {
    const a = ring(i), b = ring(i + 1);
    for (let k = 0; k < 5; k++) { const n = (k + 1) % 5; for (const [p, u, w] of [[a[k], k, i], [a[n], k + 1, i], [b[n], k + 1, i + 1], [a[k], k, i], [b[n], k + 1, i + 1], [b[k], k, i + 1]]) { positions.push(...p); uvs.push(u / 5, w / segments); } }
  }
  const root = ring(0); for (let k = 1; k < 4; k++) for (const [p, u] of [[root[0], 0], [root[k + 1], k + 1], [root[k], k]]) { positions.push(...p); uvs.push(u / 5, 0); } // the root cap
  const g = new three.BufferGeometry(); g.setAttribute('position', new three.Float32BufferAttribute(positions, 3)); g.setAttribute('uv', new three.Float32BufferAttribute(uvs, 2)); g.computeVertexNormals();
  piece(g, iron);
  piece(new three.BoxGeometry(.16, .05, .05), iron, H, .06, .01);         // the mounting strap: blade root to socket
  group.userData.contact = { from: +(H - .10).toFixed(3), to: H };       // the head: the arc's radius the sim prices (see the header note)
  group.userData.weapon = 'scythe'; group.userData.variant = variant;
  return group;
}

// What build-warrior.mjs needs per weapon: the part, the clips it adds (if any) and the sword-clip keys it re-authors on its rig.
export const WEAPON_BUILDS = {
  trident: { part: trident, clips: tridentClips, keys: {} },
  cleaver: { part: cleaver, clips: null, keys: CLEAVER_KEYS },
  knife: { part: knife, clips: null, keys: CLEAVER_KEYS },   // the same diagonal Heavy: a knife's overhead is a hack too, edge-leading
  estoc: { part: estoc, clips: null, keys: {} },              // no re-key: an estoc has no edge to lead with; every clip stays the Nightborn's own
  scythe: { part: scythe, clips: null, keys: {} },            // mesh-only for the variant picks; the own clip family (task 3) replaces the sword family
};

// Standalone: the part alone (no rig), for the record and the harness turntable.
if (process.argv[1] && /build-weapon\.mjs$/.test(process.argv[1])) {
  const fs = await import('node:fs/promises');
  const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');
  globalThis.FileReader ??= class { async readAsArrayBuffer(blob) { this.result = await blob.arrayBuffer(); this.onloadend?.(); } async readAsDataURL(blob) { this.result = `data:${blob.type};base64,${Buffer.from(await blob.arrayBuffer()).toString('base64')}`; this.onloadend?.(); } };
  const weapon = WEAPON_BUILDS[process.argv[2]] ? process.argv[2] : 'trident', variant = process.argv[WEAPON_BUILDS[process.argv[2]] ? 3 : 2] || ({ cleaver: CLEAVER_DEFAULT, knife: KNIFE_DEFAULT, estoc: ESTOC_DEFAULT, scythe: SCYTHE_DEFAULT }[weapon] ?? DEFAULT_VARIANT);
  const scene = new T.Scene(), part = WEAPON_BUILDS[weapon].part({ variant }); scene.add(part);
  const glb = await new GLTFExporter().parseAsync(scene, { binary: true });
  const out = process.env.WEAPON_OUT || `src/assets/weapons/${weapon}/${weapon}.glb`;
  await fs.mkdir(out.replace(/\/[^/]+$/, ''), { recursive: true }); await fs.writeFile(out, Buffer.from(glb));
  let triangles = 0; part.traverse(o => { if (o.isMesh) triangles += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; });
  const names = { cleaver: CLEAVER_VARIANTS, knife: KNIFE_VARIANTS, estoc: ESTOC_VARIANTS, scythe: SCYTHE_VARIANTS }[weapon] ?? VARIANTS;
  console.log(`${weapon} ${variant} → ${out}: ${glb.byteLength} bytes, ${triangles} triangles, contact ${part.userData.contact.from.toFixed(2)}–${part.userData.contact.to.toFixed(2)} m (${names[variant].name})`);
}
