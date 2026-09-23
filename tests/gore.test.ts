import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Bone, BoxGeometry, Color, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, Object3D, PlaneGeometry, Scene, Skeleton, SkinnedMesh, Uint16BufferAttribute, Vector3 } from 'three';
import { createBladeBlood, createBodyWounds, createSplatPool, createWoundDecals, woundSite, woundSeed, lcg, surfaceHit, clampRadius, DRIP, DRY, WOUND_THRESHOLD, WOUNDS_PER_FIGHTER, WOUND_ART, WOUND_SIZE } from '../src/gore.ts';
import { OPPONENTS } from '../src/moves.ts';

const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps;

test('splat pool: a splash lives 20 s at the struck fighter, fades over its last 4 s, and the pool of twelve wraps', () => {
  const scene = new Scene(), pool = createSplatPool(scene, null);
  assert.equal(pool.entries.length, 12);
  assert.equal(scene.children.length, 12, 'every splat is in the scene, hidden');
  assert.ok(pool.entries.every(s => !s.mesh.visible));
  pool.splash({ x: 2, z: -1 }, 'red');
  const s = pool.entries[0];   // first draw is index 0; the counter reads 1 after it
  assert.equal(s.life, 20);
  assert.deepEqual(s.mesh.position.toArray().map(v => +v.toFixed(6)), [2, +(0.022 + 0.0001).toFixed(6), -1]);
  assert.ok(near(s.mesh.scale.x, 0.22 + 0.05) && near(s.mesh.scale.y, 0.13 + 0.035), 'size varies with the counter');
  assert.ok(near(s.mesh.rotation.z, 2.4));
  assert.equal(s.mesh.material.color.getHexString(), new Color('#681a19').getHexString());
  pool.update(1 / 60);
  assert.ok(s.mesh.visible && near(s.mesh.material.opacity, 0.65), 'full opacity while young');
  s.life = 2; pool.update(0);
  assert.ok(near(s.mesh.material.opacity, 0.5), 'fades over the last four seconds');
  pool.clear(false);
  assert.ok(s.mesh.visible, 'a rematch clear leaves visibility to the next update');
  pool.update(0);
  assert.ok(!s.mesh.visible);
  pool.splash({ x: 0, z: 0 }, 'dark');
  assert.equal(pool.entries[1].mesh.material.color.getHexString(), new Color('#352426').getHexString(), 'dark blood tone');
  pool.clear(true);
  assert.ok(pool.entries.every(x => !x.mesh.visible && x.life === 0), 'a blood-mode change hides at once');
  for (let i = 0; i < 12; i++) pool.splash({ x: i, z: 0 }, 'red');
  assert.equal(pool.entries[1].mesh.position.x, 11, 'the thirteenth splash reuses slot 1 (the counter was at 2)');
});

test('splat pool: the kill pool spreads over 2.2 s to 1.0 × 0.6 at 0.7 opacity and never fades', () => {
  const pool = createSplatPool(new Scene(), null);
  pool.pool({ x: 1, z: 1 }, 'red');
  const p = pool.entries[0];
  assert.equal(p.life, 1e9); assert.equal(p.mesh.position.y, 0.03);
  assert.deepEqual(p.mesh.scale.toArray().map(v => +v.toFixed(6)), [0.3, 0.2, 1]);
  pool.update(1.1);
  assert.ok(near(p.grow, 0.5 + 1e-6, 1e-9), "grow starts at 1e-6 and adds dt / 2.2");
  assert.ok(near(p.mesh.scale.x, 0.3 + 0.35, 1e-6) && near(p.mesh.scale.y, (0.2 + 0.275) * 0.8, 1e-6) && near(p.mesh.material.opacity, 0.35, 1e-6));
  for (let i = 0; i < 200; i++) pool.update(1 / 60);
  assert.equal(p.grow, 1);
  assert.ok(near(p.mesh.scale.x, 1) && near(p.mesh.scale.y, 0.6) && near(p.mesh.material.opacity, 0.7) && p.mesh.visible, 'fully spread and still there');
});

test('wound decals: no standing combat mark any more — the pool exists only for the throat cut, fades over its last second, hides in off, clears on rematch', () => {
  const scene = new Scene(), wounds = createWoundDecals(scene, null);
  assert.equal(wounds.entries.length, 2);
  assert.deepEqual(scene.children.map(c => c.name), ['Wound_0', 'Wound_1']);
  assert.ok(!('arm' in wounds) && !('hide' in wounds), 'the flesh-hit mark API is gone (owner 2026-09-21)');
  wounds.update(0.5, 'red');
  assert.ok(wounds.entries.every(w => !w.group.visible && w.life === 0), 'nothing shows without a throat cut');
  const neck = new Vector3(0, 1.5, 0), head = new Vector3(0, 1.65, 0), w = wounds.entries[1];
  wounds.throatCut(neck, head, 0, 1, 'red');
  assert.ok(w.group.visible && near(w.mark.material.opacity, 0.82) && near(w.life, 4));
  wounds.update(3.5, 'red');
  assert.ok(w.group.visible && near(w.life, 0.5) && near(w.mark.material.opacity, 0.82 * 0.5) && near(w.drips[0].material.opacity, 0.6 * 0.5), 'fades over the last second');
  wounds.update(0, 'off'); assert.ok(!w.group.visible && w.life > 0, 'off hides but keeps the window running');
  wounds.update(0.6, 'red'); assert.equal(w.life, 0); assert.ok(!w.group.visible, 'the window ran out');
  wounds.throatCut(neck, head, 0, 1, 'red'); wounds.clear(); wounds.update(0, 'red');
  assert.equal(w.life, 0); assert.ok(!w.group.visible, 'a rematch clears the mark');
});

test('wound decals: the Quiet One throat cut sits the mark on the neck, sized to the neck–head span, drips opening over the first quarter second', () => {
  const wounds = createWoundDecals(new Scene(), null);
  const neck = new Vector3(0, 1.5, 0), head = new Vector3(0, 1.65, 0);   // 0.15 m apart: size 2
  wounds.throatCut(neck, head, 0, 0.1, 'red');
  const w = wounds.entries[1];
  assert.equal(w.life, 4);
  assert.deepEqual(w.group.position.toArray().map(v => +v.toFixed(9)), [0, 1.5, 0.15], 'neck + forward × 0.075 × size');
  assert.ok(near(w.mark.scale.x, 1.7) && near(w.mark.scale.y, 0.28));
  assert.ok(near(w.mark.material.opacity, 0.82));
  assert.equal(w.mark.material.color.getHexString(), new Color('#581017').getHexString());
  assert.ok(near(w.drips[0].material.opacity, 0.6 * 0.4) && near(w.drips[2].position.x, 0.05) && near(w.drips[0].scale.y, 1));
  assert.ok(w.group.visible);
  wounds.throatCut(neck, head, 0, 1, 'off');
  assert.ok(!w.group.visible && near(w.drips[0].material.opacity, 0.6), 'off: hidden; drips fully open after 0.25 s');
});

function rigs() {
  const blade = (name: string) => new Mesh(new PlaneGeometry(), Object.assign(new MeshStandardMaterial({ color: '#ffffff' }), { name }));
  const player = new Group(), sword = new Object3D(); sword.name = 'SwordDrawn'; player.add(sword);
  const edge = blade('Blade'), haft = blade('Handle'); sword.add(edge, haft);
  const opponent = new Group(), weapon = new Object3D(); weapon.name = 'WeaponDrawn'; opponent.add(weapon);
  const twoHanded = blade('Blade'); weapon.add(twoHanded);
  return { warriors: { player: { anchor: player }, opponent: { anchor: opponent } }, edge, haft, twoHanded };
}

test('blade blood: tints only the blade of the given side from its original colour, never compounds, restores on off, and waits for rigs', () => {
  const { warriors, edge, haft, twoHanded } = rigs(), blood = createBladeBlood();
  const original = edge.material;
  blood.set(true, null, 'red', 0);
  assert.equal(blood.bloodied, false, 'no rigs yet: nothing tints and the flag stays off');
  blood.set(true, warriors, 'red', 0);
  assert.ok(blood.bloodied);
  assert.notEqual(edge.material, original, 'the blade material is cloned before tinting');
  assert.equal(edge.material.color.getHexString(), new Color('#ffffff').lerp(new Color('#7a1410'), 0.55).getHexString());
  assert.equal(haft.material.color.getHexString(), 'ffffff', 'the haft is never tinted');
  assert.equal(twoHanded.material.color.getHexString(), 'ffffff', 'the other side is untouched');
  blood.set(true, warriors, 'dark');   // a blood-mode retint keeps the side and starts from the original, not the red tint
  assert.equal(edge.material.color.getHexString(), new Color('#ffffff').lerp(new Color('#2a1516'), 0.55).getHexString());
  blood.set(false, warriors, 'dark');
  assert.equal(edge.material, original, 'off restores the original material object');
  assert.equal(blood.bloodied, false);
  const broad = twoHanded.material; broad.metalness = 0.9; broad.roughness = 0.4;
  blood.set(true, warriors, 'red', 1);
  // A broad hafted blade is a metallic mirror: it takes the dark film (owner, 2026-09-21: the scythe crescent rendered bright red).
  assert.equal(twoHanded.material.color.getHexString(), new Color('#ffffff').lerp(new Color('#2a1516'), 0.55).getHexString(), 'side 1: the two-handed weapon takes the dark film, never the red mirror');
  assert.equal(twoHanded.material.metalness, 0.3, 'the film stops the blade mirroring the sky');
  assert.equal(twoHanded.material.roughness, 0.7);
  assert.equal(edge.material, original);
  blood.set(false, warriors, 'red');
  assert.equal(twoHanded.material, broad, 'off restores the original two-handed material, metalness intact');
  assert.equal(twoHanded.material.metalness, 0.9);
});


test('woundSite: a right cut lands on the victim\'s left flank, a left cut his right, an overhead his shoulder line, a thrust his front; legs mirror the same side', () => {
  const torsoRight = woundSite({ location: 'torso', direction: 'right' });
  assert.equal(torsoRight.bone, 'spine_02');
  assert.ok(torsoRight.dir[0] > 0, 'a right cut crosses to the victim\'s own left (+x in his frame)');
  const torsoLeft = woundSite({ location: 'torso', direction: 'left' });
  assert.equal(torsoLeft.bone, 'spine_02');
  assert.ok(torsoLeft.dir[0] < 0);
  const overhead = woundSite({ location: 'torso', direction: 'overhead' });
  assert.equal(overhead.bone, 'spine_03', 'the shoulder line, not the belly');
  const thrust = woundSite({ location: 'torso', direction: 'thrust' });
  assert.deepEqual(thrust.dir, [0, 0, 1], 'straight on the front, no side bias');
  const headRight = woundSite({ location: 'head', direction: 'right' });
  assert.equal(headRight.bone, 'Head');
  assert.ok(headRight.dir[0] > 0);
  const legsRight = woundSite({ location: 'legs', direction: 'right' });
  assert.equal(legsRight.bone, 'thigh_l', 'a right-hand cut crosses to the victim\'s left thigh, same side convention as the torso');
  const legsLeft = woundSite({ location: 'legs', direction: 'left' });
  assert.equal(legsLeft.bone, 'thigh_r');
});

test('body wounds: a hit pins a pooled mark to the struck bone, follows it every frame, shows only at or below the 60% threshold, obeys blood off and clears on rematch', () => {
  const scene = new Scene();
  const wounds = createBodyWounds(scene, null);
  assert.equal(wounds.entries[0].length, 5, 'five pooled marks per fighter');
  assert.equal(wounds.entries[1].length, 5);
  assert.ok(wounds.entries.flat().every(m => !m.group.visible));

  const spine = new Object3D(); spine.name = 'spine_02'; spine.position.set(1, 1, -2);
  const root = new Group(); root.add(spine); root.updateMatrixWorld(true);

  const ok = wounds.hit(1, root, { location: 'torso', direction: 'right', heading: 0 }, 1);
  assert.ok(ok, 'the struck bone exists: the hit registers');
  assert.equal(wounds.hit(1, root, { location: 'torso', direction: 'right', heading: 0 }, 1) && true, true);

  // Above the threshold: the mark is pinned but hidden.
  wounds.update(1 / 60, [null, root], [1, 0.75], 'red');
  assert.ok(wounds.entries[1].every(m => !m.group.visible), 'nothing shows above the 60% threshold');

  // At the threshold: it shows, follows the bone, and fades in.
  wounds.update(1 / 60, [null, root], [1, WOUND_THRESHOLD], 'red');
  const marks = wounds.entries[1].filter(m => m.group.visible);
  assert.equal(marks.length, 2, 'both hits show once the fighter drops to the threshold');
  assert.ok(marks.every(m => m.group.position.distanceTo(spine.position) < 0.2), 'the mark sits at the struck bone, not the origin');

  // Blood off hides every mark, even below the threshold.
  wounds.update(1 / 60, [null, root], [1, 0.2], 'off');
  assert.ok(wounds.entries[1].every(m => !m.group.visible), "blood 'off' hides body wounds like every other gore effect");

  // A near-death fighter's marks are heavier than a fresh one at exactly the threshold (severity scales the mark and the run's ceiling).
  wounds.update(1 / 60, [null, root], [1, WOUND_THRESHOLD], 'red');
  const atThresholdMark = wounds.entries[1].find(m => m.group.visible)!;
  const atThresholdOpacity = atThresholdMark.mark.material.opacity, atThresholdMark_ = atThresholdMark.mark.scale.x;   // snapshot: the mark below mutates in place
  for (let i = 0; i < 30; i++) wounds.update(1 / 60, [null, root], [1, 0.02], 'red');
  const nearDeath = wounds.entries[1].find(m => m.group.visible)!;
  assert.ok(nearDeath.mark.material.opacity > atThresholdOpacity, 'closer to death reads stronger');
  assert.ok(nearDeath.mark.scale.x > atThresholdMark_, 'and the mark spreads wider');

  wounds.clear();
  assert.ok(wounds.entries.flat().every(m => !m.group.visible), 'rematch clears every mark');
  wounds.update(1 / 60, [null, root], [1, 0.1], 'red');
  assert.ok(wounds.entries[1].every(m => !m.group.visible), 'a cleared pool stays empty until the next hit');
});

// A rig stand-in: a bone at a world position with a world rotation, under a root.
const rigWith = (bone: string, position: [number, number, number], rotation: [number, number, number] = [0, 0, 0]) => {
  const b = new Object3D(); b.name = bone; b.position.set(...position); b.rotation.set(...rotation);
  const root = new Group(); root.add(b); root.updateMatrixWorld(true); return { root, b };
};
const hitTorso = (wounds: ReturnType<typeof createBodyWounds>, root: Object3D, heading = 0) =>
  wounds.hit(1, root, { location: 'torso', direction: 'thrust', heading }, 1);
const run = (wounds: ReturnType<typeof createBodyWounds>, root: Object3D, seconds: number, health = 0.3) => {
  for (let i = 0; i < Math.round(seconds * 60); i++) wounds.update(1 / 60, [null, root], [1, health], 'red');
};
const longest = (wounds: ReturnType<typeof createBodyWounds>) =>
  Math.max(0, ...wounds.entries[1].filter(m => m.group.visible).flatMap(m => m.strands.filter(s => s.mesh.visible).map(s => s.mesh.scale.y)));

test('blood runs: a strand starts as a bead, is visibly longer at 1.5 s than at 0.3 s, stops growing, and never shrinks (owner 2026-09-22: it drips, it does not stretch)', () => {
  const wounds = createBodyWounds(new Scene(), null), { root } = rigWith('spine_03', [0, 1.2, 0]);
  assert.ok(hitTorso(wounds, root));
  const at = (t: number) => { const w = createBodyWounds(new Scene(), null), r = rigWith('spine_03', [0, 1.2, 0]).root; hitTorso(w, r); run(w, r, t); return longest(w); };
  const l03 = at(0.3), l15 = at(1.5), l30 = at(3.0), l60 = at(6.0);
  assert.ok(l03 >= DRIP.bead * 0.99, `a bead shows early: ${l03.toFixed(3)} m`);
  assert.ok(l15 > l03 * 1.5, `visibly longer at 1.5 s: ${l03.toFixed(3)} → ${l15.toFixed(3)} m`);
  assert.ok(l15 >= 0.08, `at least 8 cm at 1.5 s on the man's torso (severity 0.5): ${l15.toFixed(3)} m`);
  assert.ok(l30 >= l15, 'still growing or held at 3 s, never shorter');
  assert.ok(Math.abs(l60 - l30) < 1e-6 || l60 >= l30, 'by 6 s every run has stopped: it holds');
  // Never shrinks frame to frame.
  const w = createBodyWounds(new Scene(), null), r = rigWith('spine_03', [0, 1.2, 0]).root; hitTorso(w, r);
  let last = 0; for (let i = 0; i < 6 * 60; i++) { w.update(1 / 60, [null, r], [1, 0.3], 'red'); const now = longest(w); assert.ok(now >= last - 1e-9, `frame ${i}: ${now} < ${last}`); last = now; }
});

test('blood runs: a strand hangs along world-down on the surface whatever the bone\'s rotation, and lies in the tangent plane of the wound normal', () => {
  for (const rotation of [[0, 0, 0], [0.9, 0, 0], [0, 1.3, 0], [0, 0, 1.1], [0.7, 0.4, 2.0]] as [number, number, number][]) {
    const wounds = createBodyWounds(new Scene(), null), { root } = rigWith('spine_03', [0.3, 1.2, -0.2], rotation);
    hitTorso(wounds, root, 0.8); run(wounds, root, 2);
    const mark = wounds.entries[1].find(m => m.group.visible)!, strand = mark.strands.find(s => s.mesh.visible)!;
    strand.mesh.updateWorldMatrix(true, false);
    const top = strand.mesh.localToWorld(new Vector3(0, 0, 0)), tip = strand.mesh.localToWorld(new Vector3(0, -1, 0));   // the unit quad hangs from y=0 to y=-1
    const along = tip.sub(top).normalize();
    const normal = new Vector3(0, 0, 1).applyQuaternion(mark.group.quaternion);
    assert.ok(along.y < -0.7, `rotation ${rotation}: the run points down in the world (y ${along.y.toFixed(2)})`);
    assert.ok(Math.abs(along.dot(normal)) < 1e-6, `rotation ${rotation}: the run lies on the surface (⊥ normal)`);
  }
});

test('wound art (owner 2026-09-23 picked B, C, D): each hit wears one of the three, seeded; the art stands near upright so its run points down', () => {
  assert.equal(WOUND_ART.length, 3);
  const w = createBodyWounds(new Scene(), null), r = rigWith('spine_03', [0, 1.2, 0]).root, seen = new Set<number>();
  for (let i = 0; i < 40; i++) {
    w.hit(1, r, { location: 'torso', direction: i % 2 ? 'right' : 'thrust', heading: i * 0.37 }, 1);
    const m = w.entries[1][i % w.entries[1].length];
    assert.ok(Number.isInteger(m.art) && m.art >= 0 && m.art < WOUND_ART.length, `art index ${m.art}`);
    assert.ok(Math.abs(m.mark.rotation.z) <= WOUND_SIZE.tilt + 1e-9, `tilt ${m.mark.rotation.z.toFixed(2)} stays near upright`);
    seen.add(m.art);
  }
  assert.equal(seen.size, 3, 'forty hits use all three wounds, never one image for every mark');
});

test('blood runs: seeded from the hit, not Math.random — two pools fed the same fight draw identical geometry; a different hit ordinal or heading draws different runs', () => {
  const geometry = (w: ReturnType<typeof createBodyWounds>) => w.entries[1].filter(m => m.group.visible).map(m => ({
    rot: +m.mark.rotation.z.toFixed(9), runs: m.runs, art: m.art,
    strands: m.strands.map(s => [s.live, +s.width.toFixed(9), +s.offset.toFixed(9), +s.start.toFixed(9), +s.duration.toFixed(9), +s.mesh.scale.y.toFixed(9)]),
  }));
  const play = (hits: [number, 'torso' | 'legs' | 'head', 'right' | 'left' | 'thrust'][]) => {
    const w = createBodyWounds(new Scene(), null), r = rigWith('spine_03', [0, 1.2, 0]).root;
    for (const [heading, location, direction] of hits) { w.hit(1, r, { location, direction, heading }, 1); run(w, r, 0.7); }
    return geometry(w);
  };
  const script: [number, 'torso' | 'legs' | 'head', 'right' | 'left' | 'thrust'][] = [[0.3, 'torso', 'thrust'], [1.1, 'torso', 'right'], [-0.4, 'torso', 'left']];
  assert.deepEqual(play(script), play(script), 'a replay draws the same runs');
  assert.notDeepEqual(play(script), play([[0.31, 'torso', 'thrust'], [1.1, 'torso', 'right'], [-0.4, 'torso', 'left']]), 'a different heading draws different runs');
  assert.notDeepEqual(play([[0.3, 'torso', 'thrust']]), play([[0.3, 'torso', 'thrust'], [0.3, 'torso', 'thrust']]).slice(1), 'the hit ordinal seeds too: the same blow twice is two different runs');
  // The seed is pure: the same inputs, the same number; and the LCG advances.
  assert.equal(woundSeed(3, { location: 'torso', direction: 'right', heading: 0.5 }), woundSeed(3, { location: 'torso', direction: 'right', heading: 0.5 }));
  assert.notEqual(woundSeed(3, { location: 'torso', direction: 'right', heading: 0.5 }), woundSeed(4, { location: 'torso', direction: 'right', heading: 0.5 }));
  assert.notEqual(lcg(1), lcg(2)); assert.equal(lcg(1), lcg(1));
});

test('blood runs: dry-out — once the last run has stopped, roughness climbs from fresh to dry over DRY.seconds and the tone darkens; dark mode multiplies further; blood off hides it', () => {
  const wounds = createBodyWounds(new Scene(), null), { root } = rigWith('spine_03', [0, 1.2, 0]);
  hitTorso(wounds, root); run(wounds, root, 0.3);
  const mark = wounds.entries[1].find(m => m.group.visible)!, strand = mark.strands.find(s => s.live)!;
  assert.ok(Math.abs(mark.mark.material.roughness - DRY.roughness[0]) < 1e-6, 'fresh: the low roughness, glossy');
  const fresh = mark.mark.material.color.clone();
  run(wounds, root, DRIP.start[1] + DRIP.duration[1] + DRY.seconds / 2);   // every run has certainly stopped, half the dry-out gone
  assert.ok(mark.mark.material.roughness > DRY.roughness[0] + 0.1 && mark.mark.material.roughness < DRY.roughness[1], `half dry: roughness ${mark.mark.material.roughness.toFixed(2)}`);
  assert.ok(mark.mark.material.color.getHex() !== fresh.getHex() && mark.mark.material.color.r < fresh.r, 'the tone has darkened');
  assert.equal(strand.mesh.material.roughness, mark.mark.material.roughness, 'the runs dry with their wound');
  run(wounds, root, DRY.seconds);
  assert.ok(Math.abs(mark.mark.material.roughness - DRY.roughness[1]) < 1e-6, 'fully dry: the high roughness, matte');
  const dried = mark.mark.material.color.clone();
  wounds.update(1 / 60, [null, root], [1, 0.3], 'dark');
  assert.ok(mark.mark.material.color.r < dried.r, 'dark mode multiplies the dried tone darker still');
  wounds.update(1 / 60, [null, root], [1, 0.3], 'off');
  assert.ok(wounds.entries[1].every(m => !m.group.visible), 'blood off hides every run');
});

test('blood runs: drawn over armour — no depth test on marks or strands (Strategy 2026-09-22: a pauldron never hides a wound); a mark whose surface faces away from the eye hides while its clock keeps running; the goblin\'s overhead site still runs ≥ 8 cm at 1.5 s', () => {
  const wounds = createBodyWounds(new Scene(), null), { root } = rigWith('spine_03', [0, 1.2, 0]);
  for (const m of wounds.entries[1]) { assert.equal(m.mark.material.depthTest, false); assert.equal(m.mark.material.polygonOffset, false); for (const s of m.strands) assert.equal(s.mesh.material.depthTest, false); }
  // Overhead cut at goblin scale: the site sits on spine_03 with its normal up-and-forward; length is measured in world metres.
  assert.ok(wounds.hit(1, root, { location: 'torso', direction: 'overhead', heading: 0 }, OPPONENTS.goblin.scale));
  const mark = wounds.entries[1].find(m => m.used)!;
  const tick = (eye: Vector3 | null) => wounds.update(1 / 60, [null, root], [1, 0.3], 'red', [false, false], eye);
  for (let i = 0; i < 90; i++) tick(new Vector3(0, 1.4, 3));   // 1.5 s from in front and above: the eye is on the wound's side
  assert.ok(mark.group.visible, 'faces the eye → shown');
  const seen = Math.max(...mark.strands.filter(s => s.mesh.visible).map(s => s.mesh.scale.y));
  assert.ok(seen >= 0.08, `≥ 8 cm on the goblin at 1.5 s (${seen.toFixed(3)} m)`);
  const age = mark.age;
  tick(new Vector3(0, 1.0, -3));   // behind and below: the surface faces away
  assert.ok(!mark.group.visible, 'faces away from the eye → hidden, not depth-buffered');
  assert.ok(mark.age > age, 'the clock kept running while hidden');
  tick(new Vector3(0, 1.4, 3)); assert.ok(mark.group.visible, 'back the moment the eye is on its side again');
  tick(null); assert.ok(mark.group.visible, 'no eye given (node, tests) → no facing test');
});

test('wound slots: a side cut can land on the near upper arm or the wrist (owner 2026-09-22: "run down the leg and arms", "a lot of skin ... wrists"); the overhead shoulder mirrors per hit; the draw is seeded so a replay lands the same limb; a rig without arm bones falls back to the flank', () => {
  assert.equal(woundSite({ location: 'torso', direction: 'right' }, 1).bone, 'upperarm_l', 'a right cut crosses to the victim\'s left arm');
  assert.equal(woundSite({ location: 'torso', direction: 'left' }, 2).bone, 'lowerarm_r', 'the wrist end of the right forearm');
  assert.equal(woundSite({ location: 'torso', direction: 'thrust' }, 2).bone, 'spine_03', 'a thrust has no side: it stays on the chest');
  assert.equal(woundSite({ location: 'legs', direction: 'right' }, 1).bone, 'thigh_l', 'legs stay legs');
  assert.ok(woundSite({ location: 'torso', direction: 'overhead' }, 0, true).dir[0] < 0 && woundSite({ location: 'torso', direction: 'overhead' }).dir[0] > 0, 'the mirrored overhead is the other shoulder');
  const armRig = () => { const root = new Group(); for (const n of ['spine_02', 'spine_03', 'upperarm_l', 'lowerarm_l']) { const b = new Object3D(); b.name = n; b.position.set(n.endsWith('_l') ? .3 : 0, 1.3, 0); root.add(b); } root.updateMatrixWorld(true); return root; };
  const bonesHit = (root: Object3D) => { const w = createBodyWounds(new Scene(), null); const out: string[] = []; for (let h = 0; h < 12; h++) { w.hit(1, root, { location: 'torso', direction: 'right', heading: h * .37 }, 1); out.push(w.entries[1][h % WOUNDS_PER_FIGHTER].bone!.name); } return out; };
  const a = bonesHit(armRig()), b = bonesHit(armRig());
  assert.deepEqual(a, b, 'seeded: the same twelve cuts land on the same twelve bones');
  assert.ok(a.includes('upperarm_l') && a.includes('lowerarm_l') && a.includes('spine_02'), `arm, wrist and flank all drawn across twelve cuts (${a.join(',')})`);
  const noArms = bonesHit(rigWith('spine_02', [0, 1.2, 0]).root);
  assert.ok(noArms.every(n => n === 'spine_02'), 'no arm bones → the flank, never a dropped hit');
});

test('surfaceHit: the mark is anchored to the point the blow met and lies flat on that face (owner 2026-09-22: "it floats off the chars", "not joined to the gear"); no skin → the site table\'s guess; a stray reading is clamped', () => {
  // A skinned box, half-size .1, bound to one bone at the origin — the surface is 10 cm out along +z, its face normal (0,0,1).
  const bone = new Bone(); bone.name = 'spine_03'; const geometry = new BoxGeometry(.2, .2, .2);
  const n = geometry.attributes.position.count;
  geometry.setAttribute('skinIndex', new Uint16BufferAttribute(new Uint16Array(n * 4), 4));
  geometry.setAttribute('skinWeight', new Float32BufferAttribute(new Float32Array(n * 4).map((_, i) => (i % 4 === 0 ? 1 : 0)), 4));
  const skin = new SkinnedMesh(geometry, new MeshStandardMaterial()); skin.add(bone); skin.bind(new Skeleton([bone]));
  const root = new Group(); root.add(skin); root.updateMatrixWorld(true);
  const met = surfaceHit(root, bone, new Vector3(0, 0, 1));
  assert.ok(met, 'the ray met the skin');
  assert.ok(Math.abs(met.point.z - .1) < .003, `the point on the surface, not a guessed radius (${met.point.z.toFixed(4)})`);
  assert.ok(met.normal.dot(new Vector3(0, 0, 1)) > .99, 'the face\'s own normal, pointing back at the blow');
  assert.equal(surfaceHit(new Group(), bone, new Vector3(0, 0, 1)), null, 'no skinned mesh → null, caller falls back');
  assert.equal(clampRadius(5, .22), .22 * 1.5, 'a stray reading is clamped to the slot\'s neighbourhood');
  // End to end: the mark sits 4 mm proud of that face and its plane is tangent to it, and it rides the bone.
  const wounds = createBodyWounds(new Scene(), null);
  assert.ok(wounds.hit(1, root, { location: 'torso', direction: 'thrust', heading: 0 }, 1));
  const mark = wounds.entries[1].find(m => m.used)!;
  wounds.update(1 / 60, [null, root], [1, .3], 'red');
  assert.ok(Math.abs(mark.group.position.z - .104) < .004, `on the surface + 4 mm proud (${mark.group.position.z.toFixed(4)})`);
  const facing = new Vector3(0, 0, 1).applyQuaternion(mark.group.quaternion);
  assert.ok(facing.dot(new Vector3(0, 0, 1)) > .99, 'the mark lies flat on the face it hit');
  bone.position.set(0, .5, 0); root.updateMatrixWorld(true); wounds.update(1 / 60, [null, root], [1, .3], 'red');
  assert.ok(Math.abs(mark.group.position.y - .5) < .02, 'the anchor rides the bone');
});
