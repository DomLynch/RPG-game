import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Box3, Quaternion, SkinnedMesh, Vector3, type Matrix4, type Object3D } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { buildWarriors, lootPiecesOf, lootWorn } from '../src/characters.ts';
import type { WeaponId } from '../src/moves.ts';

// Parse a shipped GLB in Node, as tests/loot-wear.test.ts does (images dropped: decoding is the browser's).
async function parse(file: string) {
  const bytes = readFileSync(new URL(`../src/assets/${file}`, import.meta.url)), size = bytes.readUInt32LE(12), json = JSON.parse(bytes.subarray(20, 20 + size).toString());
  json.images = []; json.textures = []; json.materials = json.materials.map((m: { name: string }) => ({ name: m.name }));
  json.buffers[0].uri = 'data:application/octet-stream;base64,' + bytes.subarray(28 + size).toString('base64');
  globalThis.ProgressEvent ??= class { constructor(_type: string, fields: object) { Object.assign(this, fields); } } as unknown as typeof ProgressEvent;
  return new GLTFLoader().parseAsync(JSON.stringify(json), '');
}
const BOARD_RADIUS = .28;   // build-warrior.mjs's RADIUS for #478's round

// A fighter with this weapon, optionally wearing #478's shield, plus probes for where the board is and whether the blade passes through it.
async function fighter(weapon: WeaponId, shield: boolean) {
  const pieces = lootPiecesOf((await parse('loot.glb')).scene), { player } = buildWarriors(await parse('warrior.glb'), undefined, [weapon, weapon]);
  if (shield) player.wear(pieces.filter(p => lootWorn(p, ['veteran.Shield'])));
  const node = (name: string) => { let found: Object3D | undefined; player.anchor.traverse(o => { if (o.name === name) found ??= o; }); return found; };
  const hand = node('hand_l')!, swordHand = node('hand_r')!, blade = (node('WeaponDrawn') ?? node('SwordDrawn'))!;
  let inverse: Matrix4 | undefined;
  player.anchor.traverse(o => { if (!inverse && o instanceof SkinnedMesh) { const i = o.skeleton.bones.findIndex(b => b.name === 'hand_l'); if (i >= 0) inverse = o.skeleton.boneInverses[i]; } });
  const faceLocal = new Vector3(0, 0, 1).transformDirection(inverse!);   // the board's face, +Z in bind space, in hand_l's frame
  const board = () => {
    player.anchor.updateMatrixWorld(true);
    const box = new Box3();
    for (const m of player.worn()) { m.skeleton.update(); const pos = m.geometry.getAttribute('position'); for (let i = 0; i < pos.count; i += 5) box.expandByPoint(m.applyBoneTransform(i, new Vector3().fromBufferAttribute(pos, i))); }
    return { centre: box.getCenter(new Vector3()), face: faceLocal.clone().applyQuaternion(hand.getWorldQuaternion(new Quaternion())).normalize() };
  };
  // How far inside the board's rim the sword (the hand, then the weapon's first metre) crosses its plane; 0 = clear.
  const pierce = () => {
    const { centre, face } = board();
    const points = [swordHand.getWorldPosition(new Vector3()), ...Array.from({ length: 11 }, (_, i) => blade.localToWorld(new Vector3(0, i * .09, 0)))];
    let depth = 0;
    for (let i = 1; i < points.length; i++) {
      const d0 = points[i - 1].clone().sub(centre).dot(face), d1 = points[i].clone().sub(centre).dot(face);
      if (Math.sign(d0) !== Math.sign(d1)) depth = Math.max(depth, BOARD_RADIUS - points[i - 1].clone().lerp(points[i], d0 / (d0 - d1)).distanceTo(centre));
    }
    return depth;
  };
  const arm = () => ['upperarm_l', 'lowerarm_l', 'hand_l'].map(n => node(n)!.quaternion.clone());
  return { player, board, pierce, arm };
}
type Fighter = Awaited<ReturnType<typeof fighter>>;
type Update = Fighter['player']['update'];
const settle = (f: Fighter, pose: Parameters<Update>[2], frames = 30) => { for (let i = 0; i < frames; i++) f.player.update(0, 1 / 30, pose, 0); };
// Every armed pose swept the way a fight plays it (progress 0→1 at 30 fps, one after another): the depth of each frame where the blade crosses the board.
function sweep(f: Fighter) {
  const hits: number[] = [];
  const run = (pose: Parameters<Update>[2], attack?: Parameters<Update>[4]) => { for (let p = 0; p <= 1.0001; p += .05) { f.player.update(0, 1 / 30, pose, p, attack); const d = f.pierce(); if (d > 0) hits.push(d); } };
  settle(f, 'ready');
  for (const a of ['light', 'heavy', 'thrust', 'riposte', 'return'] as const) run('attack', a);
  for (const p of ['guard', 'block', 'parry', 'deflected', 'hit', 'kick', 'roll'] as const) run(p, p === 'kick' ? 'light' : undefined);
  return hits;
}

test('shield carry: a one-hand fighter holds #478\'s board off his blade, where the sword clips alone put it across the hilt', async () => {
  const baseline = sweep(await fighter('longsword', true));   // a two-hander keeps the clip's hold: off hand on the hilt, the board with it
  assert.ok(baseline.length > 40 && Math.max(...baseline) > .2, `the problem: the clips hold the board across the blade (${baseline.length} frames, ${Math.max(...baseline).toFixed(3)} m deep)`);
  for (const weapon of ['cleaver', 'knife', 'estoc'] as const) {
    const hits = sweep(await fighter(weapon, true));
    // Measured 2026-09-23: 3 frames of ~250 — the opening frame of a heavy (1 cm, at the rim) twice and of a return (8 cm) once.
    assert.ok(hits.length <= 3 && Math.max(0, ...hits) < .09, `${weapon}: the blade crosses the board on ${hits.length} frames, deepest ${Math.max(0, ...hits).toFixed(3)} m`);
  }
});

test('shield carry: the board faces the opponent at rest, rises and comes forward on guard, and lets go of the arm when the shield comes off', async () => {
  const f = await fighter('cleaver', true);
  settle(f, 'ready');
  const rest = f.board();
  assert.ok(rest.face.z > .7, `at rest the board faces front (+Z), not his side: face ${rest.face.toArray().map(v => v.toFixed(2))}`);
  settle(f, 'guard');
  const guard = f.board();
  assert.ok(guard.centre.y > rest.centre.y + .15 && guard.centre.z > rest.centre.z + .05, 'on guard the board rises over the chest and comes forward');
  assert.ok(guard.face.z > .8, 'and faces the opponent');
  // Without the shield the arm is the clip's own again: the carry eases out and the mixer's pose comes back.
  const bare = await fighter('cleaver', false);
  settle(bare, 'ready');
  f.player.wear([]);
  settle(f, 'ready', 90);
  const clip = bare.arm();
  f.arm().forEach((q, i) => assert.ok(q.angleTo(clip[i]) < .01, `bone ${i}: back on the clip after the shield comes off (${q.angleTo(clip[i]).toFixed(4)} rad)`));
});

test('shield carry: a two-hander\'s arm is untouched (its shield stows, #478), and the pose is finite at every frame', async () => {
  const shielded = await fighter('longsword', true), bare = await fighter('longsword', false);
  settle(shielded, 'guard'); settle(bare, 'guard');
  const clip = bare.arm();
  shielded.arm().forEach((q, i) => assert.ok(q.angleTo(clip[i]) < 1e-6, `two-hand: bone ${i} is the clip's`));
  const f = await fighter('knife', true);
  for (const pose of ['ready', 'attack', 'guard', 'death', 'sheathed'] as const) for (let p = 0; p <= 1; p += .1) {
    f.player.update(0, 1 / 30, pose, p, 'heavy');
    f.arm().forEach(q => assert.ok([q.x, q.y, q.z, q.w].every(Number.isFinite), `${pose}@${p.toFixed(1)}: finite`));
  }
});
