// The greybox's feel numbers are rows (origins/preview/preview-rules-defs.json): every default equals the literal it replaced, the loader refuses a broken table.
import assert from 'node:assert/strict';
import test from 'node:test';
import { PREVIEW_RULES, loadPreviewRules, previewRule } from '../origins/preview/preview-rules.ts';
import { STICK_R, LOOK_GAIN, DEAD } from '../origins/preview/sticks.ts';
import { TOUCH_EVERY_MS, MAX_RECORD_CHARS, SPENT_MS, OUTBOX_TRIES } from '../origins/preview/spawn-net.ts';
import { GIVE_UP_AFTER } from '../origins/preview/presence-client.ts';
import { GAME_DAY_MINUTES, DUSK, DAWN, DUSK_SPAN } from '../origins/preview/daynight.ts';
import { RENEW_TIMEOUT_MS } from '../origins/preview/save.ts';
import DEFS from '../origins/preview/preview-rules-defs.json' with { type: 'json' };

test('every preview rule equals the literal it replaced', () => {
  assert.deepEqual([STICK_R, LOOK_GAIN, DEAD], [48, 0.5, 0.12]);
  assert.deepEqual([TOUCH_EVERY_MS, MAX_RECORD_CHARS, SPENT_MS, OUTBOX_TRIES, RENEW_TIMEOUT_MS], [30_000, 45_000, 10_000, 12, 3000]);
  assert.deepEqual([previewRule('fetchRangePhone'), previewRule('nearTick'), previewRule('clientRespawn'), previewRule('warmBound'), previewRule('cameraEase')], [28, 25, 90, 4000, 0.7]);
  assert.deepEqual([GIVE_UP_AFTER, GAME_DAY_MINUTES, DUSK, DAWN, DUSK_SPAN, previewRule('campFlameSize'), previewRule('campLightReach')], [6, 100, 19, 5, 1.5, 1.15, 36]);   // the day clock, the camp fire and the presence give-up
  assert.deepEqual(['gateGap', 'heroWait', 'kindsWait', 'materialBound', 'uploadBudget', 'legendReach', 'lockRange', 'turnRate', 'tapRange', 'tapMs', 'tapPx'].map((id) => previewRule(id as never)), [0.62, 45000, 20000, 4000, 6, 6, 9, 1.9, 14, 4000, 12]);   // main.ts's own numbers
  assert.deepEqual(['askBudget', 'engageTtl', 'releaseFactor', 'engageRetry'].map((id) => previewRule(id as never)), [4, 120_000, 1.5, 5000]);   // engage-ahead.ts's literals
  assert.deepEqual(['tapSphereCommon', 'tapSphereNamed', 'fetchMargin', 'namedPull', 'namedRoam'].map((id) => previewRule(id as never)), [1.5, 1.9, 15, 5, 2.5]);   // mobs-view.ts's tap spheres and fetch margin, mobs.ts's named-creature placement
  assert.deepEqual(['loadoutWait', 'gearRetry'].map((id) => previewRule(id as never)), [15_000, 10_000]);   // main.ts's loadout gate (sheet-in-world, #2900)
  assert.equal(previewRule('kitWarmMs'), 60_000);   // the other-players' gear warm-up's own cap (Lead on #2938), from [zone ready]: no kit starts after it, and the one in flight is the last
  assert.deepEqual(['remoteWarm', 'remoteSnap', 'remoteIdle', 'remoteTagY', 'remoteExpire', 'remoteAnimRange', 'remoteBoundR', 'remoteOwedCap', 'remoteAdaptSlowMs', 'remoteAdaptOkMs', 'remoteAdaptWindowMs', 'remoteAdaptJudgeMs', 'remoteAdaptPercentile', 'remoteGroundStep'].map((id) => previewRule(id as never)), [8, 6, 0.05, 2.25, 1500, 80, 1.6, 0.25, 33, 25, 3000, 250, 0.95, 0.25]);   // remote-heroes.ts: warmed slots, teleport snap, idle gait floor, tag height, ms with no update before a remote is gone (the full-figure count and the cheap pose gap moved to the crowd ladder, crowd-ladder.json), pose range, bounding radius for the frustum test, most skipped time paid back at once
  assert.ok(previewRule('kitWarmMsSoft') > previewRule('kitWarmMs'));   // the browser rows' budget (?kitwarm=soft, software GL), longer than the live one
  assert.deepEqual(['kitProbeFrames', 'kitSlowFrameMs', 'gearWarmSettle', 'gearWarmBound'].map((id) => previewRule(id as never)), [20, 100, 30, 20000]);   // the kit warm-up's slow-device probe (main.ts): frames sampled before it starts, the median frame gap above which it is skipped
  assert.deepEqual(['walkBackMax', 'stickRange', 'dtFloor', 'frameDtMax', 'mobHeightMin', 'mobSpeedMax', 'pitDtMax'].map((id) => previewRule(id as never)), [0.6, 1, 0.001, 0.05, 1.9, 8, 0.1]);   // the inline clamps the as-data ratchet retired (Web 2026-10-17): every value is the literal it replaced
  assert.equal(PREVIEW_RULES.length, 100);   // +2: loadCoverFadeMs, loadCoverHoldMs (the load cover's fade and its max hold, load-cover.ts, World, deliberate; was 98).   // +2: forgeHalfX, forgeHalfZ (the smithy footprint, Web, deliberate; was 96).   // +5: tapSphereCommon, tapSphereNamed, fetchMargin, namedPull, namedRoam (the greybox mob consts as rows, Web, deliberate; was 91).   // -3: remoteFullCount, remoteCheapEvery and remoteAdaptFullCount became the rungs of crowd-ladder.json (S2, World), deliberate; was 94.   // +7: the as-data clamp rows (the two mob-dress soot caps became World's constants, #3066), deliberate. Before that +27: the wide combat camera's rows (camEase*, camP* portrait, camL* landscape; combat-cam.ts, Web 2026-10-17), deliberate; +2: gearWarmSettle, gearWarmBound (the gear sheet's mannequin warm and its hard bound)
});
test('the loader refuses a missing named rule, a non-positive value and a duplicate id; a new row is one entry', () => {
  const rows = DEFS.rules;
  assert.throws(() => loadPreviewRules({ rules: rows.filter((r) => r.id !== 'lookGain') }), /"lookGain" rule by name/);
  assert.throws(() => loadPreviewRules({ rules: rows.map((r) => (r.id === 'nearTick' ? { ...r, value: 0 } : r)) }), /value is a number > 0/);
  assert.throws(() => loadPreviewRules({ rules: [...rows, rows[0]!] }), /duplicate|twice|unique/i);
  assert.equal(loadPreviewRules({ rules: [...rows, { id: 'extra', value: 2, unit: 'm' }] }).length, 101);
  assert.deepEqual(['loadCoverFadeMs', 'loadCoverHoldMs'].map((id) => previewRule(id as never)), [400, 12000]);   // load-cover.ts
  assert.deepEqual(['forgeHalfX', 'forgeHalfZ'].map((id) => previewRule(id as never)), [2.2, 2.6]);   // exchange-plan.ts FORGE_HALF
});
