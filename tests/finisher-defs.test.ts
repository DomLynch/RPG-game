// Finishers as data: the loaded table is byte-identical to the code tables it replaced, the pick is unchanged, a finisher is one row, and the
// loader refuses a broken table at load.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { FINISHER_POSE, FINISHERS, ROTATION, finisherSeconds, selectFinisher, type FinisherId } from '../src/fight/finishers.ts';
import { loadFinisherDefs } from '../src/fight/finisher-rows.ts';
import type { Manifest } from '../src/core/registry.ts';
import type { Finish } from '../src/fight/duel.ts';
import type { WeaponId } from '../src/fight/moves.ts';
import { duplicateKeys } from '../scripts/lib/json-dup-keys.mjs';

const text = readFileSync(new URL('../src/fight/finisher-defs.json', import.meta.url), 'utf8');
const raw = JSON.parse(text) as { finishers: Record<string, unknown>[] };
const manifest = (JSON.parse(readFileSync(new URL('../src/fight/finisher-defs.manifest.json', import.meta.url), 'utf8')) as { tables: Manifest[] }).tables[0]!;
const sha = (s: string) => createHash('sha256').update(s).digest('hex');

// Both computed on trunk 411fbdf31 BEFORE any of this moved: (a) the resolved table the code built (the rotation, and per finisher its pose
// and finisherSeconds), (b) every selectFinisher pick over a 16 128-kill sweep (victim, draw, 8 moves, 3 locations, 24 headings, 7 previous
// ceremonies, 2 weapon pairs).
const TABLE_BEFORE = 'efe9c96c065809facaffb2b58198844b72ccf4d20d391d6c031db2ac3e493645';
const PICKS_BEFORE = 'c5299a0851dd782dd831bfc1413dbc42c487634bc4cedb4b956d5d8313eda65e';
const resolved = () => JSON.stringify({ rotation: [...ROTATION], rows: Object.keys(FINISHER_POSE).map((id) => ({ id, pose: FINISHER_POSE[id], ...finisherSeconds(id) })) });
function sweep(pick: typeof selectFinisher, rotation: readonly FinisherId[]): string[] {
  const out: string[] = [];
  for (const victim of [0, 1]) for (const draw of [false, true]) for (const move of ['heavy_overhead', 'light_right', 'light_left', 'thrust', 'riposte', 'critical', 'kick', 'skill_pommel']) for (const location of ['head', 'torso', 'legs'])
    for (let h = 0; h < 24; h++) for (const prev of [null, ...rotation, 'quietOne'])
      out.push(String(pick({ victim, draw, move, location, heading: h / 7 } as unknown as Finish, ['longsword', h % 2 ? 'trident' : 'longsword'] as [WeaponId, WeaponId], prev)));
  return out;
}

test('the loaded finishers are byte-identical to the code tables they replaced, and every pick is unchanged', () => {
  assert.equal(sha(resolved()), TABLE_BEFORE);
  const picks = sweep(selectFinisher, ROTATION);
  assert.equal(picks.length, 16128);
  assert.equal(sha(picks.join(',')), PICKS_BEFORE);
});

test('the rows file has no duplicate key and every row names an engine template', () => {
  assert.deepEqual(duplicateKeys(text), [], 'JSON.parse keeps the last of two equal keys silently');
  assert.deepEqual(FINISHERS.rows.map((r) => [r.id, r.template]), [['splitCrown', 'cleave'], ['decapitation', 'sever'], ['runThrough', 'impale'], ['plainDeath', 'fall'], ['quietOne', 'fall'], ['opened', 'bisect'], ['hamstrung', 'hamstring'], ['execution', 'execute']]);
});

test('a ninth finisher is ONE row through the real loader, with no code edit', () => {
  const row = { id: 'gutted', template: 'bisect', rotation: false, pose: 'opened', seconds: 3.5 };
  const t = loadFinisherDefs({ finishers: [...raw.finishers, row] }, manifest);
  assert.equal(t.rows.length, 9);
  assert.equal(t.byId.get('gutted')!.template, 'bisect');
  assert.deepEqual(t.rotation, [...ROTATION], 'a new row is not in the automatic pick until it says so');
  const borrowed = loadFinisherDefs({ finishers: [...raw.finishers, { id: 'gutted', template: 'hamstring', rotation: true, pose: null, secondsFrom: 'opened' }] }, manifest);
  assert.deepEqual(borrowed.rotation, [...ROTATION, 'gutted'], 'rotation: true joins the pool, in file order');
});

test('the loader refuses a duplicate id, an unknown template or pose, a missing field, a bad duration and a secondsFrom naming no measured row, at load', () => {
  const ok = raw.finishers, load = (rows: unknown[]) => loadFinisherDefs({ finishers: rows }, manifest);
  assert.doesNotThrow(() => load(ok));
  assert.throws(() => load([...ok, { ...ok[0] }]), /duplicate-id/);
  assert.throws(() => load([...ok, { id: 'a', template: 'juggle', rotation: false, pose: null, seconds: 2 }]), /template "juggle" is not an engine verb/);
  assert.throws(() => load([...ok, { id: 'a', template: 'fall', rotation: false, pose: 'cartwheel', seconds: 2 }]), /pose "cartwheel"/);
  assert.throws(() => load([...ok, { id: 'a', rotation: false, pose: null, seconds: 2 }]), /missing-field: template is required/);
  assert.throws(() => load([...ok, { id: 'a', template: 'fall', rotation: 'yes', pose: null, seconds: 2 }]), /wrong-type: rotation must be boolean/);
  assert.throws(() => load([...ok, { id: 'a', template: 'fall', rotation: false, pose: null }]), /exactly one of seconds and secondsFrom/);
  assert.throws(() => load([...ok, { id: 'a', template: 'fall', rotation: false, pose: null, seconds: 2, secondsFrom: 'plainDeath' }]), /exactly one of seconds and secondsFrom/);
  assert.throws(() => load([...ok, { id: 'a', template: 'fall', rotation: false, pose: null, seconds: -1 }]), /seconds must be a positive number/);
  assert.throws(() => load([...ok, { id: 'a', template: 'fall', rotation: false, pose: null, secondsFrom: 'nothing' }]), /unknown-ref: secondsFrom = "nothing" is not a finisher id/);
  assert.throws(() => load([...ok, { id: 'a', template: 'fall', rotation: false, pose: null, secondsFrom: 'hamstrung' }]), /must name a row with measured seconds/);
  assert.throws(() => finisherSeconds('nothing'), /unknown finisher "nothing"/);
});
