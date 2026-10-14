// The Bounty hazards are rows (hazards.json), not a name list: the two old hazards in order with the exact lines the player read, the validators accept only rows, and a new hazard is one row.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { twistText } from '../preview/bounty.ts';
import { HAZARDS, HAZARD_ROWS } from './load.ts';

test('the hazard rows keep the old list and wording; an unknown hazard has no row; a new hazard is one row with no code', () => {
  assert.deepEqual([...HAZARDS], ['embers', 'breaking-planks']);
  assert.equal(twistText({ kind: 'hazard', hazard: 'embers', stillSeconds: 2 }), 'Embers: the floor burns whoever stands still for 2 s');
  assert.equal(twistText({ kind: 'hazard', hazard: 'breaking-planks', stillSeconds: 5 }), 'Breaking planks: they give under whoever stands still for 5 s');
  const rows = HAZARD_ROWS as Record<string, object>;
  rows.tar = { order: 3, text: 'Tar: the floor holds whoever stands still for {s} s' };
  try { assert.equal(twistText({ kind: 'hazard', hazard: 'tar', stillSeconds: 4 }), 'Tar: the floor holds whoever stands still for 4 s'); } finally { delete rows.tar; }
  assert.equal(twistText({ kind: 'hazard', hazard: 'tar', stillSeconds: 4 }), '', 'a hazard with no row reads nothing, and the validators refuse it before it gets here');
});
