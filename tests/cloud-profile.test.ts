import test from 'node:test';
import assert from 'node:assert/strict';
import { absorbCloud, cloudProfile, fighterDetails, readAdmin, readStanding, type CloudProfile } from '../src/cloud-profile.ts';
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

test('the server standing is my_standing()\'s marks, and anything else — the function not applied yet, offline, a bad row — is null, never a throw', async () => {
  const calls: unknown[] = [];
  const db = (reply: () => Promise<{ data: unknown; error: unknown }>) => ({ rpc: (fn: string) => { calls.push(fn); return reply(); } }) as unknown as SupabaseClient;
  assert.equal(await readStanding(db(async () => ({ data: [{ marks: 7, owned: [] }], error: null }))), 7);
  assert.deepEqual(calls, ['my_standing']);
  assert.equal(await readStanding(db(async () => ({ data: [{ marks: 0, owned: [] }], error: null }))), 0);   // a real zero is a figure (a converted guest)
  // 202609230001 not applied: PostgREST answers PGRST202 (no such function in its schema cache) — today's hosted project.
  assert.equal(await readStanding(db(async () => ({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.my_standing without parameters' } }))), null);
  assert.equal(await readStanding(db(async () => ({ data: null, error: { code: '42501', message: 'permission denied' } }))), null);
  for (const data of [[], null, [{ marks: -1 }], [{ marks: 1.5 }], [{ marks: '9' }], [{}]]) assert.equal(await readStanding(db(async () => ({ data, error: null }))), null, JSON.stringify(data));
  assert.equal(await readStanding(db(async () => { throw Error('offline'); })), null);
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

test('an older device never lowers the account: what it writes carries the higher mark count and both sides\' loot (audit 2026-09-23)', () => {
  const cloud: CloudProfile = { display_name: 'Aldren', encounter: 'goblin', revision: 3, victory_marks: 20, loot: { owned: ['veteran.Helmet'], equipped: { head: 'veteran.Helmet' } } };
  // The reproduced defect: a device that last synced at 10 marks renames the fighter; the ordinary refresh saw a difference and wrote the whole fighter.
  const stale: Profile = { version: 1, id: 'device-a', name: 'Aldren the Bold', encounter: 'goblin', career: { victoryMarks: 10 }, loot: { owned: ['goblin.Body'], equipped: {} } };
  const written = fighterDetails(absorbCloud(stale, cloud));
  assert.equal(written.victory_marks, 20, 'the account\'s 20 marks survive a write from a device at 10');
  assert.deepEqual([...written.loot.owned].sort(), ['goblin.Body', 'veteran.Helmet'], 'loot is the union: the device\'s new piece joins, the account\'s piece stays');
  assert.equal(written.display_name, 'Aldren the Bold', 'the rename is the device\'s to send'); assert.equal(written.encounter, 'goblin');
  assert.deepEqual(written.loot.equipped, {}, 'the equipped set stays the device\'s (unequipping is a change the device makes)');
  // A device behind on marks alone has nothing to send once absorbed: no write, so no revision churn.
  const behind: Profile = { version: 1, id: 'device-b', name: 'Aldren', encounter: 'goblin', career: { victoryMarks: 10 }, loot: { owned: ['veteran.Helmet'], equipped: { head: 'veteran.Helmet' } } };
  assert.equal(profileDiffers(absorbCloud(behind, cloud), cloud), false);
  // Nothing on either side: no career key is invented, and an empty loot stays absent.
  const fresh: Profile = { version: 1, id: 'device-c', name: 'Wanderer' };
  const empty: CloudProfile = { display_name: 'Wanderer', encounter: null, revision: 1, victory_marks: 0, loot: { owned: [], equipped: {} } };
  assert.deepEqual(absorbCloud(fresh, empty), fresh);
  assert.equal(absorbCloud(fresh, cloud).career?.victoryMarks, 20, 'a fresh device takes the account\'s marks');
});

test('a refresh keeps the declined-loot history on both sides (merged, deduplicated, capped oldest-first)', async () => {
  const { DECLINED_KEPT } = await import('../src/loot.ts');
  const kill = (attempt: number, day: string) => ({ opponent: 'goblin' as const, attempt, healthLeft: 40, recordId: null, day });
  const cloud: CloudProfile = { display_name: 'Aldren', encounter: 'goblin', revision: 3, victory_marks: 5, loot: { owned: ['veteran.Helmet'], equipped: {}, declined: [kill(1, '2026-09-20')] } };
  const device: Profile = { version: 1, id: 'd', name: 'Aldren', encounter: 'goblin', career: { victoryMarks: 5 }, loot: { owned: ['veteran.Helmet'], equipped: {}, declined: [kill(1, '2026-09-20'), kill(2, '2026-09-23')] } };
  assert.equal(profileDiffers(device, cloud), true, 'a refused offer the cloud lacks is a change to save');
  const absorbed = absorbCloud(device, cloud);
  assert.deepEqual(absorbed.loot!.declined, [kill(1, '2026-09-20'), kill(2, '2026-09-23')], 'the union, the shared kill once');
  assert.equal(profileDiffers(absorbed, { ...cloud, loot: absorbed.loot! }), false, 'once written, nothing further to send');
  // The reported defect: the cloud holds history the device never saw; the refresh must not drop it.
  const bare: Profile = { ...device, loot: { owned: ['veteran.Helmet'], equipped: {} } };
  assert.deepEqual(absorbCloud(bare, cloud).loot!.declined, [kill(1, '2026-09-20')]);
  // Capped: the newest DECLINED_KEPT survive whichever side holds them.
  const old = Array.from({ length: DECLINED_KEPT }, (_, i) => kill(i + 10, '2026-09-01'));
  const merged = absorbCloud({ ...device, loot: { owned: ['veteran.Helmet'], equipped: {}, declined: [kill(99, '2026-09-23')] } }, { ...cloud, loot: { ...cloud.loot, declined: old } }).loot!.declined!;
  assert.equal(merged.length, DECLINED_KEPT); assert.equal(merged.at(-1)!.attempt, 99, 'the device\'s newest kill is kept, the cloud\'s oldest dropped');
});
