// The server and contract cadences as rows (Dom's data-layer rule, audit #3055): every value keeps the number it had in code.
import assert from 'node:assert/strict';
import test from 'node:test';
import { COOLDOWN_STEPS_S, FIRST_TRADE_DELAY_S, cooldownSecondsFor } from '../src/core/contracts/economy.ts';
import { MAX_EVENT_MINUTES } from '../src/core/live-ops.ts';
import { rememberZone1, takeZone1 } from '../src/zone1-hop.ts';
import { loadRegistry, tableFromFile, type Manifest } from '../src/core/registry.ts';
import { SAVE_EVERY_MS } from '../origins/presence/saves.ts';
import { MAX_FIGHT_TICKS } from '../origins/server/encounter-verify.ts';
import { FIGHT_HALF_TICKS } from '../origins/patrons/patrons.ts';
import { STEP } from '../src/fight/server.ts';
import raw from '../src/core/cadence-rules.json' with { type: 'json' };
import man from '../src/core/cadence-rules.manifest.json' with { type: 'json' };

const HOUR_S = 3600, DAY_S = 24 * HOUR_S;

test('every cadence keeps the number it had in code', () => {
  assert.equal(SAVE_EVERY_MS, 5 * 60_000);
  assert.equal(MAX_FIGHT_TICKS, Math.round(15 * 60 / STEP));
  assert.equal(FIGHT_HALF_TICKS, 20 * 60);
  assert.equal(MAX_EVENT_MINUTES, 7 * 24 * 60);
  assert.equal(FIRST_TRADE_DELAY_S, 72 * HOUR_S);
  assert.deepEqual([...COOLDOWN_STEPS_S], [7 * DAY_S, 14 * DAY_S, 30 * DAY_S]);
  assert.deepEqual([0, 1, 2, 3, 9].map(cooldownSecondsFor), [72 * HOUR_S, 7 * DAY_S, 14 * DAY_S, 30 * DAY_S, 30 * DAY_S], 'the wait by hops, every later trade on the last step');
});

test('the sign-in hop mark expires at the row\'s 10 minutes', () => {
  const mk = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }; };
  assert.equal(raw.zone1Hop[0]!.nextTtlMs, 10 * 60_000);
  const at = 1_000_000;
  for (const [after, want] of [[10 * 60_000, true], [10 * 60_000 + 1, false]] as const) {
    const s = mk();
    assert.equal(rememberZone1('?account=signin&next=zone1', s, at), true);
    assert.equal(takeZone1(s, at + after) !== null, want, `${after} ms after the mark`);
  }
});

test('the cooldown steps are rows for hops 1..n with no gap, and the file loads through the registry', () => {
  assert.deepEqual(raw.tradeCooldownStep.map((r) => r.hops).sort((a, b) => a - b), raw.tradeCooldownStep.map((_, i) => i + 1));
  assert.ok(loadRegistry(man.tables.map((t) => tableFromFile(t as unknown as Manifest, raw, 'cadence-rules.json'))));
});
