import { initialPractice } from '../src/combat.ts';
import { OPPONENTS } from '../src/moves.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { formatCard, loadTrial, recordFight, recordPractice, recordRematch, saveTrial } from '../src/trial.ts';

const memory = (initial?: string) => { let value = initial ?? null; return { getItem: () => value, setItem: (_k: string, v: string) => { value = v; } }; };
const empty = { fights: 0, wins: 0, rematches: 0, ticks: 0, dealt: 0, taken: 0, active: 0 };

test('the control trial survives storage that is missing, corrupt or hostile, and round-trips through save', () => {
  assert.deepEqual(loadTrial(memory()), { card: empty });
  assert.deepEqual(loadTrial(memory('{not json')), { card: empty });
  assert.deepEqual(loadTrial(memory(JSON.stringify({ card: { fights: 'x' } }))), { card: empty });
  const storage = memory(), trial = loadTrial(storage); recordFight(trial, true, 1800, 100, 43); recordRematch(trial);
  assert.equal(saveTrial(storage, trial), true); assert.deepEqual(loadTrial(storage), trial);
  assert.equal(saveTrial({ getItem: () => null, setItem: () => { throw Error('quota'); } }, trial), false);
});

test('a card saved by the per-scheme trial loads as its thumb-cluster tally; the retired ring numbers are dropped', () => {
  const old = { scheme: 'ring8', card: { cluster: { fights: 1, wins: 1, rematches: 0, ticks: 900, dealt: 100, taken: 20 }, ring8: { fights: 2, wins: 0, rematches: 0, ticks: 1, dealt: 1, taken: 1 } } };
  assert.deepEqual(loadTrial(memory(JSON.stringify(old))), { card: { fights: 1, wins: 1, rematches: 0, ticks: 900, dealt: 100, taken: 20, active: 0 } }, 'a card saved before the wall-clock field loads with 0');
  assert.deepEqual(loadTrial(memory(JSON.stringify({ scheme: 'ring8', card: { ring8: old.card.ring8 } }))), { card: empty }, 'a ring-only card is a fresh tally');
});

test('the scorecard reads as one line with average duel length in seconds', () => {
  const trial = loadTrial(memory());
  assert.equal(formatCard(trial), 'No fights recorded yet.');
  recordRematch(trial);
  assert.equal(formatCard(trial), '0 fights · 0 won · 1 rematches · 0 s avg · dealt 0 / taken 0');
  recordFight(trial, false, 1500, 60, 100); recordFight(trial, true, 2100, 100, 70);
  assert.equal(formatCard(trial), '2 fights · 1 won · 1 rematches · 30 s avg · dealt 160 / taken 170', 'no wall-clock recorded: simulation seconds only');
  // Real time runs beside the simulation's: hit-stop and long frames make it longer than the tick count says.
  const timed = loadTrial(memory()); recordFight(timed, true, 1800, 100, 30, 33400);
  assert.equal(formatCard(timed), '1 fights · 1 won · 0 rematches · 30 s avg (33 s real) · dealt 100 / taken 30');
});

test('scorecard uses each fighter ceiling, including the 190 HP Pitborn', () => {
  const trial = loadTrial(memory());
  const practice = initialPractice(731, OPPONENTS.pitborn);
  practice.health = 170;
  recordPractice(trial, practice, 1000);
  assert.equal(trial.card.dealt, 20, 'must not record -20');
  practice.health = 0; practice.maxHealth = 180; practice.playerHealth = 160;
  practice.finish = { victim: 1, location: 'torso', move: 'light_right', heading: 0 };
  recordPractice(trial, practice, 2000);
  assert.equal(trial.card.dealt, 210, 'the kill adds all 190 HP');
  assert.equal(trial.card.taken, 20); assert.equal(trial.card.wins, 1);
});
