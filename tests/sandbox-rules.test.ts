import test from 'node:test';
import assert from 'node:assert/strict';
import { SPECIAL_MELEE_WINDUP, SPECIAL_REACT, SPECIAL_REACT_KNOCK, SPECIAL_REACT_POSTURE, SPECIAL_REACT_STAGGER, shardRows, specialLookOf, specialPickRows, specialReactFloorOf, specialShardsOf, specialSoundOf, specialTrailOf } from '../src/fight/sandbox-rules.ts';
import { createFighter, idleIntent, stepDuel } from '../src/fight/duel.ts';
import { MELEE_SPECIAL_ERA, createRecorder, packRecord, unpackRecord } from '../src/fight/record.ts';

// Slice (e) of the combat-sandbox port (RV77): a MELEE special (no spell) is committed for the row's ticks and, when it lands, staggers, shoves and shakes the victim by its move row like a landed blow. The shipped rows (Dom 2026-10-17/18).
test('the shipped melee-special rows: 32-tick commit, react on at 160 / 450 / 150 percent, the lunge floor; the other families stay empty', () => {
  assert.equal(SPECIAL_MELEE_WINDUP, 32);
  assert.equal(SPECIAL_REACT, 1);
  assert.deepEqual([SPECIAL_REACT_STAGGER, SPECIAL_REACT_KNOCK, SPECIAL_REACT_POSTURE], [160, 450, 150]);
  assert.equal(specialReactFloorOf('lunge'), 36);
  assert.equal(specialReactFloorOf('cleave'), 0);
  assert.deepEqual(specialPickRows(), []);
  assert.equal(specialLookOf('cleave'), undefined);
  assert.equal(specialTrailOf('cleave'), undefined);
  assert.deepEqual(specialShardsOf('cleave'), []);
  assert.equal(shardRows(), 0);
  assert.deepEqual(specialSoundOf('cleave'), []);
});

const idle = () => ({ ...idleIntent(), lock: false });
const duelOf = (skill: string) => ({ tick: 0, fighters: [{ ...createFighter({ x: 0, z: 1.2, heading: Math.PI, distance: 0 }, 'ready'), specialShare: 0.1, skillCooldown: 0, skill: skill as never }, createFighter({ x: 0, z: 0, heading: 0, distance: 0 }, 'ready')], finish: null, events: [] }) as never as { fighters: { special?: number; phase: string; stun: number; health: number; posture: number; body: { z: number } }[]; events: { type: string }[] };

test('a melee special is committed for the row\'s windup, not the spell windup', () => {
  const d = stepDuel(duelOf('cleave') as never, [{ ...idle(), action: 'skill' }, idle()]) as never as ReturnType<typeof duelOf>;
  assert.ok((d.fighters[0]!.special ?? 0) > 0 && (d.fighters[0]!.special ?? 0) <= SPECIAL_MELEE_WINDUP + 1, `committed for ${d.fighters[0]!.special} ticks`);
});

const landed = (skill: string) => {
  let d = duelOf(skill); const z0 = d.fighters[1]!.body.z, hp0 = d.fighters[1]!.health;
  d = stepDuel(d as never, [{ ...idle(), action: 'skill' }, idle()]) as never;
  for (let i = 0; i < 80 && !d.events.some((e) => e.type === 'SpecialLanded'); i++) d = stepDuel(d as never, [idle(), idle()]) as never;
  return { d, z0, hp0 };
};

test('when it lands the victim is staggered, shoved back, loses health and gains posture, from the move row', () => {
  const { d, z0, hp0 } = landed('cleave'), foe = d.fighters[1]!;
  assert.ok(d.events.some((e) => e.type === 'SpecialLanded'), 'the special landed');
  assert.equal(foe.phase, 'hurt');
  assert.ok(foe.stun > 0 && d.events.some((e) => e.type === 'Staggered'), 'a Staggered event');
  assert.ok(foe.body.z < z0, 'shoved away from the caster');
  assert.ok(foe.health < hp0, 'lost health');
  assert.ok(foe.posture > 0, 'gained posture');
});

test('RV77: a specials fight is stamped at 77, and a specials-flag record claiming an older version is refused at decode', () => {
  const rec = createRecorder({ weapon: 'longsword', build: 'abc1234', opponent: 'goblin', level: 3, seed: 5, specials: true });
  for (let i = 0; i < 20; i++) rec.push({ move: { x: 0, z: 0, yaw: 0, run: false }, action: null, guard: false, lock: true });
  const fight = rec.finish('draw'), bytes = packRecord(fight);
  assert.equal(fight.v, MELEE_SPECIAL_ERA, 'stamped at the melee-special era');
  assert.deepEqual(unpackRecord(bytes), fight, 'its own fresh link round-trips');
  const old = bytes.slice(); old[2] = 76;
  assert.throws(() => unpackRecord(old), /not supported with specials/, 'an older specials record would replay a different special');
});

test('specialReactFloor: the lunge (move row stagger 0) still staggers the victim by its floor row', () => {
  assert.ok(landed('lunge').d.fighters[1]!.stun >= 35, 'the floor row gives the lunge its stagger');
});
