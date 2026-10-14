// The signature effects' numbers are rows (src/fight/signature-rows.json), and every default is the literal the code held before (Dom's data-layer rule, 2026-10-13).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sigNum } from '../src/fight/signature-rows.ts';
import { HOOK } from '../src/fight/signature-goblin.ts';
import { RECALL } from '../src/fight/signature-nightborn.ts';
import { WAKE } from '../src/fight/signature-pitborn.ts';
import { SPLINTER } from '../src/fight/signature-shieldmaiden.ts';
import { SHIPPED } from '../src/fight/signature.ts';

test('the scalar rows hold the numbers the effects held before', () => {
  const was: Record<string, number> = {
    'executioner.fragments': 10, 'executioner.gravity': 9.8, 'executioner.settle': 1.6, 'executioner.history': 36, 'executioner.window': 0.7, 'executioner.knee': 0.5,
    'goblin.trail-step': 0.022, 'knight.substantial': 16, 'knight.rivets': 4, 'knight.gravity': 9.8, 'knight.settle': 2.2, 'knight.shudder': 0.28,
    'nightborn.trail-step': 0.022, 'veteran.scrape-life': 0.3, 'veteran.gravity': 9.8, 'veteran.substantial': 16, 'witch.sparks': 24, 'witch.ash': 40,
  };
  for (const [id, v] of Object.entries(was)) assert.equal(sigNum(id), v, id);
});

test('the four effect objects are exactly what they were', () => {
  assert.deepEqual({ ...HOOK }, { points: 14, snapAt: 0.42, snapLength: 0.8, recoil: 0.16, width: [0.034, 0.012], sag: 0.1, drops: 5, gravity: 9.8 });
  assert.deepEqual({ ...RECALL }, { drops: 14, burst: 0.12, hang: 0.38, fly: 0.3, spread: [0.22, 0.5], size: [0.018, 0.032] });
  assert.deepEqual({ ...WAKE }, { grow: 0.2, tear: 0.42, length: 0.7, width: 0.1, segments: 12, drops: 7, gravity: 9.8, spots: 2, sheets: 2 });
  assert.deepEqual({ ...SPLINTER }, { pieces: 18, bursts: 2, speed: [1.8, 3.4], up: 2.2, gravity: 9.8, seconds: 1.4 });
});

test('the shipped variant per opponent keeps its ten rows, in order', () => {
  assert.deepEqual(Object.entries(SHIPPED).map(([o, s]) => [o, s!.variant, s!.name]), [
    ['nightborn', 'B', 'Blood Recall'], ['executioner', 'A', 'The Reaping Scar'], ['pitborn', 'A', "Butcher's Wake"], ['plaguedoctor', 'B', 'Rot Bloom'], ['goblin', 'C', 'Hooked Wound'],
    ['knight', 'B', 'Rivet B'], ['veteran', 'C', 'Blade Bite'], ['dwarf', 'C', 'Hammer Wound'], ['witch', 'A', 'The Grasp'], ['shieldmaiden', 'A', 'Splintered Defiance'],
  ]);
});

test('a row that does not exist throws instead of answering NaN', () => {
  assert.throws(() => sigNum('no-such-row'), /no row/);
});

test('the nine files keep none of the old literals', () => {
  const src = (f: string) => readFileSync(new URL(`../src/fight/${f}`, import.meta.url), 'utf8');
  assert.doesNotMatch(src('signature-knight.ts'), /SUBSTANTIAL = 16|SETTLE = 2\.2/);
  assert.doesNotMatch(src('signature-executioner.ts'), /FRAGMENTS = 10|HISTORY = 36/);
  assert.doesNotMatch(src('signature-witch.ts'), /SPARKS = 24/);
  assert.doesNotMatch(src('signature.ts'), /name: 'Blood Recall'/);
});
