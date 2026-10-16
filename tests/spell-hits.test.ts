// Spell combat slice 1 (RV69, WSV45): a spell whose root has a spell-hit-defs.json row lands its SAME total damage as timed pulses (a burst that holds the caster, or a damage over time), era-gated by cast-rules.json hitsFrom.
import test from 'node:test';
import assert from 'node:assert/strict';
import { stepDuel, withSpecials, withSpell, type CombatEvent, type Duel } from '../src/fight/duel.ts';
import { OPPONENTS, RULES } from '../src/fight/moves.ts';
import { CAST, HITS, resolveSpell, spellUsesHits, splitDamage } from '../src/fight/spell-cast.ts';
import { RECORD_VERSION } from '../src/fight/record.ts';
import { act, arena, idle } from './strategies.ts';

const BURST = 'hervor' /* threeBlows L4 */, DOT = 'barghest' /* baying L2 */, PLAIN = 'andvari' /* crack L1: no row */, SEED = 4242, POWER = 500 /* worn spell power: the credit lifts the relative level so the seeded draw lands (a dear spell at skill 100 alone fizzles) */;
const fight = (id: string, version?: number): Duel => {
  let d = withSpecials(arena(OPPONENTS.veteran), 6, 'shove'); d.fighters[0].skillCooldown = 0; d.fighters[1].skillCooldown = 0;
  d = withSpell(d, 0, resolveSpell(id, 100, POWER, version)!, SEED); return d;
};
const run = (d: Duel, ticks: number) => { const ev: CombatEvent[] = []; for (let t = 0; t < ticks; t++) { d = stepDuel(d, [t === 0 ? act('skill') : idle(), idle()]); ev.push(...d.events); } return { d, ev }; };
const landed = (ev: CombatEvent[]) => ev.filter((e) => e.type === 'SpecialLanded');

test('the rows: three roots pulse, every row is a valid root, and the era is a row after the cost cap', () => {
  assert.deepEqual(Object.keys(HITS).sort(), ['ashfall', 'baying', 'threeBlows']);
  assert.ok(CAST.hitsFrom <= RECORD_VERSION && CAST.hitsFrom >= CAST.costCapFrom);
});

test('resolveSpell: a row root pulses from hitsFrom, one landing below it, and a root with no row never pulses', () => {
  assert.deepEqual(resolveSpell(BURST, 100)!.hits, [1, 1, 1]);
  assert.deepEqual(resolveSpell(BURST, 100, 0, CAST.hitsFrom - 1)!.hits, [1], 'a record below the era replays one landing');
  assert.equal(resolveSpell(BURST, 100, 0, CAST.hitsFrom)!.hitEvery, HITS.threeBlows!.every);
  assert.deepEqual(resolveSpell(PLAIN, 100)!.hits, [1]);
  assert.equal(spellUsesHits(BURST), true); assert.equal(spellUsesHits(DOT), true); assert.equal(spellUsesHits(PLAIN), false);
});

test('splitDamage: the pulses add up to exactly the total, however the weights round', () => {
  for (const total of [1, 7, 100, 333, 1000]) for (const ramp of [[1, 1, 1], [2, 2, 1, 1, 1], [1, 1, 1, 1, 1]]) {
    assert.equal(ramp.reduce((s, _, k) => s + splitDamage(ramp, total, k), 0), total);
  }
});

test('a burst lands three pulses every 15 ticks, the same total as the old single landing, and holds the caster until the last', () => {
  const ticks = RULES.special.windup + 60, now = run(fight(BURST), ticks), old = run(fight(BURST, CAST.hitsFrom - 1), ticks);
  const pulses = landed(now.ev), once = landed(old.ev);
  assert.equal(once.length, 1, 'below the era: one landing'); assert.equal(once[0]!.pulse, undefined);
  assert.deepEqual(pulses.map((e) => e.pulse), [0, 1, 2]);
  assert.deepEqual(pulses.slice(1).map((e, k) => e.tick - pulses[k]!.tick), [HITS.threeBlows!.every, HITS.threeBlows!.every]);
  assert.equal(pulses.reduce((s, e) => s + e.damage!, 0), once[0]!.damage, 'the same total, delivered in pulses');
  assert.equal(now.d.fighters[0].volley, undefined, 'the volley is spent');
});

test('a damage over time does not hold the caster, and stops when the target falls', () => {
  const start = fight(DOT), { d } = run(start, RULES.special.windup + 1);
  assert.ok(d.fighters[0].volley, 'the volley runs');
  assert.ok((d.fighters[0].specialRecover ?? 0) <= RULES.special.recovery, 'a DoT adds nothing to the recovery hold');
  const dying = { ...d, fighters: [d.fighters[0], { ...d.fighters[1], health: 0, phase: 'dead' as const }] as typeof d.fighters };
  assert.equal(stepDuel(dying, [idle(), idle()]).fighters[0].volley, undefined, 'a fallen target ends it');
});
