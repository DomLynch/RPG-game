import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IMPACT, KNOCK_SETTLE, impactShove, impactStopMs, impactTier } from '../src/hit-impact.ts';
import { shoveFor } from '../src/camera-kick.ts';
import { initialPractice, stepPractice } from '../src/combat.ts';
import { OPPONENTS, opponentAt, profileAt, type MoveId } from '../src/moves.ts';
import { createRecorder, encodeRecord } from '../src/record.ts';
import type { CombatEvent, Intent } from '../src/duel.ts';

// Hit impact (Dom 2026-09-29): every landed blow adds hit-stop and knocks the camera away from it; full for a heavy, a guard break or a
// skill, half for the rest; nothing for a block, a parry or a miss; always on, reduced motion included (owner ruling 2026-09-29); presentation only.
const event = (type: CombatEvent['type'], extra: Partial<CombatEvent> = {}): CombatEvent => ({ tick: 1, type, actor: 0, target: 1, move: 'light_right', ...extra });
const FRAME = 1000 / 60, near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≈ ${b}`);

test('tier per move kind: heavy, charged, guard break and skills are full; stab, slash, kick and every other landed hit are half', () => {
  for (const move of ['heavy_overhead', 'heavy_riposte', 'heavy_counter', 'critical', 'skill_pommel', 'skill_witchfire'] as MoveId[]) assert.equal(impactTier(event('Hit', { move })), 'full', move);
  assert.equal(impactTier(event('Hit', { move: 'light_left', charged: true })), 'full', 'a charged blow');
  assert.equal(impactTier(event('GuardBroken', { move: 'light_right' })), 'full', 'a guard break');
  for (const move of ['light_right', 'light_left', 'thrust', 'riposte', 'slash_riposte', 'kick'] as MoveId[]) assert.equal(impactTier(event('Hit', { move })), 'half', move);
  assert.equal(impactTier(event('Parried')), 'parry'); assert.equal(impactTier(event('Blocked', { move: 'heavy_overhead' })), 'block');
  for (const type of ['AttackMissed', 'Dodged', 'Killed', 'Staggered'] as CombatEvent['type'][]) assert.equal(impactTier(event(type, { move: 'heavy_overhead' })), null, type);
});

test('hit-stop: +5 frames full, +3 half, the strongest blow of the frame decides; nothing without a landed blow', () => {
  assert.equal(IMPACT.full.frames, 5); assert.equal(IMPACT.half.frames, 3);
  near(impactStopMs([event('Hit', { move: 'heavy_overhead' })]), 5 * FRAME);
  near(impactStopMs([event('Hit', { move: 'kick' })]), 3 * FRAME);
  near(impactStopMs([event('Hit', { move: 'thrust' }), event('GuardBroken')]), 5 * FRAME);
  assert.equal(impactStopMs([event('AttackMissed'), event('Dodged')]), 0);
  // guard tiers: a parry is the longest beat in the game (today's 70 ms + 11 frames > a heavy hit's 90 ms + 5); a block is short
  near(impactStopMs([event('Parried')]), 11 * FRAME); near(impactStopMs([event('Blocked')]), 2 * FRAME);
  assert.ok(70 + impactStopMs([event('Parried')]) > 90 + impactStopMs([event('Hit', { move: 'heavy_overhead' })]));
  assert.equal(impactStopMs([]), 0);
});

test('knock: away from the side the blow arrives from, on every side, full 4 cm / half 2 cm, back in 120 ms', () => {
  // The player's swing on the opponent arrives as named (right -> from screen right: the camera goes left) ...
  assert.equal(impactShove(event('Hit', { move: 'light_right' }), 'right')!.screen, -IMPACT.half.knock);
  assert.equal(impactShove(event('Hit', { move: 'light_left' }), 'left')!.screen, IMPACT.half.knock);
  // ... the opponent's swing on the player arrives mirrored (right -> from screen left: the camera goes right).
  assert.equal(impactShove(event('Hit', { actor: 1, target: 0, move: 'light_right' }), 'right')!.screen, IMPACT.half.knock);
  assert.equal(impactShove(event('Hit', { actor: 1, target: 0, move: 'light_left' }), 'left')!.screen, -IMPACT.half.knock);
  assert.equal(impactShove(event('GuardBroken', { actor: 1, target: 0, move: 'light_left', charged: true }), 'left')!.screen, -IMPACT.full.knock);
  assert.equal(impactShove(event('Hit', { move: 'light_right', charged: true }), 'right')!.screen, -IMPACT.full.knock);
  // Overhead, thrust, low, a kick, a sideless skill: from above or in front, the camera drops by the knock instead.
  for (const [move, direction, knock] of [['heavy_overhead', 'overhead', IMPACT.full.knock], ['thrust', 'thrust', IMPACT.half.knock], ['kick', 'low', IMPACT.half.knock], ['skill_pommel', undefined, IMPACT.full.knock]] as const) {
    for (const side of [{ actor: 0, target: 1 }, { actor: 1, target: 0 }] as const) {
      const e = event('Hit', { move, ...side }), s = impactShove(e, direction)!;
      assert.equal(Math.abs(s.screen ?? 0), 0, `${move} does not knock sideways`);
      assert.ok(Math.abs(s.drop - (shoveFor(e)!.drop + knock)) < 1e-12, `${move} drops by ${knock}`);
    }
  }
  const s = impactShove(event('Hit', { move: 'heavy_overhead' }), 'overhead')!;
  assert.equal(s.hold, 0); assert.equal(s.settle, KNOCK_SETTLE); assert.equal(KNOCK_SETTLE, 0.12);
  // not a landed blow: today's kick stands
  for (const e of [event('AttackMissed'), event('Dodged')]) assert.equal(impactShove(e, 'right'), null, e.type);
  // A block (actor = defender, target = attacker) knocks half-strength away from the blow on the guard: the opponent's right swing blocked by
  // the player arrives from screen left (camera right); the player's right swing blocked by the opponent arrives from screen right.
  assert.equal(impactShove(event('Blocked', { actor: 0, target: 1 }), 'right')!.screen, IMPACT.block.knock);
  assert.equal(impactShove(event('Blocked', { actor: 1, target: 0 }), 'right')!.screen, -IMPACT.block.knock);
  assert.equal(impactShove(event('Blocked', { actor: 0, target: 1 }), 'left')!.screen, -IMPACT.block.knock);
  // A parry jolts TOWARD the attacker: in toward the opponent, back toward the player; today's sideways flick stays.
  const parried = impactShove(event('Parried', { actor: 0, target: 1 }), 'right')!;
  assert.equal(parried.push, IMPACT.parry.push); assert.equal(parried.side, shoveFor(event('Parried', { actor: 0, target: 1 }))!.side);
  assert.equal(impactShove(event('Parried', { actor: 1, target: 0 }), 'right')!.push, -IMPACT.parry.push);
});

// Presentation only: a fight with the impact read on every tick (as main.ts and scene.ts read it) records and replays byte-identically to
// the same fight without it. The events are frozen so a write into them would throw.
const intent = (t: number, yaw: number): Intent => {
  const phase = t % 240;
  return {
    move: { x: phase < 90 ? Math.sin(t / 25) : 0, z: phase < 90 ? 0.8 : phase < 120 ? -0.6 : 0, yaw, run: phase > 200 }, lock: true,
    action: phase === 95 ? 'light' : phase === 110 ? 'light' : phase === 130 ? 'heavy' : phase === 170 ? 'thrust' : phase === 190 ? 'kick' : null,
    guard: phase >= 140 && phase < 165, guardDirection: phase >= 140 && phase < 165 ? 'overhead' : undefined, held: phase > 125 && phase < 135,
  };
};
function fight(readImpact: boolean) {
  const rec = createRecorder({ weapon: 'longsword', build: 'abc1234', opponent: 'veteran', level: 18, seed: 731 });
  let practice = initialPractice(731, opponentAt(OPPONENTS.veteran, 18)), yaw = 0.6, landed = 0;
  for (let t = 0; t < 1800 && !practice.finish; t++) {
    yaw += 0.004 * Math.sin(t / 37);
    practice = stepPractice(practice, rec.push(intent(t, yaw)), profileAt(OPPONENTS.veteran, 18));
    if (!readImpact) continue;
    const events = practice.events.map((e) => Object.freeze({ ...e }));
    Object.freeze(events);
    if (impactStopMs(events)) landed++;
    for (const e of events) impactShove(e, 'right');
    for (const e of practice.events) Object.freeze(e);
  }
  return { record: rec.finish(practice.finish ? (practice.finish.victim === 1 ? 'killed' : 'died') : 'abandoned'), practice, landed };
}

test('presentation only: a recorded fight replays byte-identically with the impact on', async () => {
  const on = fight(true), off = fight(false);
  assert.ok(on.landed >= 3, `the scripted fight landed ${on.landed} blows`);
  assert.equal(await encodeRecord(on.record), await encodeRecord(off.record), 'same record, byte for byte');
  assert.deepEqual(on.practice.duel.fighters, off.practice.duel.fighters);
  assert.equal(on.practice.duel.tick, off.practice.duel.tick);
});
