// The poise ladder (Combat, top-30 item 10, PROVISIONAL numbers, Lead 2026-10-13): a creature's poise gains a FLINCH tier between the shrug and the full stagger, and a full stagger buys poise-rest.
// Era-keyed at v54 (poise-era.ts): below it the single threshold. Creatures only: the player keeps poise 0.
import test from 'node:test';
import assert from 'node:assert/strict';
import { stepDuel, type CombatEvent, type Duel } from '../src/fight/duel.ts';
import { OPPONENTS } from '../src/fight/moves.ts';
import { LADDER, flinchTicks, poiseTier } from '../src/fight/poise-ladder.ts';
import { underPoiseLadder, FIRST_POISE_LADDER_VERSION } from '../src/fight/poise-era.ts';
import { act, arena, idle } from './strategies.ts';

test('the rows are the ones Lead ruled: flinch from 1.0x poise, full stagger from 1.5x, flinch = half a stagger, 60 ticks of poise-rest', () => {
  assert.deepEqual({ ...LADDER }, { id: 'ladder', flinchFrom: 1, staggerFrom: 1.5, flinchStagger: 0.5, immunity: 60 });
  assert.equal(FIRST_POISE_LADDER_VERSION, 54);
});

test('poiseTier: under the poise shrugs, up to 1.5x flinches, past it staggers in full; poise-rest turns a flinch into a shrug but never a full stagger', () => {
  const poise = 12;
  assert.deepEqual([11, 12, 17, 18, 30].map((d) => poiseTier(d, poise, false)), ['shrug', 'flinch', 'flinch', 'stagger', 'stagger']);
  assert.deepEqual([11, 12, 17, 18, 30].map((d) => poiseTier(d, poise, true)), ['shrug', 'shrug', 'shrug', 'stagger', 'stagger']);
  assert.equal(flinchTicks(24), 12); assert.equal(flinchTicks(1), 1, 'never under one tick');
});

// A creature of poise 12 (the dwarf) struck by the player's blows in turn; returns the stagger the creature took from each landed blow.
const struck = (tier: Duel, blows: number): { staggers: number[]; foe: Duel['fighters'][1]; events: CombatEvent[] } => {
  let d = tier; const staggers: number[] = [], events: CombatEvent[] = [];
  for (let t = 0, thrown = 0, settle = 0; t < 900 && settle < 60; t++) {
    const ready = d.fighters[0].phase === 'ready' && !d.fighters[0].stun;
    d = stepDuel(d, [ready && thrown < blows && t % 40 === 0 ? act('light') : idle(), idle()]); if (thrown >= blows) settle++;
    for (const e of d.events) { events.push(e); if (e.type === 'Staggered' && e.actor === 1) staggers.push(e.ticks ?? 0); if (e.type === 'AttackStarted' && e.actor === 0) thrown++; }
  }
  return { staggers, foe: d.fighters[1], events };
};
const dwarf = (): Duel => { const d = arena(OPPONENTS.dwarf); d.fighters[0].phase = 'ready'; return d; };

test('creature fight: a blow in the flinch band staggers him for half, and the same blow below v54 staggers in full; the player is untouched', () => {
  assert.equal(OPPONENTS.dwarf.poise, 12);
  const now = struck(dwarf(), 1), old = underPoiseLadder(53, () => struck(dwarf(), 1));
  const hit = now.events.find((e) => e.type === 'Hit' && e.target === 1);
  assert.ok(hit, 'the blow landed');
  assert.ok((hit!.damage ?? 0) >= 12, 'a light cut reaches the dwarf\'s poise 12, so it is not a shrug');
  assert.ok((hit!.damage ?? 0) < 18, 'and short of 1.5x, so it is a flinch');
  assert.equal(now.staggers.length, 1); assert.equal(old.staggers.length, 1);
  assert.equal(now.staggers[0], flinchTicks(old.staggers[0]!), 'the flinch is the old stagger scaled by the row');
  assert.equal(OPPONENTS.veteran.poise, 0, 'the veteran has no poise: the ladder never applies');
});

test('a full stagger starts poise-rest and it runs down to nothing; era off leaves no trace on the fighter', () => {
  const heavy = (d: Duel) => { for (let t = 0; t < 600; t++) { d = stepDuel(d, [t === 0 ? act('heavy') : idle(), idle()]); if (d.events.some((e) => e.type === 'Hit' && e.target === 1)) break; } return d; };
  const full = heavy(dwarf());
  assert.ok(full.fighters[1].poiseRest === LADDER.immunity || full.fighters[1].poiseRest === undefined, 'rest starts at the row\'s immunity when the heavy staggers in full');
  let d = full; for (let t = 0; t < LADDER.immunity + 5; t++) d = stepDuel(d, [idle(), idle()]);
  assert.equal(d.fighters[1].poiseRest, undefined, 'and is gone after the row\'s ticks');
  const old = underPoiseLadder(53, () => heavy(dwarf()));
  assert.equal('poiseRest' in old.fighters[1], false, 'below v54 the field never appears, so old fights hash as they did');
});
