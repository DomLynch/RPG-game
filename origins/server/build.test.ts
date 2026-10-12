// The build ops (origins/server/build.ts) against a stand-in database that keeps the append-only versions in memory, with the same rules as migration 202610120024. The real-Postgres half is scripts/origins-writer-check.mjs.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Db } from './db.ts';
import { buildGet, buildSet } from './build.ts';
import { Refused } from './errors.ts';
import type { BuildRow } from './store.ts';

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', PC = 'pc:one';
type Row = Omit<BuildRow, 'conflict'>;

function fake(level = 1, mine = true) {
  const versions: Row[] = [];
  const cur = (): Row => versions[versions.length - 1] ?? { level, placed: {}, respreadRank: 1, version: 0 };
  const db: Db = {
    async run(sql, vars = {}) {
      if (!mine && /origins_(get|set)_build/.test(sql)) return 'null';
      if (sql.includes('origins_get_build')) return JSON.stringify(cur());
      if (sql.includes('origins_set_build')) {
        const now = cur();
        if (now.version !== Number(vars.e)) return JSON.stringify({ ...now, conflict: true });
        const next: Row = { level: now.level, placed: JSON.parse(vars.p!), respreadRank: Number(vars.r), version: now.version + 1 };
        versions.push(next);
        return JSON.stringify(next);
      }
      throw Error(`unexpected sql ${sql}`);
    },
  };
  return { db, versions, set level(n: number) { level = n; if (versions.length) versions[versions.length - 1] = { ...versions[versions.length - 1]!, level: n }; } };
}
const ctx = (db: Db) => ({ db, account: A });
const save = (db: Db, placed: Record<string, number>, version: number) => buildSet(ctx(db), { character: PC, placed, version }) as Promise<BuildRow>;
const refused = async (p: Promise<unknown>) => p.then(() => 'ok', (e: unknown) => (e instanceof Refused ? `${e.status}:${e.code ?? ''}` : String((e as Error).message)));

test('build_get reads the default build; build_set stores points on dials and skills and appends a version each time', async () => {
  const f = fake(10);
  assert.deepEqual(await buildGet(ctx(f.db), { character: PC }), { level: 10, placed: {}, respreadRank: 1, version: 0 });
  assert.equal((await save(f.db, { attack: 4, sword: 6 }, 0)).version, 1);
  assert.equal((await save(f.db, { attack: 4, sword: 6, luck: 0 }, 1)).version, 2, 'a zero is not stored but the save is still a new version');
  assert.deepEqual(f.versions.map(v => v.placed), [{ attack: 4, sword: 6 }, { attack: 4, sword: 6 }]);
});

test('every save goes through validateBuild: a past-cap dial, an unknown id, a fractional or over-budget placement are refused and nothing is written', async () => {
  const f = fake(5);
  for (const bad of [{ attack: 51 }, { nonsense: 1 }, { attack: 1.5 }, { attack: 6 }, { attack: -1 }] as Record<string, number>[]) {
    assert.match(String(await refused(save(f.db, bad, 0))), /placed:|400|Error|BadRequest|points|cap|row/i, JSON.stringify(bad));
  }
  assert.equal(f.versions.length, 0);
  await assert.rejects(buildSet(ctx(f.db), { character: PC, placed: { attack: 'x' }, version: 0 }), /whole number/);
  await assert.rejects(buildSet(ctx(f.db), { character: PC, placed: [], version: 0 }), /object/);
});

test('a stale version is a 409 and writes nothing', async () => {
  const f = fake(5);
  await save(f.db, { attack: 1 }, 0);
  assert.equal(await refused(save(f.db, { attack: 2 }, 0)), '409:moved');
  assert.equal(f.versions.length, 1);
});

test('re-spread: free to level 10; at level 11-19 taking a point off is refused, spending a new one is not; the next rank-up allows exactly one', async () => {
  const f = fake(10);
  await save(f.db, { attack: 5 }, 0);
  await save(f.db, { sword: 5 }, 1);   // took 5 off attack: free at level 10
  f.level = 15;
  await save(f.db, { sword: 5, luck: 2 }, 2);   // only spending
  assert.equal(await refused(save(f.db, { sword: 5, luck: 1 }, 3)), '409:respread-spent', 'a re-spread at level 15 is not free');
  f.level = 20;
  const moved = await save(f.db, { sword: 5, luck: 1 }, 3);
  assert.equal(moved.respreadRank, 2, 'the rank-up allows one, and it is recorded');
  assert.equal(await refused(save(f.db, { sword: 5 }, 4)), '409:respread-spent', 'one per rank');
  f.level = 30;
  assert.equal((await save(f.db, { sword: 4 }, 4)).respreadRank, 3);
});

test('re-spread boundaries at levels 10, 11, 20 and 100: free at 10; refused at 11 and at 100 inside a rank; one allowed after a rank-up', async () => {
  const at = async (lv: number) => { const f = fake(lv); await save(f.db, { attack: 5, sword: 5 }, 0); return f; };
  const f10 = await at(10);
  assert.equal((await save(f10.db, { attack: 2, sword: 5 }, 1)).respreadRank, 1, 'level 10 re-spread is free and costs no rank');
  const f11 = await at(11);
  assert.equal(await refused(save(f11.db, { attack: 4, sword: 5, luck: 1 }, 1)), '409:respread-spent', 'level 11 is no longer free');
  assert.equal((await save(f11.db, { attack: 5, sword: 5, luck: 1 }, 1)).version, 2, 'spending only is fine at 11');
  const f20 = await at(20);
  assert.equal((await save(f20.db, { attack: 4, sword: 5, luck: 1 }, 1)).respreadRank, 2, 'level 20 allows one');
  assert.equal(await refused(save(f20.db, { attack: 3, sword: 5, luck: 2 }, 2)), '409:respread-spent', 'and only one');
  const f100 = await at(100);
  assert.equal((await save(f100.db, { attack: 4, sword: 5, luck: 1 }, 1)).respreadRank, 10, 'level 100 is rank 10');
  assert.equal(await refused(save(f100.db, { attack: 3, sword: 5, luck: 2 }, 2)), '409:respread-spent');
});

test('a character that is not the account\'s reads and writes as a 400, and the ops are absent-safe', async () => {
  const f = fake(5, false);
  await assert.rejects(buildGet(ctx(f.db), { character: PC }), /not one of this account/);
  await assert.rejects(save(f.db, {}, 0), /not one of this account/);
  await assert.rejects(buildGet(ctx(f.db), { character: 'nope' }), /character id/);
  const absent: Db = { async run() { return 'absent'; } };
  assert.equal(await refused(buildGet(ctx(absent), { character: PC })), '503:');
});
