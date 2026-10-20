import './lib/era-on.ts';   // the shipped rows are the live game's: this file tests the live era
import test from 'node:test';
import assert from 'node:assert/strict';
import { player, type Event, type Input } from '../src/fight/world.ts';
import { openBout, stepBout } from '../src/fight/open-fight.ts';
import { RECORD_VERSION } from '../src/fight/record.ts';
import { ME, quantStep, stepHero, packWorldRecord, unpackWorldRecord, WORLD_SIM_VERSION, type WorldRecord } from '../src/fight/world-record.ts';
import { underRecord } from '../src/fight/detmath.ts';
import { FIRST_ROWS85_VERSION } from '../src/fight/sandbox-era.ts';
import { RULES } from '../src/fight/moves.ts';

// RV85 / WSV64 (Dom 2026-10-20: "hold heavy works in the Pit, just not in Zone 1"): the open world carries the held STRIKE into the sim, so a held heavy chambers and charges as the Pit's does (duel.ts chamber, RULES.charge)
// and lands harder than the uncharged heavy the world threw before. Era-keyed: a record below 85 never carries the bit and replays the uncharged heavy.
const TICK = 1 / 60, IDLE: Input = { x: 0, z: 0 };
type PitEvent = { type?: string; tick?: number; damage?: number };
/** The hero facing a still foe 1.2 m away: a heavy press at tick 0, the STRIKE held for the first `holdTicks` ticks (0 = a tap), then idle: the Pit events in order. */
function heavy(holdTicks: number, ticks = 500): PitEvent[] {
  const hero = player(ME, 0, 0, 0, 1, null, { weapon: 'longsword' }), foe = player('p2', 0, 1.2, Math.PI, 1, null);
  let bout = openBout(hero, foe); const events: Event[] = [];
  for (let k = 0; k <= ticks; k++) { const input: Input = { ...IDLE, ...(k === 0 ? { attack: 'heavy' as const } : {}), ...(k < holdTicks ? { held: true } : {}) }; const r = stepBout(bout, hero, foe, input, IDLE, TICK, k); bout = r.bout; events.push(...r.events); }
  return events.map((e) => (e.pit ?? {}) as PitEvent);
}
const hit = (evs: PitEvent[]): PitEvent | undefined => evs.find((e) => e.type === 'Hit');

test('a held heavy in the world chambers and charges: it lands later and harder than the uncharged heavy', () => {
  assert.equal(RECORD_VERSION, 85);
  const tap = hit(heavy(0)), held = hit(heavy(RULES.charge.max + 40));
  assert.ok(tap?.damage && held?.damage, `both heavies land (tap ${JSON.stringify(tap)}, held ${JSON.stringify(held)})`);
  assert.ok(held!.tick! > tap!.tick!, `the held heavy chambers, so it lands later (${held!.tick} > ${tap!.tick})`);
  assert.ok(held!.damage! > tap!.damage!, `and lands harder (${held!.damage} > ${tap!.damage})`);
});

test('under a record below 85 the held bit is ignored: the heavy is the uncharged one', () => {
  const old = underRecord({ v: FIRST_ROWS85_VERSION - 1 }, () => hit(heavy(RULES.charge.max + 40))), tap = hit(heavy(0));
  assert.deepEqual({ tick: old?.tick, damage: old?.damage }, { tick: tap?.tick, damage: tap?.damage }, 'v84: held changes nothing');
});

test('the held bit rides the world record: a step packs and unpacks with it, and a step without it is byte for byte as before', () => {
  assert.equal(WORLD_SIM_VERSION, 64);
  const steps = [{ pose: { x: 0, z: 0, f: 0 }, guard: false, gd: null, attack: 'heavy' as const, roll: null, held: true as const }, { pose: null, guard: false, gd: null, attack: null, roll: null }];
  const rec = { rv: RECORD_VERSION, wv: WORLD_SIM_VERSION, hero: { level: 1, weapon: 'longsword', health: 100, stamina: 100, posture: 0, exhausted: false }, joins: [], releases: [], steps } as unknown as WorldRecord;
  const back = unpackWorldRecord(packWorldRecord(rec));
  assert.equal(back.steps[0]!.held, true); assert.equal('held' in back.steps[1]!, false);
  assert.deepEqual(quantStep(null, false, null, null), { pose: null, guard: false, gd: null, attack: null, roll: null }, 'no hold: the step is exactly as before');
  assert.equal(quantStep(null, false, 'heavy', null, null, false, false, true).held, true);
  assert.equal(typeof stepHero, 'function');
});
