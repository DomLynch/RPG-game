import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { renameAccount } from '../src/core/rename.ts';

type Row = Record<string, unknown>;
// fighter_profiles as the code uses it: select+eq+maybeSingle, and update+eq(user_id)+eq(revision)+select+maybeSingle (no row at that revision = null, like Postgres).
const fake = (row: Row | null, user: string | null = 'user-1') => {
  const writes: Row[] = [];
  const db = {
    auth: { getSession: async () => ({ data: { session: user ? { user: { id: user } } : null } }) },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }) }),
      update: (patch: Row) => ({ eq: () => ({ eq: (_: string, rev: unknown) => ({ select: () => ({ maybeSingle: async () => {
        if (!row || row.revision !== rev) return { data: null, error: null };
        writes.push(patch); Object.assign(row, patch, { revision: (row.revision as number) + 1 }); return { data: row, error: null };
      } }) }) }) }),
    }),
  } as never;
  return { db, writes, row };
};
const saved = (): Row => ({ display_name: 'Aldren', encounter: 'goblin', revision: 4, victory_marks: 9, loot: { owned: ['goblin.Body'], equipped: { body: 'goblin.Body' } } });

test('a signed-in rename writes the new name at the revision it read and leaves marks, opponent and loot as the account had them', async () => {
  const f = fake(saved());
  assert.equal(await renameAccount(f.db, '  Brand  '), 'Brand');
  assert.equal(f.writes.length, 1);
  assert.equal(f.writes[0]!.display_name, 'Brand');
  assert.equal(f.writes[0]!.victory_marks, 9, 'never lowers or changes the account\'s marks');
  assert.equal(f.writes[0]!.encounter, 'goblin');
  assert.deepEqual((f.writes[0]!.loot as { owned: string[] }).owned, ['goblin.Body']);
  assert.equal(f.row!.revision, 5);
});
test('no session, no saved fighter, or a moved revision is null and writes nothing: the caller keeps the name on the device', async () => {
  const none = fake(saved(), null); assert.equal(await renameAccount(none.db, 'X'), null); assert.equal(none.writes.length, 0);
  const empty = fake(null); assert.equal(await renameAccount(empty.db, 'X'), null);
  const row = saved(), moved = fake(row);
  const real = (moved.db as { from: () => { select: () => unknown } }).from;
  (moved.db as { from: unknown }).from = () => { const t = real(); return { ...t, select: () => ({ eq: () => ({ maybeSingle: async () => { row.revision = 99; return { data: { ...row, revision: 4 }, error: null }; } }) }) }; };   // another device saved between the read and the write
  assert.equal(await renameAccount(moved.db, 'X'), null); assert.equal(moved.writes.length, 0);
});
test('a name is cleaned like the Pit\'s (24 characters, no control characters)', async () => {
  const f = fake(saved());
  assert.equal((await renameAccount(f.db, `A\u0007${'b'.repeat(40)}`))!.length, 24);
});
test('the zone page gives the Career card its account save and calls the core, never the table', () => {
  const zone = readFileSync('origins/preview/pit-duel.ts', 'utf8');
  assert.match(zone, /saveName: async \(name\) => \{ const db = await signedIn\(\); return db \? renameAccount\(db, name\) : null; \}/);
  assert.doesNotMatch(zone, /fighter_profiles/);
});
