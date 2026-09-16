import test from 'node:test';
import assert from 'node:assert/strict';
import { LABELS, SCHEMES, formatCard, loadTrial, recordFight, recordRematch, saveTrial } from '../src/trial.ts';

const memory = (initial?: string) => { let value = initial ?? null; return { getItem: () => value, setItem: (_k: string, v: string) => { value = v; } }; };

test('the control trial survives storage that is missing, corrupt or hostile, and round-trips through save', () => {
  assert.deepEqual(loadTrial(memory()), { scheme: 'cluster', card: {} });
  assert.deepEqual(loadTrial(memory('{not json')), { scheme: 'cluster', card: {} });
  assert.deepEqual(loadTrial(memory(JSON.stringify({ scheme: 'sectors', card: { flick: { fights: 'x' }, cluster: { fights: 1, wins: 1, rematches: 0, ticks: 900, dealt: 100, taken: 20 }, drag: { fights: 2, wins: 0, rematches: 0, ticks: 1, dealt: 1, taken: 1 } } }))), { scheme: 'cluster', card: { cluster: { fights: 1, wins: 1, rematches: 0, ticks: 900, dealt: 100, taken: 20, active: 0 } } }, 'a retired scheme falls back to the cluster and its tally is dropped');
  const storage = memory(), trial = loadTrial(storage); trial.scheme = 'flick'; recordFight(trial, 'flick', true, 1800, 100, 43); recordRematch(trial, 'flick');
  assert.equal(saveTrial(storage, trial), true); assert.deepEqual(loadTrial(storage), trial);
  assert.equal(saveTrial({ getItem: () => null, setItem: () => { throw Error('quota'); } }, trial), false);
  assert.equal(SCHEMES.length, 2); for (const s of SCHEMES) assert.ok(LABELS[s]);
});

test('the scorecard reads as one line per played scheme with average duel length in seconds', () => {
  const trial = loadTrial(memory());
  assert.match(formatCard(trial), /^No fights recorded yet/);
  recordFight(trial, 'flick', false, 1500, 60, 100); recordFight(trial, 'flick', true, 2100, 100, 70); recordRematch(trial, 'flick'); recordRematch(trial, 'cluster');
  assert.equal(formatCard(trial), 'thumb cluster — 0 fights · 0 won · 1 rematches · 0 s avg · dealt 0 / taken 0\nweapon disc · flick — 2 fights · 1 won · 1 rematches · 30 s avg · dealt 160 / taken 170', 'no wall-clock recorded: simulation seconds only');
  // Real time runs beside the simulation's: hit-stop and long frames make it longer than the tick count says.
  recordFight(trial, 'cluster', true, 1800, 100, 30, 33400);
  assert.match(formatCard(trial), /thumb cluster — 1 fights · 1 won · 1 rematches · 30 s avg \(33 s real\)/);
  assert.equal(loadTrial(memory(JSON.stringify({ scheme: 'cluster', card: { cluster: { fights: 1, wins: 1, rematches: 0, ticks: 900, dealt: 100, taken: 20 } } }))).card.cluster!.active, 0, 'a card saved before the wall-clock field loads with 0');
});
