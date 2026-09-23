import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadScorecard, recordResult, saveScorecard, scorecardRows, totals } from '../src/scorecard.ts';

const memory = () => { const store = new Map<string, string>(); return { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); } }; };

test('results tally per opponent: wins, losses, left inside losses, draws as fights only', () => {
  const card = loadScorecard(memory());
  recordResult(card, 'veteran', 'win'); recordResult(card, 'veteran', 'loss'); recordResult(card, 'veteran', 'loss', true); recordResult(card, 'goblin', 'draw');
  assert.deepEqual(card.rows.veteran, { fights: 3, wins: 1, losses: 2, left: 1, last: [] });
  assert.deepEqual(card.rows.goblin, { fights: 1, wins: 0, losses: 0, left: 0, last: [] });
  assert.deepEqual(totals(card), { fights: 4, wins: 1, losses: 2, left: 1, last: [] });
});
test('the card survives a reload and a bad or unknown row is dropped, never trusted', () => {
  const storage = memory(); const card = loadScorecard(storage);
  recordResult(card, 'pitborn', 'win'); assert.equal(saveScorecard(storage, card), true);
  assert.deepEqual(loadScorecard(storage).rows, { pitborn: { fights: 1, wins: 1, losses: 0, left: 0, last: [] } });
  storage.setItem('frankendom.scorecard.v1', JSON.stringify({ version: 1, rows: { cyclops: { fights: 9 }, goblin: { fights: -1, wins: 1.5, losses: '2', left: 1 } } }));
  assert.deepEqual(loadScorecard(storage).rows, { goblin: { fights: 0, wins: 0, losses: 0, left: 1, last: [] } });
  for (const raw of ['{broken', 'null', '{"version":2}']) { storage.setItem('frankendom.scorecard.v1', raw); assert.deepEqual(loadScorecard(storage).rows, {}); }
  const blocked = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('quota'); } };
  assert.deepEqual(loadScorecard(blocked).rows, {}); assert.equal(saveScorecard(blocked, card), false);
});
test('journal rows sort by fights, most first; ties keep ladder order; the total stays last', () => {
  const card = loadScorecard(memory());
  recordResult(card, 'goblin', 'loss'); recordResult(card, 'goblin', 'win'); recordResult(card, 'nightborn', 'loss');
  const ladder = [{ id: 'veteran', name: 'V' }, { id: 'executioner', name: 'E' }, { id: 'nightborn', name: 'N' }, { id: 'goblin', name: 'G' }] as const;
  assert.deepEqual(scorecardRows(card, ladder).map((r) => [r.name, r.fights]), [['G', 2], ['N', 1], ['V', 0], ['E', 0], ['All fights', 3]]);
});
test('journal rows list every offered opponent, mark walk-aways, and end with the total', () => {
  const card = loadScorecard(memory());
  recordResult(card, 'veteran', 'loss', true); recordResult(card, 'veteran', 'win');
  const rows = scorecardRows(card, [{ id: 'veteran', name: 'the Veteran' }, { id: 'goblin', name: 'the Goblin' }]);
  assert.deepEqual(rows, [
    { name: 'the Veteran', fights: 2, wins: 1, losses: '1 (1 left)', last: [] },
    { name: 'the Goblin', fights: 0, wins: 0, losses: '0', last: [] },
    { name: 'All fights', fights: 2, wins: 1, losses: '1 (1 left)', last: [] },
  ]);
});
