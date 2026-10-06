// Shared kill links written before the Goblin's stab (record version 24 and older) must still replay their own fight: the record's version says whether the stab
// runs (stab-rule.ts, set by detmath.ts underRecord), so a v24 Goblin at levels 12, 18 and 46 replays exactly as trunk fought it (a2cf3529). The control forces the
// same intents under the current version: that is a different fight, so this test fails if the stab ever leaks into an older record.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { decodeRecord, RECORD_VERSION } from '../src/record.ts';
import { replayInNode } from '../scripts/browser-replay-check.mjs';
import { STAB_ON, setStab } from '../src/stab-rule.ts';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/v24-goblin.json', import.meta.url), 'utf8')) as { records: { opponent: string; seed: number; level: number; encoded: string; expect: { victim: number; draw: boolean; tick: number; hashes: Record<string, string> } }[] };

test('a v24 Goblin record replays to the outcome and state hashes trunk recorded, at every level the stab reaches', async () => {
  assert.equal(fixture.records.length, 6);
  setStab(true);   // a live page: the stab is on, and a replay at a version below FIRST_STAB_VERSION must turn it off for the run and put it back
  for (const f of fixture.records) {
    const record = await decodeRecord(f.encoded);
    assert.equal(record.v, 24); assert.equal(record.opponent, 'goblin');
    const node = replayInNode(record);
    assert.ok(node.finished, `L${f.level} s${f.seed}: the replay finishes`);
    assert.deepEqual({ victim: node.victim, draw: node.draw, tick: node.tick }, { victim: f.expect.victim, draw: f.expect.draw, tick: f.expect.tick }, `L${f.level} s${f.seed}: the same fight`);
    assert.deepEqual(node.hashes, f.expect.hashes, `L${f.level} s${f.seed}: the state hash at every sampled tick is the pre-stab fight's (pinned from trunk before the change)`);
    assert.equal(STAB_ON, true, 'the live setting is put back after the replay');
  }
  setStab(false);
});

test('the control: the same intents under the current version are a different fight (the stab is real from level 12 up), so a leak into old records would fail the test above', async () => {
  const changed: string[] = [];
  for (const f of fixture.records) {
    const record = await decodeRecord(f.encoded);
    if (JSON.stringify(replayInNode({ ...record, v: RECORD_VERSION }).hashes) !== JSON.stringify(f.expect.hashes)) changed.push(`L${f.level}`);
  }
  assert.ok(changed.length >= 2 && changed.some((l) => l === 'L18' || l === 'L46'), `diverging under the stab: ${changed.join(' ') || 'none'} (a fight where he never gets an opening is unchanged, so not all six)`);
});
