import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NO_STANCE, STANCES, stanceFrom, stancePose } from '../src/stance-pose.ts';

test('no flag, a wrong look or an unknown stance is neutral: today\'s frame', () => {
  for (const q of ['', '?stance=defensive', '?look=fatigue-read&stance=defensive', '?look=stances', '?look=stances&stance=nope']) assert.equal(stanceFrom(q), 'neutral');
  for (const s of STANCES) assert.equal(stanceFrom(`?look=stances&stance=${s}`), s);
  assert.equal(stanceFrom('?look=fatigue-read,stances&stance=aggressive'), 'aggressive');
});

test('neutral and a zero weight add nothing; the others scale with the weight', () => {
  assert.equal(stancePose('neutral', 1, 3), NO_STANCE);
  for (const s of STANCES) assert.equal(stancePose(s, 0, 3), NO_STANCE);
  assert.ok(stancePose('defensive', 1, 0).drop > stancePose('defensive', .5, 0).drop && stancePose('defensive', .5, 0).drop > 0);
});

test('the three stances read apart: aggressive raises the sword arm, defensive sinks the body, only the trickster moves', () => {
  assert.ok(stancePose('aggressive', 1, 0).arm < 0 && stancePose('defensive', 1, 0).drop > stancePose('aggressive', 1, 0).drop);
  assert.deepEqual(stancePose('aggressive', 1, 0), stancePose('aggressive', 1, 1.1)); assert.deepEqual(stancePose('defensive', 1, 0), stancePose('defensive', 1, 1.1));
  assert.notDeepEqual(stancePose('trickster', 1, 0.2), stancePose('trickster', 1, 0.9));
});
