import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { BOSS_LOOT, BOUNTIES, BUNDLE, ENCOUNTER_FLAGS, ENCOUNTERS, FOES, KILL_ROWS, LOCAL, RIFTS, TOWNSFOLK } from './content.ts';

const canon = (x: unknown): unknown => Array.isArray(x) ? x.map(canon)
  : x && typeof x === 'object' ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => [k, canon(v)])) : x;

// Taken from trunk 400202c51, where these records were built in content.ts: the move to progression.json must change no value.
const TRUNK_SHA = '1047d934034d2db1b2fe85cab2aed7479c473e2f387fd1e9a0795e6b5b81479d';

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
