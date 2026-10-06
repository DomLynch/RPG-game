// Shared kill links written before Arena 1 came inward (record version 22) must still replay their own fight: the record's version
// picks the play circle (play-radius.ts), so a v22 veteran or pitborn replays in 8.55 m, not the new 0.6 of it.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { decodeRecord } from '../src/record.ts';
import { replayInNode } from '../scripts/browser-replay-check.mjs';
import { PLAY_SCALE, RADIUS, setPlayScale } from '../src/play-radius.ts';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/v22-records.json', import.meta.url), 'utf8')) as { records: { opponent: string; encoded: string; expect: { victim: number; draw: boolean; tick: number; hashes: Record<string, string> } }[] };

test('a v22 record replays to the outcome it was recorded with, in the old circle, whatever circle the live page is in', async () => {
  setPlayScale(0.36);
  for (const f of fixture.records) {
    const record = await decodeRecord(f.encoded);
    assert.equal(record.v, 22);
    const node = replayInNode(record);
    assert.ok(node.finished, `${f.opponent}: the replay finishes`);
    assert.deepEqual({ victim: node.victim, draw: node.draw, tick: node.tick }, { victim: f.expect.victim, draw: f.expect.draw, tick: f.expect.tick }, `${f.opponent}: the same fight`);
    assert.deepEqual(node.hashes, f.expect.hashes, `${f.opponent}: the state hash at every sampled tick is the old circle's (pinned from trunk 013adbc6, before the change)`);
    // The control: the same intents in the new circle are a different fight where the circle is Arena 1's, so this test fails if a v22 record is ever forced into it.
    const forced = replayInNode({ ...record, v: 23 });
    const arenaOne = f.opponent !== 'goblin';
    assert.equal(JSON.stringify(forced.hashes) !== JSON.stringify(f.expect.hashes), arenaOne, `${f.opponent}: ${arenaOne ? 'forcing it into the small circle changes the fight' : 'outside Arena 1 the circle is the same either way'}`);
    assert.equal(RADIUS, 8.55 * 0.36, 'the live circle is put back after the replay');
    assert.equal(PLAY_SCALE, 0.36);
  }
  setPlayScale(1);
});
