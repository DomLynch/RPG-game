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
  assert.equal(createHash('sha256').update(JSON.stringify({ LEVEL_ANCHORS, rows })).digest('hex'), '55cca609b37afeae7908c5769c011ebdb43f02e9fde8660a6a4e5fd9f5f27be5');   // re-pinned 2026-10-17 (RV74, gear in the world fight): the troll row's health 380 -> 570 moves opponentAt for the troll at every level; was 6ddcf85f... (the LEVEL_ANCHORS and every other opponent are byte for byte the same)
  assert.deepEqual({ ...LEVEL_ANCHORS }, { novice: 1, easy: 6, normal: 18, hard: 46 });
  assert.deepEqual(Object.keys(LEVEL_ANCHORS), ['novice', 'easy', 'normal', 'hard']);
});

test('no src/fight file keeps a LEVEL_ANCHORS object literal: the rows are the one source', () => {
  for (const f of readdirSync(new URL('../src/fight/', import.meta.url)).filter((n) => n.endsWith('.ts'))) {
    const src = readFileSync(new URL(`../src/fight/${f}`, import.meta.url), 'utf8');
    assert.ok(!/(?:const|let|var)\s+LEVEL_ANCHORS\s*(?::[^=]+)?=\s*\{\s*novice/.test(src), `${f} must not hand-write LEVEL_ANCHORS`);
  }
});
