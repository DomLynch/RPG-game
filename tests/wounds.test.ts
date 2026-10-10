// K5: a creature's wounds are read from its catalogue row (src/fight/wounds.ts), never typed per creature. Pure data side; the draw is src/fight/wounds-fx.ts.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { glbStats } from '../scripts/lib/glb-stats.mjs';
import { CATALOGUE } from '../src/fight/catalogue-rows.ts';
import { createBleeders, dripRate, pickPart, sprayOf, tierAt, unit, woundSpec } from '../src/fight/wounds.ts';

const ember = woundSpec('character:ember-wolf', 'wolf')!, ash = woundSpec('character:ash-wolf', 'wolf')!;

test('a creature finds its row by its character id, else by its body; no wounds row or an unknown creature draws nothing', () => {
  assert.equal(ember.id, 'ember-wolf');
  assert.equal(ash.id, 'wolf', 'the Ash wolf is the wolf row');
  assert.equal(woundSpec('character:cinder-scavenger', 'goblin'), null, 'the goblin has no wounds row: the Pit\'s own gore');
  assert.equal(woundSpec('character:nobody', 'not-a-body'), null);
  assert.equal(woundSpec('character:ember-wolf', 'wolf'), ember, 'cached');
});

test('pickPart: the parts\' weights are the shares, the edges fall where the weights say, and a seeded stream reproduces the shares', () => {
  const total = ember.parts.reduce((n, p) => n + p.weight, 0);
  assert.equal(pickPart(ember, 0).id, ember.parts[0]!.id);
  assert.equal(pickPart(ember, 0.999999).id, ember.parts.at(-1)!.id);
  const counts = new Map<string, number>(); const N = 20000;
  for (let i = 0; i < N; i++) { const id = pickPart(ember, unit(i * 7919 + 1)).id; counts.set(id, (counts.get(id) ?? 0) + 1); }
  for (const p of ember.parts) assert.ok(Math.abs((counts.get(p.id) ?? 0) / N - p.weight / total) < 0.02, `${p.id} share`);
  assert.equal(unit(42), unit(42), 'a seed is a roll');
});

test('tiers and drip: whole above the first tier, deeper below each, drips = bleedRate x spray x size x the tier\'s drip', () => {
  assert.equal(tierAt(ember.wounds, 1), -1); assert.equal(tierAt(ember.wounds, 0.6), -1);
  assert.equal(tierAt(ember.wounds, 0.4), 0); assert.equal(tierAt(ember.wounds, 0.1), 1); assert.equal(tierAt(ember.wounds, 0), 1);
  assert.equal(dripRate(ember, 0.9), 0);
  assert.ok(Math.abs(dripRate(ember, 0.4) - 0.4 * 1 * 0.7 * 0.6) < 1e-9);
  assert.ok(Math.abs(dripRate(ember, 0.1) - 0.4 * 1 * 0.7 * 1.2) < 1e-9);
  assert.deepEqual(sprayOf(ember), { amount: 0.7, start: '#5a0b0a', end: '#1c0403' });
});

test('bleeders: drips accumulate to the rate, marks are earned once per tier and never repeat', () => {
  const b = createBleeders(); let drips = 0, marks = 0;
  for (let i = 0; i < 100; i++) { const r = b.tick('w', ember, 0.4, 0.1); drips += r.drips; marks += r.marks; }   // 10 s in tier 0
  assert.ok(Math.abs(drips - dripRate(ember, 0.4) * 10) <= 1, `drips ${drips}`);
  assert.equal(marks, 1, 'tier 0 has 1 mark');
  marks = 0; for (let i = 0; i < 10; i++) marks += b.tick('w', ember, 0.1, 0.1).marks;
  assert.equal(marks, 1, 'tier 1 has 2 marks, 1 already shown');
  assert.equal(b.tick('w', ember, 0.1, 0.1).marks, 0);
  b.forget('w'); assert.equal(b.tick('w', ember, 0.4, 0.1).marks, 1, 'forgotten: a fresh creature');
  assert.deepEqual(b.tick('whole', ember, 1, 5), { drips: 0, marks: 0 });
});

test('every wounds row reads real tables, and every part bone is a skin joint of the creature\'s engine and world GLBs', () => {
  const rows = CATALOGUE.filter((r) => r.wounds);
  assert.ok(rows.length >= 4, 'wolf, ember wolf, boar, bear');
  for (const r of rows) {
    const w = woundSpec(`character:${r.id}`, r.id)!; assert.ok(w, r.id);
    for (const file of [r.engine.asset, r.world?.asset].filter((x): x is string => !!x)) {
      const have = new Set(glbStats(file).jointNames);
      for (const p of w.parts) for (const bone of p.bones) assert.ok(have.has(bone), `${r.id}: ${bone} (part ${p.id}) is not a joint of ${file}`);
    }
  }
});

test('no per-creature code on the wounds or finisher path: none of these files names a creature; a new creature is a catalogue row', () => {
  for (const f of ['src/fight/wounds.ts', 'src/fight/wounds-fx.ts', 'src/fight/finishers.ts', 'src/fight/finisher-blood.ts']) {
    const src = readFileSync(new URL(`../${f}`, import.meta.url), 'utf8').replace(/\/\/.*$/gm, '');
    assert.ok(!/['"`](wolf|boar|bear|goblin|ember-wolf)['"`]/.test(src), `${f}: names a creature; put it in a row`);
  }
});
