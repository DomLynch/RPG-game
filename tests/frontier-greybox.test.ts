// Guard (Lead's ruling 2026-10-18, the second presentation-list addition): origins/preview/frontier-greybox.ts is DRAWING only. It owns no collision (never handed `solids`, no walkable / stand / view decision), reads no
// rows (every footprint and solid number reaches it as an argument from frontier-plan.ts), and keeps no copy of a footprint. A file on inline-number-scope.json's presentation list is not gated, so this is what keeps
// a number a player can bump into from drifting into it.
import './lib/era-off.ts';   // RV78: the legacy suite runs on trunk's rules; sandbox-era.ts is the one switch (tests/lib/era-off.ts)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as greybox from '../origins/preview/frontier-greybox.ts';
import { blockKinds } from '../origins/preview/frontier-greybox.ts';
import { FRONTIER_PLAN } from '../origins/preview/frontier-plan-rules.ts';
import { frontierBuild, frontierPlan } from '../origins/preview/frontier-plan.ts';

const src = readFileSync(new URL('../origins/preview/frontier-greybox.ts', import.meta.url), 'utf8');
const code = src.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');   // the guard reads code, not the comments that name what it must not do
const scope = JSON.parse(readFileSync(new URL('../scripts/as-data/inline-number-scope.json', import.meta.url), 'utf8')) as { presentation: { files: string[] } };

test('the greybox is on the presentation list, and nothing about collision, rows or the plan\'s decisions is in its code', () => {
  assert.ok(scope.presentation.files.includes('origins/preview/frontier-greybox.ts'));
  for (const banned of [/\bsolids?\b/i, /\bSolid\b/, /walkable/i, /\bonRoad\b/, /\binFirstView\b/, /\binZone\b/, /frontierRule/, /frontierBlock/, /frontier-plan-rules/, /frontier-plan-defs/, /\bstandBefore\b/, /\bblockPad\b/]) assert.doesNotMatch(code, banned, `frontier-greybox.ts must not mention ${banned}`);
  assert.deepEqual([...code.matchAll(/^import .* from '([^']+)'/gm)].map((m) => m[1]).sort(), ['../world/derive.ts', '../world/stage-rules.ts', './exchange-plan.ts', './frontier-geom.ts', './frontier-plan.ts', './frontier-skin.ts'], 'its imports: geometry, stage rules and TYPES only (the skin seam is types only too)');
  assert.match(code, /import type \{ BuildingSkin, ModelPlacement \} from '\.\/frontier-skin\.ts'/, 'the skin seam is imported for types only');
  assert.match(code, /import type \{ At, Board, Sign, ZonePlan \} from '\.\/frontier-plan\.ts'/, 'the plan is imported for types only (no value import, so no cycle)');
});

test('every export is a drawing function (draw*, town*) or the kinds list; none takes or returns a solid', () => {
  const names = Object.keys(greybox).sort();
  assert.ok(names.length >= 15, `only ${names.length} exports read`);
  assert.deepEqual(names.filter((n) => !/^(draw[A-Z]\w*|town[A-Z]\w*|blockKinds)$/.test(n)), [], 'only drawing exports');
  const pieces: unknown[] = [];
  const put: greybox.Put = (...args) => { pieces.push(args); };
  const at = { x: 3, z: 4, facing: 0.5 }, c = { x: 1, z: 2 };
  greybox.drawGatePost(put, c, 0); greybox.drawBlock(put, at, 'hall', c, 10, 8); greybox.drawCentre(put, at); greybox.drawMilestone(put, at); greybox.drawShrine(put, at); greybox.drawScorch(put, at, true);
  greybox.drawDock(put, at); greybox.drawBank(put, at); greybox.drawRuinPost(put, c, 0); greybox.drawLintel(put, at); greybox.drawCairn(put, at); greybox.drawTownPost(put, c);
  assert.ok(pieces.length > 12);
  for (const out of [greybox.townBoards(c, 'Ashford'), greybox.townPeople(c, 0), greybox.drawSignpost(put, { at, lines: ['x'], back: false })].flat()) assert.ok(!('r' in (out as object)), 'nothing it returns is a solid (no radius)');
});

test('one source for a footprint: the greybox draws the kinds the plan has rows for, with no (w, d) of its own', () => {
  assert.deepEqual(blockKinds().sort(), FRONTIER_PLAN.blocks.map((b) => b.kind).sort(), 'LOOK kinds = footprint row kinds');
  const drawn: number[][] = [];
  const put: greybox.Put = (_l, shape) => { if (shape[0] === 'box') drawn.push([shape[1] as number, shape[3] as number]); };
  for (const { kind, w, d } of FRONTIER_PLAN.blocks) { drawn.length = 0; greybox.drawBlock(put, { x: 0, z: 0, facing: 0 }, kind, { x: 0, z: 0 }, w, d); assert.deepEqual(drawn[0], [w, d], `${kind}: the body is drawn at the row's footprint`); }
});

test('the plan\'s build is unchanged by the split: Zone 1, flat and with relief', () => {
  for (const flat of [true, false]) { const b = frontierBuild(frontierPlan(flat)); assert.deepEqual([b.pieces.length, b.solids.length, b.people.length, b.boards.length], [175, 60, 8, 21]); }   // 174/59 -> 175/60 (2026-10-20, the shrine salamander camp moves off Hrungnir's spot: the new `shrine-field` landmark leaves one stone post and its collider, as troll-cave did)
});
