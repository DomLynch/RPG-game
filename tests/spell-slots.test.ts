// Spell slots (spec docs/specs/combat/spell-slots.md, sim PR): slot b on the Fighter, its own cooldown and cost, an empty slot inert, a one-spell fight untouched, and the open-world record carrying cast2.
import test from 'node:test';
import assert from 'node:assert/strict';
import { legal, stepDuel, withSpecials, withSpell, type CombatEvent, type Duel } from '../src/fight/duel.ts';
import { OPPONENTS, RULES } from '../src/fight/moves.ts';
import { SPELL_IDS, resolveSpell } from '../src/fight/spell-cast.ts';
import { ALLOW_DUPLICATE, SHARED_COOLDOWN, SPELL_SLOTS } from '../src/fight/spell-rows.ts';
import { WORLD_SIM_VERSION, packWorldRecord, replayWorldRecord, unpackWorldRecord, type WorldRecord } from '../src/fight/world-record.ts';
import { RECORD_VERSION } from '../src/fight/record.ts';
import { act, arena, idle } from './strategies.ts';

const IDS = SPELL_IDS.filter((id) => resolveSpell(id, 0)!.cost > 0), A = IDS[0]!, B = IDS.find((id) => id !== A)!, SEED = 4242;
const fight = (two: boolean): Duel => {
  let d = withSpecials(arena(OPPONENTS.veteran), 6, 'shove'); d.fighters[0].skillCooldown = 0; d.fighters[1].skillCooldown = 0;
  d = withSpell(d, 0, resolveSpell(A, 100)!, SEED);
  return two ? withSpell(d, 0, resolveSpell(B, 100)!, SEED, 1) : d;
};
const run = (d: Duel, first: 'skill' | 'skill2', ticks: number) => { const ev: CombatEvent[] = []; for (let t = 0; t < ticks; t++) { d = stepDuel(d, [t === 0 ? act(first) : idle(), idle()]); ev.push(...d.events); } return { d, ev }; };

test('the slot rows say two slots, separate cooldowns, no duplicates', () => {
  assert.deepEqual(SPELL_SLOTS.map((s) => s.action), ['skill', 'skill2']);
  assert.equal(SHARED_COOLDOWN, false); assert.equal(ALLOW_DUPLICATE, false);
});

test('slot b casts its own spell, spends its own cost and starts only its own cooldown', () => {
  const start = fight(true), costB = start.fighters[0].spell2!.cost;
  assert.ok(legal(start.fighters[0], 'skill2'));
  const { ev, d } = run(start, 'skill2', RULES.special.windup + 2);
  assert.equal(ev.find((e) => e.type === 'SpecialStarted')!.spell, B);
  assert.equal(ev.find((e) => e.type === 'SpecialLanded' || e.type === 'SpecialFizzled')!.spell, B);
  assert.ok(start.fighters[0].stamina - d.fighters[0].stamina <= costB + 1e-9 || costB === 0);
  assert.equal(d.fighters[0].skillCooldown, 0, 'slot a is untouched');
  assert.ok(d.fighters[0].skillCooldown2! > 0, 'slot b is cooling');
  assert.equal(d.fighters[0].castSlot, undefined);
});

test('after a slot-b cast, slot a can cast as soon as the special recovery ends', () => {
  let { d } = run(fight(true), 'skill2', RULES.special.windup + 2);
  for (let t = 0; t < RULES.special.recovery + 2; t++) d = stepDuel(d, [idle(), idle()]);
  d.fighters[0].stamina = d.fighters[0].maxStamina;
  assert.ok(legal(d.fighters[0], 'skill'), 'slot a is free');
  assert.equal(legal(d.fighters[0], 'skill2'), false, 'slot b is still cooling');
});

test('an empty slot b is inert, and a slot-a cast leaves slot b alone', () => {
  const one = fight(false);
  assert.equal(legal(one.fighters[0], 'skill2'), false);
  const { d } = run(fight(true), 'skill', RULES.special.windup + 2);
  assert.ok(d.fighters[0].skillCooldown > 0); assert.equal(d.fighters[0].skillCooldown2, 0);
});

test('a one-spell fight never grows a slot-b key (byte for byte as before)', () => {
  const { d } = run(fight(false), 'skill', RULES.special.windup + RULES.special.recovery);
  for (const k of ['spell2', 'skillCooldown2', 'castSlot']) assert.equal(k in d.fighters[0], false, k);
});

const hero = { level: 1, weapon: 'longsword' as const, health: RULES.health, stamina: 100, posture: 0, exhausted: false };
const rec = (h: Partial<WorldRecord['hero']>, step: Partial<WorldRecord['steps'][0]>): WorldRecord => ({ rv: RECORD_VERSION, wv: WORLD_SIM_VERSION, hero: { ...hero, ...h }, joins: [], releases: [], steps: [{ pose: { x: 0, z: 0, f: 0 }, guard: false, gd: null, attack: null, roll: null, ...step }] });

test('the open-world record carries cast2 and spell2 through pack and unpack', () => {
  const r = rec({ spell: { id: A, skill: 50 }, spell2: { id: B, skill: 50 } }, { cast2: true });
  assert.deepEqual(unpackWorldRecord(packWorldRecord(r)), r);
  const none = rec({ spell: { id: A, skill: 50 } }, { cast: true }), back = unpackWorldRecord(packWorldRecord(none));
  assert.equal('cast2' in back.steps[0]!, false); assert.equal('spell2' in back.hero, false);
});

test('the replay refuses a slot-b press or spell it cannot honour', () => {
  assert.equal(replayWorldRecord(rec({ spell: { id: A, skill: 50 } }, { cast2: true })).ok, false, 'cast2 without a spell2');
  assert.equal(replayWorldRecord(rec({ spell2: { id: B, skill: 50 } }, {})).ok, false, 'spell2 with an empty slot a');
  assert.equal(replayWorldRecord(rec({ spell: { id: A, skill: 50 }, spell2: { id: A, skill: 50 } }, {})).ok, false, 'the same spell in both slots');
  assert.equal(replayWorldRecord(rec({ spell: { id: A, skill: 50 }, spell2: { id: B, skill: 50 } }, { cast2: true })).ok, true, 'an honest two-slot record');
});
