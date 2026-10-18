import test from 'node:test';
import assert from 'node:assert/strict';
import { SPECIAL_MELEE_WINDUP, SPECIAL_REACT, SPECIAL_REACT_KNOCK, SPECIAL_REACT_POSTURE, SPECIAL_REACT_STAGGER, shardRows, specialLookOf, specialPickRows, specialReactFloorOf, specialShardsOf, specialSoundOf, specialTrailOf } from '../src/fight/sandbox-rules.ts';

// Slice (e) of the combat-sandbox port (RV77): duel.ts reads the melee-special rules, and they ship OFF, so a trunk fight is byte for byte as before (the behaviour with a rule ON is tests/sandbox-special-react.test.ts).
test('the shipped melee-special rules are off: the special keeps its own windup, a landed special does damage only; the tuned percents and the lunge floor wait for the flip', () => {
  assert.equal(SPECIAL_MELEE_WINDUP, 0, 'the special keeps its own windup rule');
  assert.equal(SPECIAL_REACT, 0, 'a landed special does damage only');
  assert.deepEqual([SPECIAL_REACT_STAGGER, SPECIAL_REACT_KNOCK, SPECIAL_REACT_POSTURE], [160, 450, 150], 'the sandbox\'s tuned percents, read only once specialReact is 1');
  assert.equal(specialReactFloorOf('lunge'), 36);
  assert.equal(specialReactFloorOf('cleave'), 0);
  assert.deepEqual(specialPickRows(), []);
  assert.equal(specialLookOf('cleave'), undefined);
  assert.equal(specialTrailOf('cleave'), undefined);
  assert.deepEqual(specialShardsOf('cleave'), []);
  assert.equal(shardRows(), 0);
  assert.deepEqual(specialSoundOf('cleave'), []);
  assert.deepEqual(specialSoundOf('skullcrack'), []);
});

test('nothing on trunk imports the sandbox rules yet: the digest cannot move (the slice that turns a rule on owns the version bump and its battery)', () => {
  const importers: string[] = [];
  const walk = (dir: string) => { for (const e of readdirSync(dir, { withFileTypes: true })) { const p = `${dir}/${e.name}`; if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p); } else if (/\.(ts|mjs)$/.test(e.name) && p !== 'src/fight/sandbox-rules.ts' && !p.startsWith('tests/') && /sandbox-rules(\.ts)?['"]/.test(readFileSync(p, 'utf8'))) importers.push(p); } };
  for (const d of ['src', 'origins']) walk(d);
  const viewOnly = ['src/fight/sound/cues.ts'];   // a presentation reader of rows that are empty as shipped (specialSound): it can add no sound and touches no sim
  assert.deepEqual(importers.filter((p) => !viewOnly.includes(p)), [], 'a consumer lands with the slice that bumps the version');
});
