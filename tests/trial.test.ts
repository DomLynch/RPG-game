import test from 'node:test';
import assert from 'node:assert/strict';
import { LABELS, SCHEMES, formatCard, loadTrial, recordFight, recordRematch, saveTrial } from '../src/trial.ts';

const memory = (initial?: string) => { let value = initial ?? null; return { getItem: () => value, setItem: (_k: string, v: string) => { value = v; } }; };

test('the control trial survives storage that is missing, corrupt or hostile, and round-trips through save', () => {
  assert.deepEqual(loadTrial(memory()), { scheme: 'buttons', card: {} });
  assert.deepEqual(loadTrial(memory('{not json')), { scheme: 'buttons', card: {} });
  assert.deepEqual(loadTrial(memory(JSON.stringify({ scheme: 'jetpack', card: { flick: { fights: 'x' }, drag: { fights: 1, wins: 1, rematches: 0, ticks: 900, dealt: 100, taken: 20 } } }))), { scheme: 'buttons', card: { drag: { fights: 1, wins: 1, rematches: 0, ticks: 900, dealt: 100, taken: 20 } } });
  const storage = memory(), trial = loadTrial(storage); trial.scheme = 'charge'; recordFight(trial, 'charge', true, 1800, 100, 43); recordRematch(trial, 'charge');
  assert.equal(saveTrial(storage, trial), true); assert.deepEqual(loadTrial(storage), trial);
  assert.equal(saveTrial({ getItem: () => null, setItem: () => { throw Error('quota'); } }, trial), false);
  assert.equal(SCHEMES.length, 6); for (const s of SCHEMES) assert.ok(LABELS[s]);
});

test('the scorecard reads as one line per played scheme with average duel length in seconds', () => {
  const trial = loadTrial(memory());
  assert.match(formatCard(trial), /^No fights recorded yet/);
  recordFight(trial, 'flick', false, 1500, 60, 100); recordFight(trial, 'flick', true, 2100, 100, 70); recordRematch(trial, 'flick'); recordRematch(trial, 'buttons');
  assert.equal(formatCard(trial), 'buttons — 0 fights · 0 won · 1 rematches · 0 s avg · dealt 0 / taken 0\ndisc · flick (v1) — 2 fights · 1 won · 1 rematches · 30 s avg · dealt 160 / taken 170');
});
