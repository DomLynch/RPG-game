// Shared kill links written before late notice (record version 22 and 23) must still replay their own fight: the record's version says whether the ramp ran
// (play-radius.ts LATE_NOTICE, set by detmath.ts underRecord), so a v22 Knight at level 12, the first level whose in-between profile carries softNotice,
// replays exactly as trunk fought it. The control forces the same intents under v24: that is a different fight, so this test fails if the ramp ever leaks
// into an older record.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { decodeRecord, RECORD_VERSION } from '../src/record.ts';
import { replayInNode } from '../scripts/browser-replay-check.mjs';
import { LATE_NOTICE, setLateNotice } from '../src/play-radius.ts';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/v22-warden-l12.json', import.meta.url), 'utf8')) as { records: { opponent: string; seed: number; level: number; encoded: string; expect: { victim: number | null; draw: boolean; tick: number; hashes: Record<string, string> } }[] };

test('a v22 warden record at level 12 replays to the outcome and state hashes trunk recorded, with late notice on or off in the live page', async () => {
  assert.ok(fixture.records.length >= 3);
  for (const live of [true, false]) {
    setLateNotice(live);
    for (const f of fixture.records) {
      const record = await decodeRecord(f.encoded);
      assert.equal(record.v, 22); assert.equal(record.level, 12);
      const node = replayInNode(record);
      assert.ok(node.finished, `${f.opponent} ${f.seed}: the replay finishes`);
      assert.deepEqual({ victim: node.victim, draw: node.draw, tick: node.tick }, { victim: f.expect.victim, draw: f.expect.draw, tick: f.expect.tick }, `${f.opponent} ${f.seed}: the same fight`);
      assert.deepEqual(node.hashes, f.expect.hashes, `${f.opponent} ${f.seed}: the state hash at every sampled tick is the pre-ramp fight's (pinned from trunk before the change)`);
      assert.equal(LATE_NOTICE, live, 'the live page\'s setting is put back after the replay');
    }
  }
  setLateNotice(false);
});

test('the control: the same intents under the current version are a different fight (the ramp is real at level 12), so a leak into old records would fail the test above', async () => {
  setLateNotice(false);
  let changed = 0;
  for (const f of fixture.records) {
    const record = await decodeRecord(f.encoded);
    const forced = replayInNode({ ...record, v: RECORD_VERSION });
    if (JSON.stringify(forced.hashes) !== JSON.stringify(f.expect.hashes)) changed++;
  }
  assert.equal(changed, fixture.records.length, 'every pinned record diverges once the ramp runs');
});
