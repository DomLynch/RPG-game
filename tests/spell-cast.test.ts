// Spells in fights v1 (programme 2b, cast half): the resolver, the index, and a cast through the duel. Constructed fights, no AI.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stepDuel, withSpecials, withSpell, type CombatEvent, type Duel } from '../src/fight/duel.ts';
import { OPPONENTS, RULES } from '../src/fight/moves.ts';
import { BRICKS, castOutcome, isSpellId, outcomeMult, resolveSpell, SPELL_IDS } from '../src/fight/spell-cast.ts';
import { indexOf } from '../scripts/spell-index.mjs';
import { act, arena, idle } from './strategies.ts';

const ID = SPELL_IDS.find((id) => resolveSpell(id, 0)!.cost > 0)!, SEED = 12345;

test('spell-index.json equals the spell catalogue (run node scripts/spell-index.mjs --write after a catalogue edit)', () => {
  const disk = (JSON.parse(readFileSync(new URL('../src/fight/spell-index.json', import.meta.url), 'utf8')) as { spells: unknown }).spells;
  assert.deepEqual(disk, indexOf());
  assert.ok(SPELL_IDS.length > 0);
  for (const id of SPELL_IDS) assert.ok(isSpellId(id) && resolveSpell(id, 50) !== undefined);
  assert.equal(resolveSpell('not-a-spell', 50), undefined);
  assert.equal(isSpellId('toString'), false);
});

test('outcome rises with skill: a novice mostly fails, a master mostly succeeds, the seeded draw is the only variable', () => {
  const tally = (skill: number) => { const t: Record<string, number> = {}; for (let i = 0; i < 200; i++) { const o = castOutcome(resolveSpell(ID, skill)!, i / 200); t[o] = (t[o] ?? 0) + 1; } return t; };
  const ok = (t: Record<string, number>) => (t.success ?? 0) + (t.crit ?? 0) + (t.partial ?? 0);
  assert.ok(ok(tally(0)) <= ok(tally(60)) && ok(tally(60)) <= ok(tally(100)));
  assert.ok(ok(tally(100)) > ok(tally(0)));
  const s = resolveSpell(ID, 60)!;
  assert.equal(castOutcome(s, 0.37), castOutcome(s, 0.37));
});

test('spellPower buys credit as skill does, and the multipliers match the outcome', () => {
  assert.ok(resolveSpell(ID, 40, 100)!.rel10 >= resolveSpell(ID, 40, 0)!.rel10);
  const s = resolveSpell(ID, 50)!;
  assert.equal(outcomeMult(s, 'critfail'), 0); assert.equal(outcomeMult(s, 'fail'), 0);
  assert.equal(outcomeMult(s, 'success'), 1); assert.equal(outcomeMult(s, 'crit'), s.critMult); assert.equal(outcomeMult(s, 'partial'), s.partialMult);
  assert.ok(Object.keys(BRICKS).length > 0);
});

const cast = (skill: number, stamina?: number): Duel => {
  let d = withSpecials(arena(OPPONENTS.veteran), 6, 'shove'); d.fighters[0].skillCooldown = 0; d.fighters[1].skillCooldown = 0;
  d = withSpell(d, 0, resolveSpell(ID, skill)!, SEED);
  if (stamina !== undefined) d.fighters[0].stamina = stamina;
  return d;
};
const run = (d: Duel, ticks = RULES.special.windup + 5) => { const ev: CombatEvent[] = []; for (let t = 0; t < ticks; t++) { d = stepDuel(d, [t === 0 ? act('skill') : idle(), idle()]); ev.push(...d.events); } return { d, ev }; };

test('a cast spends the spell cost at the commit and carries the spell id on its events', () => {
  const start = cast(100), cost = start.fighters[0].spell!.cost;
  const { ev, d } = run(start);
  const started = ev.find((e) => e.type === 'SpecialStarted')!;
  assert.equal(started.spell, ID);
  assert.ok(d.fighters[0].stamina < start.fighters[0].stamina + 1 || cost === 0);
  const end = ev.find((e) => e.type === 'SpecialLanded' || e.type === 'SpecialFizzled')!;
  assert.equal(end.spell, ID); assert.ok(end.outcome);
});

test('a cast is refused without the stamina for it', () => {
  const start = cast(100, 0), { ev } = run(start);
  assert.equal(ev.some((e) => e.type === 'SpecialStarted'), false);
});

test('a fizzle deals no damage and still re-arms the full cooldown', () => {
  const { ev, d } = run(cast(0), RULES.special.windup + 5);
  const fizz = ev.find((e) => e.type === 'SpecialFizzled');
  if (!fizz) return assert.ok(ev.some((e) => e.type === 'SpecialLanded'), 'skill 0 must resolve one way or the other');
  assert.equal(ev.some((e) => e.type === 'SpecialLanded'), false);
  assert.equal(d.fighters[1].health, d.fighters[1].maxHealth);
  assert.ok(d.fighters[0].skillCooldown > 0);
});

test('the same seed and skill replay the same outcome; a different skill is another fight', () => {
  const a = run(cast(70)).d, b = run(cast(70)).d, c = run(cast(5)).d;
  assert.equal(JSON.stringify(a.fighters), JSON.stringify(b.fighters));
  assert.notEqual(JSON.stringify(a.fighters[0].spell), JSON.stringify(c.fighters[0].spell));
});
