// The AI profile tiers' anchor levels are ROWS (src/fight/level-anchor-defs.json, built by src/fight/level-anchor-rows.ts; recce #2554 group B, slice 4). The move is byte-identical: the canonical JSON of
// LEVEL_ANCHORS and of opponentAt / profileAt for every opponent at every level 1..LEVELS hashes to what the hand-written literal in moves.ts hashed to on slice 3's chain before it went.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { LEVELS, LEVEL_ANCHORS, OPPONENTS, opponentAt, profileAt } from '../src/fight/moves.ts';

test('the level anchors built from rows equal the old literal, and every opponent resolves the same at every level', () => {
  const rows: Record<string, unknown[]> = {};
  for (const id of Object.keys(OPPONENTS) as (keyof typeof OPPONENTS)[]) { rows[id] = []; for (let level = 1; level <= LEVELS; level++) rows[id]!.push([opponentAt(OPPONENTS[id], level), profileAt(OPPONENTS[id], level)]); }
  assert.equal(createHash('sha256').update(JSON.stringify({ LEVEL_ANCHORS, rows })).digest('hex'), 'd4910e6c546a436ea1e02e8e27ecdd817f7f5de1c8b997a3258a810b16ca2762');
  assert.deepEqual({ ...LEVEL_ANCHORS }, { novice: 1, easy: 6, normal: 18, hard: 46 });
  assert.deepEqual(Object.keys(LEVEL_ANCHORS), ['novice', 'easy', 'normal', 'hard']);
});

test('no src/fight file keeps a LEVEL_ANCHORS object literal: the rows are the one source', () => {
  for (const f of readdirSync(new URL('../src/fight/', import.meta.url)).filter((n) => n.endsWith('.ts'))) {
    const src = readFileSync(new URL(`../src/fight/${f}`, import.meta.url), 'utf8');
    assert.ok(!/(?:const|let|var)\s+LEVEL_ANCHORS\s*(?::[^=]+)?=\s*\{\s*novice/.test(src), `${f} must not hand-write LEVEL_ANCHORS`);
  }
});
