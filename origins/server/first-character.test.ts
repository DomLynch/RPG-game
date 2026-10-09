import assert from 'node:assert/strict';
import test from 'node:test';
import { DbError, type Db } from './db.ts';
import { withFirstCharacter } from './handlers.ts';
import type { Snapshot } from './store.ts';

const UID = '0b8e2a6c-1f3d-4c5e-9a7b-2c4d6e8f0a1b', ID = UID.replace(/-/g, '');
const snap = (n: number): Snapshot => ({ marks: 0, career: null, characters: Array.from({ length: n }, (_, i) => ({ id: `pc:x${i}`, name: 'n' })), items: [], quests: [], journal: [], talk: [] });
// A stub that records every created name; `clash` = how many creates raise a unique-name clash first; `racer` = the open after a clash already has a character.
function stub(opts: { clash?: number; racer?: boolean } = {}) {
  const names: string[] = []; let clashes = opts.clash ?? 0, created = false;
  const db: Db = { async run(sql, v = {}) {
    if (/origins_create_character/.test(sql)) {
      names.push(v.n!);
      if (clashes > 0) { clashes--; if (opts.racer) created = true; throw new DbError('23505', 'duplicate key value violates unique constraint'); }
      created = true; return 'pc:new';
    }
    return JSON.stringify(snap(created ? 1 : 0));
  } };
  return { db, names };
}
const ctx = (db: Db) => ({ db, account: UID });

test('an account with a character is returned as it is: nothing is created', async () => {
  const s = stub(); const out = await withFirstCharacter(ctx(s.db), snap(2));
  assert.deepEqual([out.characters.length, s.names], [2, []]);
});

test('a new account gets Wanderer <first 6 of the id>, then the snapshot is re-read with it', async () => {
  const s = stub(); const out = await withFirstCharacter(ctx(s.db), snap(0));
  assert.deepEqual([s.names, out.characters.length], [[`Wanderer ${ID.slice(0, 6)}`], 1]);
});

test('a unique-name clash from a racing open: the account is re-read and the racer\'s character is used (no second create)', async () => {
  const s = stub({ clash: 1, racer: true }); const out = await withFirstCharacter(ctx(s.db), snap(0));
  assert.deepEqual([s.names.length, out.characters.length], [1, 1]);
});

test('a clash with nobody there retries with 8 characters, then the full id; it never fails the open', async () => {
  const s = stub({ clash: 2 }); const out = await withFirstCharacter(ctx(s.db), snap(0));
  assert.deepEqual(s.names, [`Wanderer ${ID.slice(0, 6)}`, `Wanderer ${ID.slice(0, 8)}`, `Wanderer ${ID}`]);
  assert.equal(out.characters.length, 1);
  const all = stub({ clash: 3 }); const none = await withFirstCharacter(ctx(all.db), snap(0));
  assert.equal(none.characters.length, 0, 'three clashes and still nobody: the open answers with no character rather than failing');
});

test('any other database error is not swallowed', async () => {
  const db: Db = { async run() { throw new DbError('O0007', 'origins is not open for this account'); } };
  await assert.rejects(async () => withFirstCharacter(ctx(db), snap(0)), (e: unknown) => e instanceof DbError && e.code === 'O0007');
});
