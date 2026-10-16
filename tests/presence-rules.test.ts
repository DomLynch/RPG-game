// The presence server's limits are rows (origins/presence/presence-rules-defs.json): every default equals the literal it replaced, the loader refuses a broken table.
import assert from 'node:assert/strict';
import test from 'node:test';
import { PRESENCE_RULES, loadPresenceRules, presenceRule } from '../origins/presence/presence-rules.ts';
import { RULES } from '../origins/presence/interest.ts';
import { LIMITS } from '../origins/presence/server.ts';
import { SAVE_QUEUE_MAX } from '../origins/presence/saves.ts';
import { TOWN_CM, REJOIN_EDGE, CENTRE_CM } from '../origins/presence/zones.ts';
import DEFS from '../origins/presence/presence-rules-defs.json' with { type: 'json' };

test('every presence rule equals the literal it replaced', () => {
  assert.deepEqual(RULES, { cellCm: 1600, radiusCm: 4000, nearCap: 40, tiers: [[1200, 1], [2500, 2], [4000, 5]], tickMs: 100, softCap: 80, hardCap: 100, maxSpeedCmS: 700, speedSlack: 1.5, strikesToDrop: 5, strikeWindowMs: 10_000, emptyLayerMs: 300_000, memoryMs: 600_000, memoryMax: 10_000 });
  assert.deepEqual(LIMITS, { maxMessage: 64, perSecond: 30, idleMs: 30_000, ipSockets: 8, ipJoinsPerMinute: 30, beatMs: 2000 });
  assert.deepEqual([SAVE_QUEUE_MAX, presenceRule('tickRing'), TOWN_CM, presenceRule('rejoinPastGateCm')], [10_000, 40_000, 30_000, 50]);
  assert.ok(REJOIN_EDGE.x > 0 && CENTRE_CM === 40_000);
  assert.equal(PRESENCE_RULES.length, 29);
  assert.equal(presenceRule('warpPerMin'), 6);
});
test('the loader refuses a missing named rule, a non-positive value and a duplicate id; a new row is one entry', () => {
  const rows = DEFS.rules;
  assert.throws(() => loadPresenceRules({ rules: rows.filter((r) => r.id !== 'cellCm') }), /"cellCm" rule by name/);
  assert.throws(() => loadPresenceRules({ rules: rows.map((r) => (r.id === 'tickMs' ? { ...r, value: 0 } : r)) }), /value is a number > 0/);
  assert.throws(() => loadPresenceRules({ rules: [...rows, rows[0]!] }), /duplicate|twice|unique/i);
  assert.equal(loadPresenceRules({ rules: [...rows, { id: 'extra', value: 2, unit: 'm' }] }).length, 30);
});
