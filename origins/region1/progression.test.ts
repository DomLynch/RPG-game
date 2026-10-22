import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { BOSS_LOOT, BOUNTIES, BUNDLE, ENCOUNTER_FLAGS, ENCOUNTERS, FOES, KILL_ROWS, LOCAL, RIFTS, TOWNSFOLK } from './content.ts';
import { LEGEND_CHARACTER_IDS } from './legend-foes.ts';

const canon = (x: unknown): unknown => Array.isArray(x) ? x.map(canon)
  : x && typeof x === 'object' ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => [k, canon(v)])) : x;

// Taken from trunk 400202c51, where these records were built in content.ts: the move to progression.json must change no value.
// Re-pinned 2026-10-15 (three times; the third gain is the goblin scrap cap and shin plates, ground armour batch two, the sha before it 1656e978cb573e4d9918a996fc7011e2d6e7f204cae46a8e05a2dfad175c3b74): BUNDLE gained item:starter.rusty-sword (ground loot slice 1), then item:starter.knife, .cleaver, .gladius and .estoc (Strategy's four starter weapons, ground rows + looks PR). The sha before the second gain was ea5cc275a7bdcf5c899a9f3f872aed19af544a6c9dd4f7dbd5f89f71f7a5cc7e. The old pin 1047d934034d2db1b2fe85cab2aed7479c473e2f387fd1e9a0795e6b5b81479d is what this hashes to WITHOUT that item (checked on the VPS).
// Re-pinned 2026-10-16 (fix-forward, the Cave Troll placement #2877): +character:cave-troll (a character-definition and its `mob` row), so the rows moved on purpose; the sha before it d5981560216cd0962113494e71092cfe8f32d7930d501fefe2af626a20ed4254.
// Re-pinned again 2026-10-16 (fix-forward, #2878 on top of the troll camp move #2877): +character:giant-salamander and its `mob` row, plus the waypoint `troll-cave`; alone they were 8d16271e05d01b65fd412a02e57ad449c9cce1a028bebe0cfd74f8aef79ce83c (salamander) and 83ffcaee813d41506fd6f0d5beb8e8e0923a34fed917d32d413c57c0be7afdaf (troll-cave); the sha before both a89364eb2fa70197e6fda16e8f79d980b1bc952c0b0e30e522e4087157dbbef7.
// Re-pinned 2026-10-17 (fix-forward, lootStarter): +item:loot.starter.Longsword in BUNDLE's catalogue slice, was 4fac8be1…; expected to be the only change (not hash-checked: BUNDLE without the item was not hashed back to 4fac8be1…).
// Re-pinned 2026-10-17 (fix-forward, the beta dungeon's door #3016, merged over lootStarter): +waypoint `cave-mouth` in Zone 1's row; the sha before it f6ee20d2fd208f20f78d1d6537637891af9a9e5ad7074fbb35498d840e21a0ab (alone on the pre-lootStarter tree the waypoint made da007bff…, from 4fac8be1…).
// Re-pinned 2026-10-18 (fix-forward, +loottable:tz-cave-troll for zone 90's troll row): the sha before it 74dab0cc5aa7cb7b2bd46d815be45f1b55c8b2f075fee41adfdac2d7c25df583.
// Re-pinned 2026-10-19 (Dom: everything from the sandbox moves over): loottable:cave-troll takes loottable:tz-cave-troll's pitborn Greaves/Boots roll; the sha before it 9c1541e3cb78a00ab48ec5ceacea37bfe3815f14bfb0d8e89d8948c6e2c89008.
// Re-pinned 2026-10-19 (RV82 content, Lead's ruling: +item:starter.bow and item:starter.staff, the starter weapons beside the longsword, on top of the line above); the sha before it caf233dd8dd6b0b5df045258ed3a196ff3a98c48c7fae3129901bc7b3803f90b.
// Re-pinned 2026-10-20 (World, Lead's rulings 5 + 7: bear and salamander respawnSeconds 75/90 -> 60, plus four giant-salamander camps in Zone 1's spawns); the sha before it 39dd4e53b49148dba06ada12bd1dc1499c8724f2e20eb254a41c9f5fb0d52258.
// Re-pinned 2026-10-20 (World, the shrine salamander camp moves to the new `shrine-field` waypoint, 18.9 m off Hrungnir); the sha before it 542fc27fa685a0a173af2cada11d446fc96402d804b6adda9bcede161d52d77a.
// Re-pinned 2026-10-21 (World, Lead/Strategy: a few salamanders and trolls along the route): four spawn-only waypoints pool-spot, fell-spot, sedge-spot, pier-spot and four spawn groups in Zone 1's place; the sha before it 0d287515be0973d82a1c73730ee7a086ad6ba0f1bf5f46b87017a38d7572b825.
// Re-pinned 2026-10-22 (#3558, Combat, Zone 2 creatures): two character definitions (the Ash skeleton, the Pale duelist) and their two mob rows in progression.json; the sha before it d2c4639bc742295cd1f75d792dea11fd5b14be4d7738175026f5be3ea8d4dd15.
// Re-pinned 2026-10-22 (Dungeon 1, Combat): the Pit's 100 legends as characters in the BUNDLE (derived from the legend tables by origins/region1/legend-foes.ts from a template row, one open-world form each at its rank), their 100 kill rows in KILL_ROWS and loottable:pit-legend; FOES (the Frontier's own foes) is unchanged; the sha before it 6b886c7d606207e81dd9d256094bed8b3bb414ba1162e2717075ad8c14d27ca2.
// Re-pinned again 2026-10-22 (Dungeon 1, Combat): the BUNDLE's region carries zone 7's camps, and the roster pool moved to the four families the world draws a body for (pitborn, knight: pit-thrall, cacus, gawain / roland, grendel, lancelot / siegfried, achilles, typhon); the sha before it c62cb4f0946b7caba89f0a2b2ac7a26c208dcba1f94cfbc0e18b8e27de642e58.
const TRUNK_SHA = 'a7d09f3d1756a69dc3c4f6a6d7691b745dead8d5186a42a5506a1828dbe6e0d1';

test('the economy and progression rows read back byte-identical to the records content.ts built in code', () => {
  const now = { FOES, TOWNSFOLK, ENCOUNTERS, BOUNTIES, RIFTS, KILL_ROWS, BOSS_LOOT, ENCOUNTER_FLAGS, BUNDLE, LOCAL };
  assert.equal(createHash('sha256').update(JSON.stringify(canon(now))).digest('hex'), TRUNK_SHA);
});

test('every foe a progression row names is a foe, and every Bounty copies its encounter flag', () => {
  const foes = new Set([...FOES.concat(TOWNSFOLK).map((f) => f.id), ...LEGEND_CHARACTER_IDS]);   // + the Pit's legends (origins/region1/legend-foes.ts): they pay kill rows too
  for (const id of Object.keys(KILL_ROWS)) assert.ok(foes.has(id), id);
  for (const b of BOUNTIES) assert.deepEqual(b.twist, ENCOUNTER_FLAGS[b.encounter]![0]);
  assert.equal(RIFTS.filter((r) => r.kind === 'rift-scheduler').length, 1);
  assert.equal(ENCOUNTERS.length, 5);
  assert.equal(BOSS_LOOT.length, ENCOUNTERS.length);
});
