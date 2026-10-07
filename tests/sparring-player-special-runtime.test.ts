import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '../src/match.ts';
import { OPPONENTS, RULES } from '../src/moves.ts';
import { idleIntent, stepDuel, type Duel } from '../src/duel.ts';
import { loadProfile } from '../src/profile.ts';
import { loadTrial } from '../src/trial.ts';
import { loadScorecard } from '../src/scorecard.ts';
import { SPECIAL_TESTS } from '../src/special-look.ts';
import { SUPPORTED_PLAYER_SPECIALS, specialCueFor } from '../src/sparring-special-runtime.ts';
import { createRecorder } from '../src/record.ts';
import * as THREE from 'three';
import { createSpecialPresentation } from '../src/special-presentation.ts';

const setup = () => {
  const writes: string[] = [], storage = { getItem: () => null, setItem: (key: string) => { writes.push(key); } };
  const m = new Match(OPPONENTS.goblin, 'test', { storage, profile: loadProfile(storage, () => 'test').profile, trial: loadTrial(storage), scorecard: loadScorecard(storage) }, 731, 'longsword', null, 16);
  return { m, writes };
};
const kit = { weapon: 'longsword', difficulty: 16, skill: null } as const;
const ready = (duel: Duel): Duel => ({ ...duel, fighters: duel.fighters.map((f, i) => ({ ...f, phase: 'ready', skillCooldown: 0, body: { ...f.body, x: 0, z: i, heading: i ? Math.PI : 0 } })) as Duel['fighters'] });
const skill = () => ({ ...idleIntent(), action: 'skill' as const });

for (const id of SUPPORTED_PLAYER_SPECIALS) test(`${id}: manual actor0 cast uses source share and hits actor1`, () => {
  const { m } = setup(); m.startSparring(kit, null, { player: id, opponent: null });
  assert.equal(m.weapon, kit.weapon); assert.equal(m.level, kit.difficulty); assert.equal(m.recorder, null);
  assert.deepEqual(m.specialIdentity.presets, [id, null]);
  assert.equal(m.practice.duel.fighters[1].specialShare, undefined);
  assert.equal(m.practice.duel.fighters[1].skill, null, 'foe off cannot inherit an AI skill from native decoration');
  let duel = ready(m.practice.duel);
  for (let t = 0; t < 240; t++) { duel = stepDuel(duel, [idleIntent(), idleIntent()]); assert.ok(!duel.events.some(e => e.type === 'SpecialStarted'), 'never automatic'); }
  const health = duel.fighters[1].health, own = duel.fighters[0].health;
  duel = stepDuel(duel, [skill(), idleIntent()]);
  assert.ok(duel.events.some(e => e.type === 'SpecialStarted' && e.actor === 0));
  const castAt = duel.tick;
  for (let t = 1; t < RULES.special.windup; t++) duel = stepDuel(duel, [idleIntent(), idleIntent()]);
  const landed = duel.events.find(e => e.type === 'SpecialLanded');
  assert.equal(landed?.actor, 0); assert.equal(landed?.target, 1); assert.equal(duel.tick - castAt, RULES.special.windup - 1);
  const share = SPECIAL_TESTS[id].level >= 36 ? RULES.special.bossDamage : RULES.special.damage;
  assert.equal(health - duel.fighters[1].health, Math.round(share * duel.fighters[1].maxHealth)); assert.equal(duel.fighters[0].health, own);
});

test('both sides, off, rematch, legacy skill and invalid choices remain independent', () => {
  const { m, writes } = setup(); const before = writes.length;
  m.startSparring(kit, null, { player: 'pulse', opponent: 'nyx' });
  assert.deepEqual(m.practice.duel.fighters.map(f => f.specialShare), [RULES.special.damage, RULES.special.bossDamage]);
  let duel = stepDuel(ready(m.practice.duel), [skill(), skill()]);
  assert.deepEqual(duel.events.filter(e => e.type === 'SpecialStarted').map(e => e.actor), [0, 1]);
  for (let t = 1; t < RULES.special.windup; t++) duel = stepDuel(duel, [idleIntent(), idleIntent()]);
  assert.deepEqual(duel.events.filter(e => e.type === 'SpecialLanded').map(e => [e.actor, e.target]), [[0, 1], [1, 0]]);
  m.rematch(); assert.deepEqual(m.specialIdentity.presets, ['pulse', 'nyx']); assert.equal(writes.length, before);
  m.startSparring({ ...kit, skill: 'miasma' }, null, { player: null, opponent: 'nyx' });
  assert.equal(m.practice.duel.fighters[0].specialShare, undefined); assert.equal(m.practice.duel.fighters[0].skillCooldown, 0); assert.equal(m.skill, 'miasma');
  m.startSparring(kit, null, { player: null, opponent: null }); assert.equal(m.specials, false);
  const epoch = m.epoch;
  assert.throws(() => m.startSparring({ ...kit, skill: 'miasma' }, null, { player: 'pulse', opponent: null }), RangeError);
  assert.throws(() => m.startSparring({ ...kit, difficulty: 'dummy' }, null, { player: null, opponent: 'nyx' }), RangeError);
  assert.throws(() => m.startSparring(kit, null, { player: 'missing' as 'pulse', opponent: null }), RangeError); assert.equal(m.epoch, epoch);
});

test('omitted foe retains native activation; replay drops all transient presets and uses record skill', () => {
  const { m } = setup(); m.startSparring(kit, null, { player: 'price' });
  assert.deepEqual(m.specialIdentity.presets, ['price', 'ratrun']);
  const record = createRecorder({ build: 'test', opponent: 'goblin', weapon: 'knife', skill: 'pommel', level: 1, seed: 731 }).finish('abandoned');
  assert.ok(m.startReplay(record, 0, m.epoch)); assert.equal(m.skill, 'pommel'); assert.equal(m.specialIdentity.presets, undefined); assert.equal(m.specials, false);
  assert.equal(specialCueFor('ratrun'), undefined); assert.equal(specialCueFor('standfast'), undefined);
});

for (const id of SUPPORTED_PLAYER_SPECIALS) test(`${id}: real lazy factory accepts normalized player caster and clears`, async () => {
  const { m } = setup(); m.startSparring(kit, null, { player: id, opponent: null });
  let duel = stepDuel(ready(m.practice.duel), [skill(), idleIntent()]);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
  const presentation = createSpecialPresentation(scene, 1, camera);
  presentation.prepare(1, duel.events, duel.fighters, duel.tick, false, m.specialIdentity);
  // Real dynamic imports/factories, no loader replacement or browser/GPU.
  for (let i = 0; i < 4; i++) await new Promise(resolve => setImmediate(resolve));
  const bones = [new THREE.Vector3(0, 1.5, 0), new THREE.Vector3(0, 1.5, 1)] as const;
  const warrior = () => ({ anchor: new THREE.Group(), boneWorld: () => new THREE.Vector3(0, 1, 0) });
  const warriors = { player: warrior(), opponent: warrior() };
  let visible = false;
  for (let t = 0; t <= RULES.special.windup; t++) {
    const snapshot = structuredClone(duel);
    presentation.prepare(1, duel.events, duel.fighters, duel.tick, false, m.specialIdentity);
    presentation.render(1 / 60, duel.fighters, duel.tick, bones, bones, warriors, false);
    assert.deepEqual(duel, snapshot, 'presentation never writes simulation');
    const group = scene.getObjectByName('special actor 0');
    assert.ok(group && group.children.length, 'real effect resources loaded');
    visible ||= group.children.some(o => o.visible);
    duel = stepDuel(duel, [idleIntent(), idleIntent()]);
  }
  assert.ok(visible, 'player cast becomes visible through its real timeline');
  assert.equal(scene.getObjectByName('special actor 1'), undefined);
  presentation.clear(); assert.equal(scene.children.length, 0); assert.equal(presentation.exposure, 1);
});

test('real Match AI foe casts with player preset off and writes nothing', () => {
  const { m, writes } = setup(), before = writes.length;
  m.startSparring(kit, null, { player: null, opponent: 'pulse' });
  m.practice = { ...m.practice, duel: ready(m.practice.duel) };
  for (let t = 0; t < 500 && !m.practice.finish; t++) m.step(idleIntent);
  assert.ok(m.fightLog.some(e => e.type === 'SpecialStarted' && e.actor === 1));
  assert.ok(m.fightLog.some(e => e.type === 'SpecialLanded' && e.actor === 1 && e.target === 0));
  assert.ok(!m.fightLog.some(e => e.type === 'SpecialStarted' && e.actor === 0));
  assert.equal(m.recorder, null); assert.equal(writes.length, before);
});

for (const kind of ['player', 'foe', 'both', 'none'] as const) test(`${kind}: real Match draw, approach, first cooldown and manual input`, () => {
  const { m, writes } = setup(), before = writes.length;
  m.startSparring({ ...kit, difficulty: kind === 'player' ? 'dummy' : 1 }, null, { player: kind === 'player' || kind === 'both' ? 'pulse' : null, opponent: kind === 'foe' || kind === 'both' ? 'nyx' : null });
  const original = structuredClone(m.practice.duel.fighters);
  assert.equal(original[0].phase, 'sheathed');
  m.step(() => ({ ...idleIntent(), action: 'light' }));
  assert.ok(m.fightLog.some(e => e.type === 'ActionStarted' && e.actor === 0 && e.action === 'draw'));
  for (let t = 0; t < 200 && !m.practice.finish; t++) m.step(() => {
    const [a, b] = m.practice.duel.fighters, gap = Math.hypot(a.body.x - b.body.x, a.body.z - b.body.z);
    return { ...idleIntent(), guard: true, move: { x: 0, z: gap > 2 ? -1 : 0, yaw: 0, run: false } };
  });
  assert.ok(!m.fightLog.some(e => e.type === 'SpecialStarted' && e.actor === 0), 'idle/movement/guard never auto-casts player');
  if (kind === 'player' || kind === 'both') {
    assert.equal(m.practice.duel.fighters[0].skillCooldown, 0, 'first cooldown elapsed through real Match');
    m.step(skill);
    assert.ok(m.practice.events.some(e => e.type === 'SpecialStarted' && e.actor === 0));
  }
  for (let t = 0; t < 200 && !m.practice.finish; t++) m.step(() => ({ ...idleIntent(), guard: true }));
  const landed = (actor: 0 | 1) => m.fightLog.some(e => e.type === 'SpecialLanded' && e.actor === actor && e.target === 1 - actor), cut = (actor: 0 | 1) => m.fightLog.some(e => e.type === 'SpecialInterrupted' && e.actor === actor);
  if (kind === 'both') { assert.equal(Number(landed(0)) + Number(landed(1)), 1, 'two casts: the first strike lands'); assert.ok(cut(0) || cut(1), 'and cuts the other (interruptible casts)'); }
  else { assert.equal(landed(0), kind === 'player'); assert.equal(landed(1), kind === 'foe'); assert.ok(!cut(0) && !cut(1), 'one cast alone is never cut'); }
  assert.equal(m.recorder, null); assert.equal(writes.length, before);
});
