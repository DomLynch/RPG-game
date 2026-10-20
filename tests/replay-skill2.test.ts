import './lib/era-on.ts';   // the shipped rows are the live game's: these records are RV85 wins
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { decodeRecord } from '../src/fight/server.ts';
import { verifyRecord } from '../src/fight/replay.ts';

// Three REAL prod loot_claims records (2026-10-20): each a win by a player who pressed SPECIAL 2. verifyRecord stopped one argument short of initialPractice's `skill2`, so slot b was never armed in the replay and
// every one of them was refused (claim 15 died at tick 1894 instead of killing at 2046; 17 and 19 never finished). record.skill2 now reaches initialPractice (RV75: a record without one passes undefined and replays as before).
const FIXTURE = JSON.parse(readFileSync(new URL('./fixtures/skill2-picked-duel-records.json', import.meta.url), 'utf8')) as { records: { id: number; ticks: number; outcome: string; skill: string; skill2: string; record: string }[] };

test('a record that pressed SPECIAL 2 replays to its recorded finish: the real prod wins verify', async () => {
  assert.equal(FIXTURE.records.length, 3);
  for (const f of FIXTURE.records) {
    const rec = await decodeRecord(f.record);
    assert.equal(rec.skill, f.skill, `claim ${f.id}: SPECIAL 1`); assert.equal(rec.skill2, f.skill2, `claim ${f.id}: SPECIAL 2`);
    assert.equal(rec.ticks, f.ticks, `claim ${f.id}: ticks`); assert.equal(rec.outcome, f.outcome, `claim ${f.id}: outcome`);
    assert.ok(rec.intents.some((i) => i.action === 'skill2'), `claim ${f.id} really pressed SPECIAL 2`);
    const v = verifyRecord(rec);
    assert.equal(v.ok, true, `claim ${f.id}: ${v.ok ? '' : v.reason}`);
  }
});

test('the same records without their SPECIAL 2 pick do not verify: slot b changes the fight, so the replay must arm it', async () => {
  for (const f of FIXTURE.records) {
    const { skill2, ...rest } = await decodeRecord(f.record); void skill2;
    assert.equal(verifyRecord(rest as Awaited<ReturnType<typeof decodeRecord>>).ok, false, `claim ${f.id} stripped of skill2`);
  }
});
