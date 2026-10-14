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
  assert.equal(PREVIEW_RULES.length, 35);
});
test('the loader refuses a missing named rule, a non-positive value and a duplicate id; a new row is one entry', () => {
  const rows = DEFS.rules;
  assert.throws(() => loadPreviewRules({ rules: rows.filter((r) => r.id !== 'lookGain') }), /"lookGain" rule by name/);
  assert.throws(() => loadPreviewRules({ rules: rows.map((r) => (r.id === 'nearTick' ? { ...r, value: 0 } : r)) }), /value is a number > 0/);
  assert.throws(() => loadPreviewRules({ rules: [...rows, rows[0]!] }), /duplicate|twice|unique/i);
  assert.equal(loadPreviewRules({ rules: [...rows, { id: 'extra', value: 2, unit: 'm' }] }).length, 36);
});
