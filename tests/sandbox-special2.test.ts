// sandbox-mech special slot 2 as a melee special: SPECIAL 2 may hold an existing class skill instead of a spell. The press casts that skill (its own move, no cost), the slot-1 skill is back when the cast ends, and only slot 2 cools down.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createFighter, stepDuel, idleIntent, legal } from '../src/fight/duel.ts';
import { SKILL_MOVE } from '../src/fight/moves.ts';
import { Match } from '../src/fight/match.ts';
import { SPELL_IDS } from '../src/fight/spell-cast.ts';
import { OPPONENTS } from '../src/fight/moves.ts';
import { loadProfile } from '../src/core/profile.ts';
import { loadTrial } from '../src/trial.ts';
import { loadScorecard } from '../src/scorecard.ts';

const idle = () => ({ ...idleIntent(), lock: false });
const caster = (extra: object = {}) => ({ ...createFighter({ x: 0, z: 1.2, heading: Math.PI, distance: 0 }, 'ready'), specialShare: 0.1, skillCooldown: 0, skill: 'shove' as never, skill2: 'pommel' as never, ...extra });
const duelOf = (c: object) => ({ tick: 0, fighters: [c, createFighter({ x: 0, z: 0, heading: 0, distance: 0 }, 'ready')], finish: null, events: [] }) as never as { fighters: { skill?: string; skill2?: string; special?: number; skillCooldown: number; skillCooldown2?: number; slot2Active?: boolean }[]; events: { type: string; move?: string }[] };

test('a melee special in slot 2 is legal, and a fighter without one may not press SPECIAL 2', () => {
  assert.equal(legal(caster() as never, 'skill2'), true);
  const { skill2: _drop, ...none } = caster() as Record<string, unknown>;
  assert.equal(legal(none as never, 'skill2'), false);
});

test('SPECIAL 2 casts the second skill, then slot 1 is back and only slot 2 cools', () => {
  let d = duelOf(caster());
  d = stepDuel(d as never, [{ ...idle(), action: 'skill2' }, idle()]) as never;
  assert.equal(d.fighters[0]!.skill, 'pommel', 'the second skill is the one being cast');
  assert.equal(d.events.find((e) => e.type === 'SpecialStarted')?.move, SKILL_MOVE.pommel);
  for (let i = 0; i < 200; i++) d = stepDuel(d as never, [idle(), idle()]) as never;
  assert.equal(d.fighters[0]!.skill, 'shove', 'slot 1 restored');
  assert.equal(d.fighters[0]!.slot2Active, undefined);
  assert.ok((d.fighters[0]!.skillCooldown2 ?? 0) > 0, 'slot 2 is cooling');
  assert.equal(d.fighters[0]!.skillCooldown, 0, 'slot 1 is untouched');
});

test('the Match takes ?special2= in sparring, validated against the skill rows', () => {
  const storage = { getItem: () => null, setItem: () => {} };
  const make = (id: string) => {
    (globalThis as { __SANDBOX_SKILL2__?: string }).__SANDBOX_SKILL2__ = id;
    const m = new Match(OPPONENTS.goblin, 'test', { storage, profile: loadProfile(storage, () => 'test').profile, trial: loadTrial(storage), scorecard: loadScorecard(storage), lookSpell: () => ({ id: SPELL_IDS[0]!, skill: 0 }) }, 731, 'longsword', null, 16);   // the look hook is what switches specials on in a sparring test
    m.startSparring({ weapon: 'longsword', difficulty: 'dummy', skill: null });
    return m;
  };
  const ok = make('pommel');
  assert.equal(ok.skill2, 'pommel');
  assert.equal(ok.practice.duel.fighters[0].skill2, 'pommel');
  assert.equal(make('not-a-skill').skill2, undefined);
  delete (globalThis as { __SANDBOX_SKILL2__?: string }).__SANDBOX_SKILL2__;
});
