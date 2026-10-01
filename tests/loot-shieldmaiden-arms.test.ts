// Shieldmaiden's Arms plates (Armour 2026-10-02, take-check P2): scripts/build-warrior.mjs SHOULDER_LIFT = .0175 stands every shell 1.75 cm
// further out about the arm. The shipped loot.glb got that move as a positions-only edit (scripts/lift-shieldmaiden-arms.py): the build's
// source archives are not in the repo, so a rebuild cannot be diffed against the file. This pins the lifted piece's bounds, found BY NAME
// (an accessor index moves when the file is rebuilt): a rebuild without the lift lands 1.7-1.9 cm short on y and z and fails here, and
// the next full rebuild must re-verify SHOULDER_LIFT against these numbers (source-archive gap, PR #1291).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

type Accessor = { min: number[]; max: number[]; count: number };
const glb = readFileSync(new URL('../src/assets/loot.glb', import.meta.url));
const json = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString());
const piece = json.nodes.find((n: { name?: string }) => n.name === 'shieldmaiden.Arms.Steel');
const position: Accessor = json.accessors[json.meshes[piece.mesh].primitives[0].attributes.POSITION];

test('shieldmaiden.Arms.Steel: the plates keep the 1.75 cm shoulder lift (bounds pinned; a rebuild without SHOULDER_LIFT fails)', () => {
  assert.equal(position.count, 300);
  const near = (a: number[], b: number[]) => a.forEach((v, i) => assert.ok(Math.abs(v - b[i]!) < 1e-4, `${v} vs ${b[i]}`));
  near(position.min, [-0.32084, 1.368, -0.1558]);   // trunk a2dd848c, before the lift: [-0.32031, 1.3855, -0.13843]
  near(position.max, [0.32083, 1.551, 0.02468]);    // trunk a2dd848c, before the lift: [0.32031, 1.5335, 0.00732]
});
