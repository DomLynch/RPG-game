import test from 'node:test';
import assert from 'node:assert/strict';
import { cloudProfile, fighterDetails, readAdmin } from '../src/cloud-profile.ts';
import type { SupabaseClient } from '@supabase/supabase-js';

test('cloud saves carry the editable practice details and the client-reported mark count, never device identity', () => {
  assert.deepEqual(fighterDetails({ version: 1, id: 'forged-owner', name: ' Aldren\n', encounter: 'goblin', career: { victoryMarks: 12 } }), { display_name: 'Aldren', encounter: 'goblin', victory_marks: 12, loot: { owned: [], equipped: {} } });
  assert.deepEqual(fighterDetails({ version: 1, id: 'guest-123', name: '' }), { display_name: 'Wanderer', encounter: null, victory_marks: 0, loot: { owned: [], equipped: {} } });
});
test('a malformed remote fighter cannot corrupt a local save', () => {
  const row = { display_name: 'Aldren', encounter: 'goblin', revision: 1, victory_marks: 4, loot: { owned: [], equipped: {} } };
  assert.deepEqual(cloudProfile(row), row);
  for (const value of [null, {}, { ...row, display_name: '\n' }, { ...row, encounter: 'admin' }, { ...row, revision: 0 }, { ...row, revision: 1.5 }, { ...row, revision: Number.MAX_SAFE_INTEGER + 1 },
    { ...row, victory_marks: -1 }, { ...row, victory_marks: 1.5 }, { ...row, victory_marks: undefined }, { ...row, victory_marks: '4' }, { ...row, loot: undefined }, { ...row, loot: 'x' }]) {
    assert.throws(() => cloudProfile(value), /Invalid saved fighter/);
  }
});
test('admin membership is read from the admins roster for the signed-in account only, and a read error is surfaced', async () => {
  const calls: unknown[][] = [];
  const db = (row: unknown, error: unknown = null) => ({ from: (table: string) => ({ select: (cols: string) => ({ eq: (col: string, value: string) => ({
    maybeSingle: async () => { calls.push([table, cols, col, value]); return { data: row, error }; } }) }) }) }) as unknown as SupabaseClient;
  assert.equal(await readAdmin(db({ user_id: 'owner-1' }), 'owner-1'), true);
  assert.deepEqual(calls[0], ['admins', 'user_id', 'user_id', 'owner-1']);
  assert.equal(await readAdmin(db(null), 'owner-1'), false);
  assert.equal(await readAdmin(db({ user_id: 'someone-else' }), 'owner-1'), false);
  await assert.rejects(readAdmin(db(null, Error('offline')), 'owner-1'), /offline/);
});
