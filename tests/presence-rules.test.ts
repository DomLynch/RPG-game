// The presence server's limits are rows (origins/presence/presence-rules-defs.json): every default equals the literal it replaced, the loader refuses a broken table.
import './lib/era-off.ts';   // RV78: the legacy suite runs on trunk's rules; sandbox-era.ts is the one switch (tests/lib/era-off.ts)
import assert from 'node:assert/strict';
import test from 'node:test';
import { PRESENCE_RULES, loadPresenceRules, presenceRule } from '../origins/presence/presence-rules.ts';
import { RULES } from '../origins/presence/interest.ts';
import { LIMITS } from '../origins/presence/server.ts';
import { SAVE_QUEUE_MAX } from '../origins/presence/saves.ts';
import { MAX_ENTITIES } from '../origins/presence/wire.ts';
import { TOWN_CM, REJOIN_EDGE, CENTRE_CM } from '../origins/presence/zones.ts';
import DEFS from '../origins/presence/presence-rules-defs.json' with { type: 'json' };

test('every presence rule equals the literal it replaced', () => {
  assert.deepEqual(RULES, { cellCm: 1600, radiusCm: 4000, nearCap: 40, tiers: [[1200, 1], [2500, 2], [4000, 5]], tickMs: 100, softCap: 80, hardCap: 100, maxSpeedCmS: 700, speedSlack: 1.5, strikesToDrop: 5, strikeWindowMs: 10_000, emptyLayerMs: 300_000, memoryMs: 600_000, memoryMax: 10_000, jitterMs: 500 });
  // ipSockets 8 -> 16 and guestIpSockets 2 -> 8 (2026-10-21, Lead): carrier NAT puts many phones on one public IP, and the old guest cap of 2 refused a third signed-out player (live: six `guest-ip` 429s in the presence log, 10:54 to 10:55). ipJoinsPerMinute stays 30: it is the abuse bound on one address.
  assert.deepEqual(LIMITS, { maxMessage: 64, perSecond: 30, idleMs: 30_000, ipSockets: 16, ipJoinsPerMinute: 30, beatMs: 2000 });
  assert.deepEqual([SAVE_QUEUE_MAX, presenceRule('tickRing'), TOWN_CM, presenceRule('rejoinPastGateCm')], [10_000, 40_000, 30_000, 50]);
  assert.ok(REJOIN_EDGE.x > 0 && CENTRE_CM === 40_000);
  assert.equal(presenceRule('tickFloorMs'), 5, 'the tick-check interval floor');
  assert.equal(MAX_ENTITIES, 255, 'the packet count is one byte');
  assert.equal(PRESENCE_RULES.length, 53);
  assert.equal(presenceRule('announceMaxChars'), 120, 'the longest boss-shout line (announce-rows.json) a banner holds');
  assert.deepEqual([presenceRule('roadBehindM'), presenceRule('roadPastM')], [2.5, 0.5], 'the west road\'s margins zones.ts used to hold');
  assert.deepEqual([presenceRule('whereTimeoutMs'), presenceRule('wornPokeTimeoutMs'), presenceRule('presencePort'), presenceRule('logEveryMs'), presenceRule('testIpSockets'), presenceRule('testIpJoinsPerMinute')], [1500, 1000, 8793, 60_000, 1000, 100_000], 'the literals where.ts and main.ts used to hold');
  assert.deepEqual([presenceRule('maxLayers'), presenceRule('internalBodyMax'), presenceRule('tokenMaxChars'), presenceRule('tickChecksPerTick')], [20, 1024, 4096, 4], 'the literals server.ts used to hold (maxLayers 8 -> 20, 2026-10-19: 8 layers at the 80 soft cap stopped one process at 640 players; 20 holds the measured ~1,500 per process, docs/specs/origins/per-layer-spawns.md section 5)');
  assert.deepEqual([presenceRule('writerWornTimeoutMs'), presenceRule('writerSavedTimeoutMs'), presenceRule('writerSaveTimeoutMs')], [1500, 500, 1500], 'the writer-call timeouts location.ts used to hold');
  assert.deepEqual([presenceRule('warpPerMin'), presenceRule('guestIpSockets'), presenceRule('guestCeiling'), presenceRule('wornEveryMs'), presenceRule('closeGraceMs'), presenceRule('wornPokeGapMs'), presenceRule('saveEveryMs')], [6, 8, 64, 30_000, 1000, 500, 5 * 60_000], 'guestIpSockets 2 -> 8 (2026-10-21: carrier NAT, see the LIMITS pin above); guestCeiling 64 still bounds all guests together');
});
test('the loader refuses a missing named rule, a non-positive value and a duplicate id; a new row is one entry', () => {
  const rows = DEFS.rules;
  assert.throws(() => loadPresenceRules({ rules: rows.filter((r) => r.id !== 'cellCm') }), /"cellCm" rule by name/);
  assert.throws(() => loadPresenceRules({ rules: rows.map((r) => (r.id === 'tickMs' ? { ...r, value: 0 } : r)) }), /value is a number > 0/);
  assert.throws(() => loadPresenceRules({ rules: [...rows, rows[0]!] }), /duplicate|twice|unique/i);
  assert.equal(loadPresenceRules({ rules: [...rows, { id: 'extra', value: 2, unit: 'm' }] }).length, 54);
});
