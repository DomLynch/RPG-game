import assert from 'node:assert/strict';
import test from 'node:test';
import { CROWD_LADDER, loadLadder } from '../origins/preview/crowd-ladder.ts';
import DEFS from '../origins/preview/crowd-ladder.json' with { type: 'json' };
import { createGovernor } from '../origins/preview/frame-governor.ts';
import { previewRule } from '../origins/preview/preview-rules.ts';

// S2 (40 characters at 30 fps): the remote-crowd cost is a ladder of rows, and the frame governor steps ONE rung per window. Rung 0 and 1 equal the old remoteFullCount 16 / remoteCheapEvery 4 and remoteAdaptFullCount 8.
test('the ladder rows are the ruled ones: 16/4, 8/4, 4/8, 0/12', () => {
  assert.equal(JSON.stringify(CROWD_LADDER.map(({ full, every }) => [full, every])), JSON.stringify([[16, 4], [8, 4], [4, 8], [0, 12]]));
});

test('the loader refuses an empty ladder, a bad number, a duplicate id and a rung dearer than the one before it', () => {
  const rungs = DEFS.rungs;
  assert.throws(() => loadLadder({ rungs: [] }), /at least one rung/);
  assert.throws(() => loadLadder({ rungs: rungs.map((r, i) => (i === 1 ? { ...r, every: 0 } : r)) }), /every is >= 1/);
  assert.throws(() => loadLadder({ rungs: [...rungs, rungs[0]!] }), /duplicate|twice|unique/i);
  assert.throws(() => loadLadder({ rungs: rungs.map((r, i) => (i === 2 ? { ...r, full: 12 } : r)) }), /costs more/);
  assert.throws(() => loadLadder({ rungs: rungs.map((r, i) => (i === 2 ? { ...r, every: 2 } : r)) }), /costs more/);
});

const rules = { windowMs: previewRule('remoteAdaptWindowMs'), slowMs: previewRule('remoteAdaptSlowMs'), okMs: previewRule('remoteAdaptOkMs'), judgeMs: previewRule('remoteAdaptJudgeMs'), percentile: previewRule('remoteAdaptPercentile'), rungs: CROWD_LADDER.length };
const run = (g: ReturnType<typeof createGovernor>, t0: number, seconds: number, ms: number): number => { let t = t0; while (t - t0 < seconds * 1000) { t += ms; g.push(ms, t); } return t; };

test('slow frames step down ONE rung per window, to the last rung and no further; clean frames step back up one rung per window', () => {
  const g = createGovernor(rules); let t = 0;
  t = run(g, t, 4, 60); assert.equal(g.level(), 1, 'one window of slow frames: one rung');
  t = run(g, t, 3.5, 60); assert.equal(g.level(), 2, 'another window: the next rung');
  t = run(g, t, 3.5, 60); assert.equal(g.level(), 3, 'and the last');
  t = run(g, t, 10, 60); assert.equal(g.level(), 3, 'it stays on the last rung');
  t = run(g, t, 4, 16.7); assert.equal(g.level(), 2, 'a clean window: back up one rung, not all the way');
  t = run(g, t, 3.5, 16.7); assert.equal(g.level(), 1);
  run(g, t, 3.5, 16.7); assert.equal(g.level(), 0); assert.equal(g.low(), false);
});

test('the default ladder is the old pair: two rungs, one step', () => {
  const g = createGovernor({ ...rules, rungs: undefined }); run(g, 0, 20, 60);
  assert.equal(g.level(), 1);
});
