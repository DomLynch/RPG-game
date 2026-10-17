import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { BOSS_LOOT, BOUNTIES, BUNDLE, ENCOUNTER_FLAGS, ENCOUNTERS, FOES, KILL_ROWS, LOCAL, RIFTS, TOWNSFOLK } from './content.ts';

const canon = (x: unknown): unknown => Array.isArray(x) ? x.map(canon)
  : x && typeof x === 'object' ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => [k, canon(v)])) : x;

// Taken from trunk 400202c51, where these records were built in content.ts: the move to progression.json must change no value.
// Re-pinned 2026-10-15 (three times; the third gain is the goblin scrap cap and shin plates, ground armour batch two, the sha before it 1656e978cb573e4d9918a996fc7011e2d6e7f204cae46a8e05a2dfad175c3b74): BUNDLE gained item:starter.rusty-sword (ground loot slice 1), then item:starter.knife, .cleaver, .gladius and .estoc (Strategy's four starter weapons, ground rows + looks PR). The sha before the second gain was ea5cc275a7bdcf5c899a9f3f872aed19af544a6c9dd4f7dbd5f89f71f7a5cc7e. The old pin 1047d934034d2db1b2fe85cab2aed7479c473e2f387fd1e9a0795e6b5b81479d is what this hashes to WITHOUT that item (checked on the VPS).
// Re-pinned 2026-10-16 (fix-forward, the Cave Troll placement #2877): +character:cave-troll (a character-definition and its `mob` row), so the rows moved on purpose; the sha before it d5981560216cd0962113494e71092cfe8f32d7930d501fefe2af626a20ed4254.
// Re-pinned again 2026-10-16 (fix-forward, #2878 on top of the troll camp move #2877): +character:giant-salamander and its `mob` row, plus the waypoint `troll-cave`; alone they were 8d16271e05d01b65fd412a02e57ad449c9cce1a028bebe0cfd74f8aef79ce83c (salamander) and 83ffcaee813d41506fd6f0d5beb8e8e0923a34fed917d32d413c57c0be7afdaf (troll-cave); the sha before both a89364eb2fa70197e6fda16e8f79d980b1bc952c0b0e30e522e4087157dbbef7.
// Re-pinned 2026-10-17 (fix-forward, lootStarter): +item:loot.starter.Longsword in BUNDLE's catalogue slice, was 4fac8be1…; expected to be the only change (not hash-checked: BUNDLE without the item was not hashed back to 4fac8be1…).
const TRUNK_SHA = 'f6ee20d2fd208f20f78d1d6537637891af9a9e5ad7074fbb35498d840e21a0ab';

test('the economy and progression rows read back byte-identical to the records content.ts built in code', () => {
  const now = { FOES, TOWNSFOLK, ENCOUNTERS, BOUNTIES, RIFTS, KILL_ROWS, BOSS_LOOT, ENCOUNTER_FLAGS, BUNDLE, LOCAL };
  assert.equal(createHash('sha256').update(JSON.stringify(canon(now))).digest('hex'), TRUNK_SHA);
});

test('every foe a progression row names is a foe, and every Bounty copies its encounter flag', () => {
  const foes = new Set(FOES.concat(TOWNSFOLK).map((f) => f.id));
  for (const id of Object.keys(KILL_ROWS)) assert.ok(foes.has(id), id);
  for (const b of BOUNTIES) assert.deepEqual(b.twist, ENCOUNTER_FLAGS[b.encounter]![0]);
  assert.equal(RIFTS.filter((r) => r.kind === 'rift-scheduler').length, 1);
  assert.equal(ENCOUNTERS.length, 5);
  assert.equal(BOSS_LOOT.length, ENCOUNTERS.length);
});
