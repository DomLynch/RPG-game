// Many-on-one (Combat, RV73 / WSV49): (A) the hero's foe is the creature he faces at ready, so a joiner is hittable; (B) the Nth creature on one hero lands a percent of its blow (swarm-defs.json slots, Duel.crowd).
// Donors: EQEmu hate_list.cpp / mob_ai.cpp (the most-hated target, the leash from the spawn) and AzerothCore CreatureAI::EnterEvadeMode, SHAPE ONLY; the cut is the 10-13 work on combat/many-on-one @70c3a2582.
import test from 'node:test';
import assert from 'node:assert/strict';
import { crowdPercent, SLOT_ROWS } from '../src/fight/roll.ts';
import { creature, newWorld, pairs, player, stepCombat, type World } from '../src/fight/world.ts';

const STILL = { x: 0, z: 0 };
const faceTo = (w: World, id: string): World => { const h = w.fighters[0]!, t = w.fighters.find((f) => f.id === id)!; return { ...w, fighters: w.fighters.map((f, i) => (i === 0 ? { ...f, facing: Math.atan2(t.x - h.x, t.z - h.z) } : f)) }; };
const foeOf = (w: World): string | undefined => pairs(w).find((p) => p.player === 'hero' && p.primary)?.foe;
const boosted = (f: ReturnType<typeof player>) => { f.health = f.maxHealth = 1e6; return f; };

test('the crowd cut rows: 1st attacker full, 2nd half, 3rd and later 30 percent, PvP the same, past the last row the last row', () => {
  assert.deepEqual([1, 2, 3, 4, 9].map((s) => crowdPercent(s, 'mob')), [100, 50, 30, 30, 30]);
  assert.deepEqual([1, 2, 3, 4].map((s) => crowdPercent(s, 'pvp')), [100, 50, 30, 30]);
  assert.ok(SLOT_ROWS.every((r) => r.percent >= 1 && r.percent <= 100));
});

test('retarget: at ready the hero\'s foe is the creature he faces inside the cone, a joiner can be chosen, and the old foe becomes a joiner (not dropped)', () => {
  let w = newWorld([boosted(player('hero', 0, 0, 0, 10)), creature('a', 'goblin', 0, 1.8, Math.PI), creature('b', 'goblin', 1.8, 0, -Math.PI / 2)]);
  w = faceTo(w, 'a'); for (let k = 0; k < 20; k++) w = stepCombat(w, { hero: STILL }, 1 / 60).world;
  assert.equal(foeOf(w), 'a', 'he faces a: a is his foe');
  assert.ok(pairs(w).some((p) => p.foe === 'b' && !p.primary), 'b is a joiner on him');
  for (let k = 0; k < 90; k++) { w = faceTo(w, 'b'); w = stepCombat(w, { hero: STILL }, 1 / 60).world; if (foeOf(w) === 'b') break; }
  assert.equal(foeOf(w), 'b', 'he turned to b at ready: b is his foe now');
  assert.ok(pairs(w).some((p) => p.foe === 'a' && !p.primary), 'a stays on him as a joiner');
});

test('retarget is gated: a hero facing neither creature keeps his foe (no swap outside the cone)', () => {
  let w = newWorld([boosted(player('hero', 0, 0, 0, 10)), creature('a', 'goblin', 0, 1.8, Math.PI), creature('b', 'goblin', 1.8, 0, -Math.PI / 2)]);
  w = faceTo(w, 'a'); for (let k = 0; k < 20; k++) w = stepCombat(w, { hero: STILL }, 1 / 60).world;
  w = { ...w, fighters: w.fighters.map((f, i) => (i === 0 ? { ...f, facing: Math.PI } : f)) };   // looking away from both
  for (let k = 0; k < 60; k++) w = stepCombat(w, { hero: STILL }, 1 / 60).world;
  assert.equal(foeOf(w), 'a');
});

test('the Nth attacker lands its slot\'s percent: a creature as the hero\'s second attacker hits for about half of what it does as his only foe', () => {
  const blows = (ids: string[]): Map<string, number[]> => {
    let w = newWorld([boosted(player('hero', 0, 0, 0, 10)), ...ids.map((id, i) => creature(id, 'boar', [0, 1.4, -1.4][i]!, [1.6, 1.8, 1.8][i]!, Math.PI))]);
    const dealt = new Map<string, number[]>();
    for (let k = 0; k < 60 * 40; k++) { const r = stepCombat(w, { hero: STILL }, 1 / 60); w = r.world; for (const e of r.events) if (e.type === 'Hit' && e.victim === 'hero') dealt.set(e.attacker, [...(dealt.get(e.attacker) ?? []), e.damage]); }
    return dealt;
  };
  const solo = blows(['a']).get('a')!, two = blows(['a', 'b']);
  const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  assert.ok(solo.length >= 3, 'the solo boar lands blows');
  const second = [...two.entries()].filter(([id]) => id === 'b').flatMap(([, xs]) => xs);
  assert.ok(second.length >= 3, 'the second boar lands blows');
  assert.ok(mean(second) < mean(solo) * 0.75, `the joiner's mean blow ${mean(second).toFixed(1)} is cut well below the solo mean ${mean(solo).toFixed(1)}`);
});
