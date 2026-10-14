// Which named special an opponent casts is a ROW (src/fight/special-set-defs.json, built by src/fight/special-set-rows.ts; recce #2554 group B, slice 3). The move is byte-identical: the canonical JSON
// of SPECIAL_SETS and of specialOf for every opponent at every level 0..50 hashes to what the hand-written literal and the 36 / 41 / 46 thresholds in moves.ts hashed to on slice 2's chain before they went.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { OPPONENTS, SPECIAL_SETS, specialOf } from '../src/fight/moves.ts';
import { SPECIAL_RANK_LEVELS } from '../src/fight/special-set-rows.ts';
import { bossSpecialId } from '../src/fight/special-identity.ts';

test('the special sets and the rank levels built from rows equal the old literal and thresholds', () => {
  const table: Record<string, (string | null)[]> = {};
  for (const id of Object.keys(OPPONENTS)) { table[id] = []; for (let level = 0; level <= 50; level++) table[id]!.push(specialOf(id as keyof typeof OPPONENTS, level)); }
  assert.equal(createHash('sha256').update(JSON.stringify({ SPECIAL_SETS, table })).digest('hex'), '89cccac0b4373a856b500b1d3f78cc4df3fc20180c591e83d6418dd3804d8c0c');
  assert.deepEqual([...SPECIAL_RANK_LEVELS], [36, 41, 46]);
  assert.equal(Object.keys(SPECIAL_SETS).length, 10);
});

test('every special in a set row has a boss id, and a name no row has gets none', () => {
  for (const [opponent, specials] of Object.entries(SPECIAL_SETS)) for (const name of specials) assert.ok(bossSpecialId(name), `${opponent}: ${name} has no boss special id (special-identity.ts)`);
  for (const name of ['unknown', 'constructor', 'toString']) assert.equal(bossSpecialId(name), null);
  assert.equal(specialOf('constructor' as keyof typeof OPPONENTS, 46), null, 'an inherited property is not an opponent');
});

test('no src/fight file keeps a SPECIAL_SETS object literal: the rows are the one source', () => {
  for (const f of readdirSync(new URL('../src/fight/', import.meta.url)).filter((n) => n.endsWith('.ts'))) {
    const src = readFileSync(new URL(`../src/fight/${f}`, import.meta.url), 'utf8');
    assert.ok(!/(?:const|let|var)\s+SPECIAL_SETS\s*(?::[^=]+)?=\s*\{\s*\n?\s*\w+:\s*\[/.test(src), `${f} must not hand-write SPECIAL_SETS`);
  }
});
