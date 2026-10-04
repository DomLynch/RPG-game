import assert from 'node:assert/strict';
import test from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fightResultRow, postFightResult } from '../src/fight-results.ts';
import { PORTRAIT_KEYS } from '../src/legends.ts';

test('fight results: a legend fight becomes one row keyed like the wall, with no user id', () => {
  const row = fightResultRow('goblin', 1, 'win')!;
  assert.ok(PORTRAIT_KEYS.includes(row.opponent_key), `${row.opponent_key} is a real wall key`);
  assert.deepEqual(Object.keys(row).sort(), ['kind', 'opponent_gear', 'opponent_key', 'opponent_level', 'opponent_name', 'result']);
  assert.equal(row.kind, 'ai'); assert.equal(row.result, 'win');
  assert.ok(row.opponent_name.length >= 1 && row.opponent_name.length <= 40);
  assert.equal(fightResultRow('goblin', 0, 'win'), null);
});

test('fight results: the post goes to fight_results; a failing client never throws', async () => {
  const posted: unknown[] = [];
  const db = { from: (table: string) => ({ insert: (row: unknown) => { posted.push([table, row]); return Promise.resolve({ error: null }); } }) } as unknown as SupabaseClient;
  const row = fightResultRow('goblin', 1, 'loss');
  await postFightResult(db, row);
  assert.deepEqual(posted, [['fight_results', row]]);
  await postFightResult(db, null);
  assert.equal(posted.length, 1);
  await postFightResult({ from: () => { throw new Error('offline'); } } as unknown as SupabaseClient, row);
});
