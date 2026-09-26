import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import type { CombatEvent, Fighter } from '../src/duel.ts';
import { SIGNATURE_CAPS, SIGNATURES, createSignatureMarks, createSignatures, defendedBy, heavyHitBy, hitBy, hitOn, pickSignature, registerSignature, resolveSignature, SHIPPED, signatureMode, type SignatureEffect } from '../src/signature.ts';

const hit = (actor: 0 | 1, move: string): CombatEvent => ({ tick: 1, type: 'Hit', actor, target: actor ? 0 : 1, move: move as CombatEvent['move'], location: 'torso', heading: 0 });
const fighters = [{}, {}] as unknown as readonly [Fighter, Fighter];
const effect = (variant: 'A' | 'B' | 'C', fire: SignatureEffect['fire'] = () => {}): SignatureEffect => ({ opponent: 'veteran', variant, name: `test ${variant}`, when: heavyHitBy, fire });

test('signature triggers read the event sides the duel writes: a blow names the attacker, a defence the defender', () => {
  assert.equal(hitBy(hit(1, 'light_right')), true);
  assert.equal(hitBy(hit(0, 'light_right')), false);
  assert.equal(hitBy(hit(1, 'kick')), false, 'a kick is not a blade signature');
  assert.equal(heavyHitBy(hit(1, 'heavy_overhead')), true);
  assert.equal(heavyHitBy(hit(1, 'light_left')), false);
  assert.equal(hitOn(hit(0, 'heavy_overhead')), true);
  assert.equal(defendedBy({ tick: 1, type: 'Blocked', actor: 1, target: 0 }, 'Blocked'), true);
  assert.equal(defendedBy({ tick: 1, type: 'Blocked', actor: 0, target: 1 }, 'Blocked'), false);
});

test('the mode picks one effect: off none, on the A, a letter only that variant; anything unknown reads as off', () => {
  const list = [effect('B'), effect('A')];
  assert.equal(pickSignature(list, 'off'), null);
  assert.equal(pickSignature(list, 'on')?.variant, 'A');
  assert.equal(pickSignature(list, 'B')?.variant, 'B');
  assert.equal(pickSignature(list, 'C'), null);
  assert.equal(pickSignature(undefined, 'on'), null);
  assert.equal(signatureMode('on'), 'on');
  assert.equal(signatureMode('a'), 'A');
  assert.equal(signatureMode('OFF'), 'off');
  assert.equal(signatureMode('lasers'), 'off');
  assert.equal(signatureMode(null), 'ship');
  assert.equal(pickSignature(list, 'ship'), null, 'nothing ruled: players see nothing');
  assert.equal(pickSignature(list, 'ship', 'B')?.variant, 'B', 'the ruled variant');
  assert.equal(pickSignature(list, 'ship', 'C'), null, 'ruled but not registered yet: nothing');
});

test('marks are capped per body, per shield and on the floor; the oldest is the one reused, and clear empties them all', () => {
  const scene = new THREE.Scene(), marks = createSignatureMarks(scene);
  const look = { width: 0.1, height: 0.1 };
  for (let i = 0; i < SIGNATURE_CAPS.floor + 3; i++) marks.floor(i, 0, 0, look);
  assert.equal(marks.count('floor'), SIGNATURE_CAPS.floor);
  marks.update(0.5, null);
  const floor = scene.children.filter((o) => o.visible);
  assert.equal(floor.length, SIGNATURE_CAPS.floor);
  // The first three floor marks (x = 0, 1, 2) were the oldest and were taken by the last three (x = 8, 9, 10).
  const xs = floor.map((o) => Math.round(o.position.x)).sort((a, b) => a - b);
  assert.deepEqual(xs, [3, 4, 5, 6, 7, 8, 9, 10]);
  const shield = new THREE.Object3D(); scene.add(shield);
  for (let i = 0; i < SIGNATURE_CAPS.shield + 2; i++) marks.shield(1, shield, new THREE.Vector3(0, 1, 0.3), new THREE.Vector3(0, 0, 1), look);
  assert.equal(marks.count('shield', 1), SIGNATURE_CAPS.shield);
  assert.equal(marks.count('shield', 0), 0);
  // A body mark pins to the bone the site table names (torso, a straight cut: spine_03); no bone, no mark.
  const root = new THREE.Object3D(), spine = new THREE.Object3D(); spine.name = 'spine_03'; spine.position.y = 1.3; root.add(spine); scene.add(root);
  for (let i = 0; i < SIGNATURE_CAPS.body + 1; i++) assert.equal(marks.body(1, root, { location: 'torso', direction: 'thrust', heading: 0 }, look), true);
  assert.equal(marks.count('body', 1), SIGNATURE_CAPS.body);
  assert.equal(marks.body(0, new THREE.Object3D(), { location: 'torso', direction: 'thrust', heading: 0 }, look), false);
  marks.clear();
  assert.deepEqual([marks.count('floor'), marks.count('shield', 1), marks.count('body', 1)], [0, 0, 0]);
});

test('the frame hook fires only the chosen effect, only on its events, and stands down while a finisher plays', () => {
  let fired = 0;
  registerSignature(effect('A', () => { fired++; }));
  registerSignature(effect('A', () => { fired += 100; }));   // a second A for the same opponent is ignored
  try {
    const signatures = createSignatures(new THREE.Scene(), 'veteran');
    const frame = { fighters, roots: [null, null] as const, scale: [1, 1] as const, yielding: false, bloodMode: 'red' as const };
    signatures.render(1 / 60, [hit(1, 'heavy_overhead')], frame, null, [false, false]);
    assert.equal(fired, 0, 'off by default');
    signatures.setMode(signatureMode('on'));
    signatures.render(1 / 60, [hit(1, 'heavy_overhead'), hit(1, 'light_left'), hit(0, 'heavy_overhead')], frame, null, [false, false]);
    assert.equal(fired, 1);
    signatures.render(1 / 60, [hit(1, 'heavy_overhead')], { ...frame, yielding: true }, null, [false, false]);
    assert.equal(fired, 1, 'a finisher is playing: the signature yields');
    assert.deepEqual(signatures.probe(), { mode: 'on', effect: 'veteran:A', fired: 1, body: 0, shield: 0, floor: 0 });
  } finally { delete SIGNATURES.veteran; }
});

test('Dwarf Hammer Stamp: a landed heavy by the Dwarf stamps the struck body once; a light, a kick or a heavy by the player does not', async () => {
  const { STAMP } = await import('../src/signature-dwarf.ts');
  const { initialDuel } = await import('../src/duel.ts');
  const { OPPONENTS } = await import('../src/moves.ts');
  const duel = initialDuel(OPPONENTS.dwarf);
  const scene = new THREE.Scene(), signatures = createSignatures(scene, 'dwarf');
  signatures.setMode(signatureMode('on'));
  const root = new THREE.Object3D(); for (const name of ['spine_02', 'spine_03', 'Head', 'thigh_l', 'thigh_r', 'upperarm_l', 'upperarm_r']) { const b = new THREE.Object3D(); b.name = name; b.position.y = 1; root.add(b); }
  scene.add(root);
  const frame = { fighters: duel.fighters, roots: [root, null] as const, scale: [1, OPPONENTS.dwarf.scale] as const, yielding: false, bloodMode: 'red' as const };
  signatures.render(1 / 60, [hit(1, 'light_right'), hit(1, 'kick'), hit(0, 'heavy_overhead')], frame, null, [false, false]);
  assert.equal(signatures.marks.count('body', 0), 0);
  signatures.render(1 / 60, [hit(1, 'heavy_overhead')], frame, null, [false, false]);
  assert.equal(signatures.marks.count('body', 0), 1, 'the player carries the stamp');
  assert.deepEqual(signatures.probe(), { mode: 'on', effect: 'dwarf:A', fired: 1, body: 0, shield: 0, floor: 0 });
  const stamp = scene.children.find((o) => o.visible && (o as THREE.Mesh).isMesh) as THREE.Mesh | undefined;
  assert.ok(stamp, 'the stamp is drawn');
  assert.ok(Math.abs(stamp!.scale.x - STAMP.size) < 1e-9);
});

test('the preview counts only while the test tools are open: a player typing ?signature=on sees nothing (Lead, #655 review)', () => {
  assert.equal(resolveSignature('?signature=on', null, false), 'ship');
  assert.equal(resolveSignature('', 'on', false), 'ship', 'a stale session pick is ignored once the tools are closed');
  assert.equal(resolveSignature('?debug&signature=on', 'off', true), 'on', 'the URL wins while the tools are open');
  assert.equal(resolveSignature('?debug', 'B', true), 'B');
  assert.equal(resolveSignature('?debug', null, true), 'ship');
  assert.equal(resolveSignature('?debug', 'off', true), 'off');
});

test('SHIPPED: the ruled variant is on for players, nothing unruled is, and a blood effect stands down with blood off', () => {
  assert.deepEqual(Object.fromEntries(Object.entries(SHIPPED).map(([id, s]) => [id, s!.variant])),
    { nightborn: 'B', executioner: 'A', pitborn: 'A', plaguedoctor: 'B', goblin: 'C', knight: 'A', veteran: 'C', dwarf: 'C', witch: 'A' });
  assert.equal(SHIPPED.knight?.name, 'Rivet A');
  assert.equal(SHIPPED.dwarf?.name, 'Hammer Wound');
  let fired = 0;
  registerSignature(effect('A', () => { fired += 100; }));
  registerSignature({ ...effect('C', () => { fired++; }), blood: true });
  try {
    const signatures = createSignatures(new THREE.Scene(), 'veteran');
    signatures.setMode(resolveSignature('?signature=A', 'A', false));   // a player: the tools are closed
    const frame = { fighters, roots: [null, null] as const, scale: [1, 1] as const, yielding: false, bloodMode: 'red' as 'red' | 'off' };
    signatures.render(1 / 60, [hit(1, 'heavy_overhead')], frame, null, [false, false]);
    assert.equal(fired, 1, 'the Centurion\'s ruled C, not the A the URL asked for');
    signatures.render(1 / 60, [hit(1, 'heavy_overhead')], { ...frame, bloodMode: 'off' }, null, [false, false]);
    assert.equal(fired, 1, 'blood off: the blood effect does not fire');
  } finally { delete SIGNATURES.veteran; }
});
