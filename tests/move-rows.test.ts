// The engine's MOVES and PATHS are rows (src/fight/move-defs.json, built by src/fight/move-rows.ts; recce #2554 group B, slice 2). The move is byte-identical: the canonical JSON of both
// records, key order included, hashes to what the hand-written literals and the light() / skill() helpers in moves.ts hashed to on slice 1's head c040b326f before they went (the receipt),
// and no object literal named MOVES or PATHS is kept in code.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { MOVES, PATHS } from '../src/fight/moves.ts';

test('MOVES and PATHS built from rows equal the old literals key for key, value for value and in the same key order', () => {
  assert.equal(createHash('sha256').update(JSON.stringify({ MOVES, PATHS })).digest('hex'), '047083ca803af3faea1c8aee5b1811ccb366b239c8a0702adbe8be78083df453');
  assert.equal(Object.keys(MOVES).length, 21);
  assert.equal(Object.keys(PATHS).length, 10);
  for (const [id, m] of Object.entries(MOVES)) assert.equal(m.id, id, `the row key and the move id agree: ${id}`);
});

test('the move rows carry one row per id', () => {
  const rows = JSON.parse(readFileSync(new URL('../src/fight/move-defs.json', import.meta.url), 'utf8')) as { moves: { id: string }[] };
  assert.equal(new Set(rows.moves.map((m) => m.id)).size, rows.moves.length);
});

test('no src/fight file keeps a MOVES or PATHS object literal: the rows are the one source', () => {
  for (const f of readdirSync(new URL('../src/fight/', import.meta.url)).filter((n) => n.endsWith('.ts'))) {
    const src = readFileSync(new URL(`../src/fight/${f}`, import.meta.url), 'utf8');
    assert.ok(!/(?:const|let|var)\s+(?:MOVES|PATHS)\s*(?::[^=]+)?=\s*\{/.test(src.replace(/Object\.fromEntries[^;]*;/g, '')), `${f} must not hand-write MOVES or PATHS`);
  }
});
