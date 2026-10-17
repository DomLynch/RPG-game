// The beta cut (Dom 2026-10-17, Strategy's lists): the Pit shows two titles and the signed-off 20 spells. A VIEW: a stored L16 account still loads, keeps its marks, and the server's rules (MAX_LEVEL, levelOfMarks) do not move.
import assert from 'node:assert/strict';
import test from 'node:test';
import CAREER_RULES from '../src/core/career-rules.json' with { type: 'json' };
import SPELL_INDEX from '../src/fight/spell-index.json' with { type: 'json' };
import { BETA_MAX_LEVEL, BETA_SPELLS, MAX_LEVEL, RANK_STEPS, betaLevel, betaMarks, inBetaSpells, levelOfMarks, rankFor } from '../src/core/career-ladder.ts';
import { ladderView } from '../src/core/career-screen.ts';
import { levelRefusal } from '../src/awards.ts';
import { LADDER } from '../src/ladder.ts';

const INDEX = (SPELL_INDEX as unknown as { spells: Record<string, readonly [string, number]> }).spells;
const ROW = CAREER_RULES.betaCut[0]!;

test('beta cut row: two titles, and exactly the 20 signed-off spells (the starter four first), every one a rank 1-2 spell-index row', () => {
  assert.equal(CAREER_RULES.betaCut.length, 1); assert.equal(ROW.titles, 2);
  assert.equal(ROW.spells.length, 20); assert.equal(new Set(ROW.spells).size, 20, 'no duplicates');
  assert.deepEqual(ROW.spells.slice(0, 4), ['brokkr', 'scylla-pup', 'baobhan-sith', 'rubezahl']);
  for (const id of ROW.spells) { assert.ok(INDEX[id], `${id} is a spell-index row`); assert.ok(INDEX[id]![1] <= 2, `${id} is rank 1-2`); }
});

test('beta cut: the HUD stops at the cut, the server rank does not; a stored L16 account loads and keeps its marks', () => {
  assert.equal(BETA_MAX_LEVEL, ROW.titles * RANK_STEPS);
  const marks = 15;   // an account that reached level 16
  assert.equal(levelOfMarks(marks), 16, 'the server rule is untouched'); assert.equal(rankFor(marks).label, 'Veteran I');
  assert.equal(betaMarks(marks), BETA_MAX_LEVEL - 1); assert.equal(rankFor(betaMarks(marks)).label, 'Legionary V', 'the client shows the last rung of the cut');
  assert.equal(rankFor(betaMarks(3)).label, rankFor(3).label, 'below the cut nothing changes'); assert.equal(betaLevel(MAX_LEVEL), BETA_MAX_LEVEL); assert.ok(MAX_LEVEL > BETA_MAX_LEVEL);
});

test('beta cut: the ladder shows two titles, all ten faces stay in the rotation', () => {
  const shelves = ladderView(betaMarks(15));
  assert.deepEqual(shelves.map((s) => s.title), ['Recruit', 'Legionary']); assert.equal(shelves.flatMap((s) => s.rungs).length, BETA_MAX_LEVEL);
  assert.equal(LADDER.length, 10, 'no boss hide list: all ten opponents are in the pass');
});

test('beta cut: a win fought at the cut counts for a stored L16 account (the floor never asks for more than the cut), a win far below still does not', () => {
  assert.equal(levelRefusal(BETA_MAX_LEVEL, 15), null); assert.equal(levelRefusal(BETA_MAX_LEVEL, 100000), null, 'even Origin V: the client fights no higher than the cut');
  assert.match(levelRefusal(2, 15)!, /below your rank/); assert.equal(levelRefusal(2, 15, undefined, (n) => n)!.includes('floor 11'), true, 'without the cut the same claim has floor 11');
});

test('beta cut: the spell book shows the 20 and nothing else; an empty list would lift the cut', () => {
  assert.equal(BETA_SPELLS.size, 20);
  assert.ok(inBetaSpells('brokkr') && inBetaSpells('puca')); assert.ok(!inBetaSpells('python') && !inBetaSpells('beowulf'), 'a rank 3+ spell is hidden');
  const all = Object.keys(INDEX), shown = all.filter(inBetaSpells); assert.equal(shown.length, 20); assert.ok(all.length > 20, 'the server keeps every row');
});
