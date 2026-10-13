// The poise ladder (Combat, top-30 item 10, PROVISIONAL numbers, Lead 2026-10-13): a creature's poise gains a FLINCH tier between the shrug and the full stagger, and a full stagger buys poise-rest.
// Era-keyed at v54 (poise-era.ts): below it the single threshold. Creatures only: the player keeps poise 0.
import test from 'node:test';
import assert from 'node:assert/strict';
import { stepDuel, type CombatEvent, type Duel } from '../src/fight/duel.ts';
import { MOVES, OPPONENTS } from '../src/fight/moves.ts';
import { LADDER, flinchTicks, poiseTier } from '../src/fight/poise-ladder.ts';
import { underPoiseLadder, FIRST_POISE_LADDER_VERSION } from '../src/fight/poise-era.ts';
import { act, arena, idle } from './strategies.ts';

test('the rows are the ones Lead ruled: flinch from 1.0x poise, full stagger from 1.1x, flinch = half a stagger, 60 ticks of poise-rest', () => {
  assert.deepEqual({ ...LADDER }, { id: 'ladder', flinchFrom: 1, staggerFrom: 1.1, flinchStagger: 0.5, immunity: 60 });
  assert.equal(FIRST_POISE_LADDER_VERSION, 54);
});

test('poiseTier: under the poise shrugs, up to 1.1x flinches, past it staggers in full; poise-rest turns a flinch into a shrug but never a full stagger', () => {
  const poise = 12;
  assert.deepEqual([11, 12, 13, 14, 18, 30].map((d) => poiseTier(d, poise, false)), ['shrug', 'flinch', 'flinch', 'stagger', 'stagger', 'stagger']);   // 1.1 x 12 = 13.2: 14 staggers in full
  assert.deepEqual([11, 12, 13, 14, 18, 30].map((d) => poiseTier(d, poise, true)), ['shrug', 'shrug', 'shrug', 'stagger', 'stagger', 'stagger']);
  assert.equal(flinchTicks(24), 12); assert.equal(flinchTicks(1), 1, 'never under one tick');
});

// A creature struck by the player's blows in turn (`blow` = the action thrown); returns the stagger the creature took from each landed blow.
const struck = (tier: Duel, blows: number, blow: 'light' | 'kick' | 'heavy' = 'light'): { staggers: number[]; foe: Duel['fighters'][1]; events: CombatEvent[] } => {
  let d = tier; const staggers: number[] = [], events: CombatEvent[] = [];
  for (let t = 0, thrown = 0, settle = 0; t < 900 && settle < 60; t++) {
    const ready = d.fighters[0].phase === 'ready' && !d.fighters[0].stun;
    d = stepDuel(d, [ready && thrown < blows && t % 40 === 0 ? act(blow) : idle(), idle()]); if (thrown >= blows) settle++;
    for (const e of d.events) { events.push(e); if (e.type === 'Staggered' && e.actor === 1) staggers.push(e.ticks ?? 0); if (e.type === 'AttackStarted' && e.actor === 0) thrown++; }
  }
  return { staggers, foe: d.fighters[1], events };
};
const creature = (o: typeof OPPONENTS.dwarf): Duel => { const d = arena(o); d.fighters[0].phase = 'ready'; return d; };

test('flinch band at 1.1x: the boar (poise 4) flinches at a kick (4), the same kick below v54 staggers in full; a light cut (14) staggers him in full; a poise-0 warden is never laddered', () => {
  assert.equal(OPPONENTS.boar.poise, 4);
  const now = struck(creature(OPPONENTS.boar), 1, 'kick'), old = underPoiseLadder(53, () => struck(creature(OPPONENTS.boar), 1, 'kick'));
  assert.ok(now.events.some((e) => e.type === 'Hit' && e.target === 1), 'the kick landed');
  assert.equal(MOVES.kick.damage, 4); assert.equal(poiseTier(MOVES.kick.damage, 4, false), 'flinch', 'it reaches his poise 4 and falls short of 1.1 x 4');
  assert.equal(now.staggers.length, 1); assert.equal(old.staggers.length, 1);
  assert.equal(now.staggers[0], flinchTicks(old.staggers[0]!), 'the flinch is the old stagger scaled by the row');
  const light = struck(creature(OPPONENTS.boar), 1, 'light');
  assert.equal(light.staggers.length, 1); assert.ok(light.staggers[0]! > now.staggers[0]!, 'a light cut (14) is a full stagger, longer than the flinch');
  assert.equal(OPPONENTS.veteran.poise, 0, 'the veteran has no poise: the ladder never applies');
});

test('a full stagger starts poise-rest and it runs down to nothing; era off leaves no trace on the fighter', () => {
  const heavy = (d: Duel) => { for (let t = 0; t < 600; t++) { d = stepDuel(d, [t === 0 ? act('heavy') : idle(), idle()]); if (d.events.some((e) => e.type === 'Hit' && e.target === 1)) break; } return d; };
  const full = heavy(creature(OPPONENTS.dwarf));
  assert.ok(full.fighters[1].poiseRest === LADDER.immunity || full.fighters[1].poiseRest === undefined, 'rest starts at the row\'s immunity when the heavy staggers in full');
  let d = full; for (let t = 0; t < LADDER.immunity + 5; t++) d = stepDuel(d, [idle(), idle()]);
  assert.equal(d.fighters[1].poiseRest, undefined, 'and is gone after the row\'s ticks');
  const old = underPoiseLadder(53, () => heavy(creature(OPPONENTS.dwarf)));
  assert.equal('poiseRest' in old.fighters[1], false, 'below v54 the field never appears, so old fights hash as they did');
});
