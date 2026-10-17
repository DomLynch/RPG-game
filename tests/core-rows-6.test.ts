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
import { PERK_BUDGET_PERMILLE, PERK_TEMPLATE_DATA } from '../origins/patrons/patrons.ts';
import { GEAR_STATS } from '../src/core/gear-strip.ts';
import perkRaw from '../origins/patrons/perk-templates.json' with { type: 'json' };
import perkMan from '../origins/patrons/perk-templates.manifest.json' with { type: 'json' };
import stripRaw from '../src/core/gear-strip-rows.json' with { type: 'json' };
import stripMan from '../src/core/gear-strip-rows.manifest.json' with { type: 'json' };
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

test('the patron perk templates and the gear strip rows are byte-equal to the tables they replaced', () => {
  const B = PERK_BUDGET_PERMILLE, D = 'damageDealtPermille', T = 'damageTakenPermille', S = 'staminaCostPermille';
  const side = (when: string, stat: string, value: number) => ({ when, stat, value });
  const old = [
    { id: 'day-half', gain: side('clock-half:day', D, B), cost: side('clock-half:night', D, -B) },
    { id: 'night-half', gain: side('clock-half:night', D, B), cost: side('clock-half:day', D, -B) },
    { id: 'waxing', gain: side('moon:waxing', D, B), cost: side('moon:waning', D, -B) },
    { id: 'opener', gain: side('fight-time:before-20s', D, B), cost: side('fight-time:after-20s', D, -B) },
    { id: 'closer', gain: side('fight-time:after-20s', D, B), cost: side('fight-time:before-20s', D, -B) },
    { id: 'underdog', gain: side('foe-level:higher', D, B), cost: side('foe-level:lower', D, -B) },
    { id: 'finisher', gain: side('foe-health:below-half', D, B), cost: side('foe-health:above-half', D, -B) },
    { id: 'last-stand', gain: side('self-health:below-half', D, B), cost: side('self-health:above-half', D, -B) },
    { id: 'iron-hide', gain: side('always', T, -B), cost: side('always', D, -B) },
    { id: 'glass', gain: side('always', D, B), cost: side('always', T, B) },
    { id: 'tireless', gain: side('always', S, -B), cost: side('always', D, -B) },
  ].map((t) => ({ kind: 'perk-template', schemaVersion: 1, ...t }));
  assert.equal(JSON.stringify(PERK_TEMPLATE_DATA), JSON.stringify(old), 'the same objects in the same key order');
  assert.deepEqual(GEAR_STATS.map((s) => [s.id, s.label]), [['health', 'Health'], ['stamina', 'Stamina'], ['attack', 'Attack'], ['res', 'Resistance']]);
  const base = { health: 150, stamina: 90, attack: 15, res: 20 };
  assert.deepEqual(GEAR_STATS.map((s) => s.read({ base, worn: [] })), [150, 90, 15, 20]);
  assert.deepEqual(GEAR_STATS.map((s) => s.read({ base: {}, worn: [] })), [null, null, null, null], 'a stat the host does not hand in is not invented');
  for (const [r, m, name] of [[perkRaw, perkMan, 'perk-templates.json'], [stripRaw, stripMan, 'gear-strip-rows.json']] as const)
    assert.ok(loadRegistry(m.tables.map((t) => tableFromFile(t as unknown as Manifest, r, name))));
});

test('the cooldown steps are rows for hops 1..n with no gap, and the file loads through the registry', () => {
  assert.deepEqual(raw.tradeCooldownStep.map((r) => r.hops).sort((a, b) => a - b), raw.tradeCooldownStep.map((_, i) => i + 1));
  assert.ok(loadRegistry(man.tables.map((t) => tableFromFile(t as unknown as Manifest, raw, 'cadence-rules.json'))));
});
