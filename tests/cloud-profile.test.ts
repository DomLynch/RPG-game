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

// GPT audit 2026-09-22 (A): wearing a piece or receiving its Watch link changed nothing the save predicate compared, so a signed-in
// fighter's equip never reached the cloud. Every part of the loot now counts.
import { createSaveQueue, profileDiffers } from '../src/cloud-profile.ts';
import type { Profile } from '../src/profile.ts';
test('the save predicate sees equip, unequip and provenance-only changes, and stays quiet when nothing changed', () => {
  const cloud = { display_name: 'Aldren', encounter: 'goblin' as const, revision: 3, victory_marks: 4, loot: { owned: ['goblin.Body' as const], equipped: {} } };
  const base: Profile = { version: 1, id: 'dev', name: 'Aldren', encounter: 'goblin', career: { victoryMarks: 4 }, loot: { owned: ['goblin.Body'], equipped: {} } };
  assert.equal(profileDiffers(base, cloud), false, 'identical → nothing to save');
  assert.equal(profileDiffers({ ...base, loot: { owned: ['goblin.Body'], equipped: { chest: 'goblin.Body' } } }, cloud), true, 'equip only');
  const worn = { ...cloud, loot: { owned: ['goblin.Body' as const], equipped: { chest: 'goblin.Body' as const } } };
  assert.equal(profileDiffers(base, worn), true, 'unequip only');
  const taken = { 'goblin.Body': { opponent: 'goblin' as const, attempt: 2, healthLeft: 40, recordId: 'AbCdEfGh', day: '2026-09-22' } };
  assert.equal(profileDiffers({ ...base, loot: { ...base.loot!, taken } }, cloud), true, 'provenance only (a Watch link arrived)');
  assert.equal(profileDiffers({ ...base, loot: { ...base.loot!, taken } }, { ...cloud, loot: { ...cloud.loot, taken } }), false, 'same provenance, any key order');
  assert.equal(profileDiffers({ ...base, loot: { owned: ['goblin.Body', 'goblin.Arms'], equipped: {} } }, cloud), true, 'a new piece');
  assert.equal(profileDiffers(base, { ...cloud, loot: { owned: ['goblin.Body', 'goblin.Arms'], equipped: {} } }), false, 'the cloud owning more is not a device change');
});
// (B): overlapping saves used to write against the same revision, a guaranteed conflict; now one write is in flight and the latest
// device profile is written once more when it lands.
test('the save queue serialises writes and coalesces to the latest profile', async () => {
  const writes: string[] = []; let release!: () => void;
  const queue = createSaveQueue(profile => { writes.push(profile.name); return new Promise<void>(resolve => { release = resolve; }); });
  let name = 'one';
  const first = queue(() => ({ version: 1, id: 'd', name }));
  name = 'two'; const second = queue(() => ({ version: 1, id: 'd', name }));
  name = 'three'; const third = queue(() => ({ version: 1, id: 'd', name }));
  assert.deepEqual(writes, ['one'], 'only one write in flight');
  assert.equal(second, first, 'callers during a write share its promise');
  release(); await new Promise(r => setTimeout(r, 0));
  assert.deepEqual(writes, ['one', 'three'], 'the follow-up writes the LATEST profile once, not each queued one');
  release(); assert.equal(await third, true);
  const failing = createSaveQueue(async () => { throw Error('conflict'); });
  assert.equal(await failing(() => ({ version: 1, id: 'd', name: 'x' })), false, 'a failed write resolves false, nothing retried here');
  assert.equal(await failing(() => ({ version: 1, id: 'd', name: 'y' })), false, 'and the queue is usable again');
});
