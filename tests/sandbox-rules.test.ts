import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { SPECIAL_MELEE_WINDUP, SPECIAL_REACT, SPECIAL_REACT_KNOCK, SPECIAL_REACT_POSTURE, SPECIAL_REACT_STAGGER, shardRows, specialLookOf, specialPickRows, specialReactFloorOf, specialShardsOf, specialSoundOf, specialTrailOf } from '../src/fight/sandbox-rules.ts';

// Slice (c) of the combat-sandbox port: the melee-special row families are DECLARED with their empty defaults and nothing reads them yet, so a trunk fight is byte for byte as before.
test('every sandbox rule is off as shipped and every family is empty: a trunk fight reads nothing from them', () => {
  assert.equal(SPECIAL_MELEE_WINDUP, 0, 'the special keeps its own windup rule');
  assert.equal(SPECIAL_REACT, 0, 'a landed special does damage only');
  assert.deepEqual([SPECIAL_REACT_STAGGER, SPECIAL_REACT_KNOCK, SPECIAL_REACT_POSTURE], [100, 100, 100], '100 percent = as the move row says');
  assert.equal(specialReactFloorOf('skullcrack'), 0);
  assert.deepEqual(specialPickRows(), []);
  assert.equal(specialLookOf('skullcrack'), undefined);
  assert.equal(specialTrailOf('skullcrack'), undefined);
  assert.deepEqual(specialShardsOf('skullcrack'), []);
  assert.equal(shardRows(), 0);
  assert.deepEqual(specialSoundOf('skullcrack'), []);
});

test('nothing on trunk imports the sandbox rules yet: the digest cannot move (the slice that turns a rule on owns the version bump and its battery)', () => {
  const importers: string[] = [];
  const walk = (dir: string) => { for (const e of readdirSync(dir, { withFileTypes: true })) { const p = `${dir}/${e.name}`; if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p); } else if (/\.(ts|mjs)$/.test(e.name) && p !== 'src/fight/sandbox-rules.ts' && !p.startsWith('tests/') && /sandbox-rules(\.ts)?['"]/.test(readFileSync(p, 'utf8'))) importers.push(p); } };
  for (const d of ['src', 'origins']) walk(d);
  assert.deepEqual(importers, [], 'a consumer lands with the slice that bumps the version');
});
