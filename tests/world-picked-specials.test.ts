import './lib/era-on.ts';   // the shipped sandbox rows are the live game's: this file tests the live era
import test from 'node:test';
import assert from 'node:assert/strict';
import { player, type Event, type Input } from '../src/fight/world.ts';
import { heroSheeted, openBout, stepBout } from '../src/fight/open-fight.ts';
import { RECORD_VERSION } from '../src/fight/record.ts';
import { ME } from '../src/fight/world-record.ts';
import { underRecord } from '../src/fight/detmath.ts';
import { FIRST_ROWS84_VERSION } from '../src/fight/sandbox-era.ts';
import { bandFactor, bestRange } from '../src/fight/bands.ts';
import type { SkillId, WeaponId } from '../src/fight/moves.ts';

// RV84 (Strategy's audit of the sandbox against trunk): an open-world hero with a picked skill is a `picked` fighter like the Pit's slot-1 hero, so his melee special takes the sandbox's windup, reach limit and
// release rules; and the sandbox's reach-band rows for the bite, warhammer, reaper, bow and staff apply. Both are era-keyed: a record below 84 keeps the old hero and the unscaled blows.
const TICK = 1 / 60, IDLE: Input = { x: 0, z: 0 };
type PitEvent = { type?: string; tick?: number };
/** The hero at the origin facing +z, a still player foe `gap` metres away, one SPECIAL press, then `ticks` idle ticks: the Pit events in order. */
function fight(weapon: WeaponId, skill: SkillId, gap: number, ticks = 400): PitEvent[] {
  const hero = player(ME, 0, 0, 0, 1, skill, { weapon }), foe = player('p2', 0, gap, Math.PI, 1, null);
  let bout = openBout(hero, foe);
  const events: Event[] = [];
  for (let k = 0; k <= ticks; k++) { const r = stepBout(bout, hero, foe, k === 0 ? { ...IDLE, special: true } : IDLE, IDLE, TICK, k); bout = r.bout; events.push(...r.events); }
  return events.map((e) => (e.pit ?? {}) as PitEvent);
}
const tickOf = (evs: PitEvent[], type: string): number | undefined => evs.find((e) => e.type === type)?.tick;

const names = (evs: PitEvent[]): string => evs.map((e) => e.type).filter(Boolean).join(',');
type Pick = { picked?: true; specialShare?: number };

test('the live world hero with a picked skill carries the special share and is `picked`; a record below 84 keeps the old hero; no skill, neither', () => {
  assert.ok(RECORD_VERSION >= 84, 'RV84 or later');
  const hero = player(ME, 0, 0, 0, 1, 'cleave', { weapon: 'longsword' });
  assert.equal((heroSheeted(hero) as Pick).picked, true, 'live: picked');
  assert.ok(((heroSheeted(hero) as Pick).specialShare ?? 0) > 0, 'live: the special share');
  const old = underRecord({ v: FIRST_ROWS84_VERSION - 1 }, () => heroSheeted(hero) as Pick);
  assert.equal(old.picked, undefined, 'v83: not picked'); assert.equal(old.specialShare, undefined, 'v83: no share');
  const bare = heroSheeted(player(ME, 0, 0, 0, 1, null, { weapon: 'longsword' })) as Pick;
  assert.equal(bare.picked, undefined, 'no skill: not picked'); assert.equal(bare.specialShare, undefined, 'no skill: no share');
});

test('a world melee special is now the Pit special cast: it starts, winds up and lands; under v83 the press is the skill swing, no special', () => {
  const live = fight('longsword', 'cleave', 1.2), old = underRecord({ v: FIRST_ROWS84_VERSION - 1 }, () => fight('longsword', 'cleave', 1.2));
  assert.ok(tickOf(live, 'SpecialStarted') !== undefined && tickOf(live, 'SpecialLanded') !== undefined, `live: the special starts and lands (${names(live)})`);
  assert.ok(tickOf(live, 'SpecialLanded')! - tickOf(live, 'SpecialStarted')! >= 20, 'live: a wind-up, not an instant swing');
  assert.ok(tickOf(old, 'SpecialStarted') === undefined && tickOf(old, 'AttackStarted') !== undefined, `v83: the skill swing (${names(old)})`);
});

test('a world melee special pressed beyond the sandbox reach is refused live (no cast, nothing spent); v83 swings the skill move anyway', () => {
  const live = fight('longsword', 'cleave', 4), old = underRecord({ v: FIRST_ROWS84_VERSION - 1 }, () => fight('longsword', 'cleave', 4));
  assert.ok(tickOf(live, 'SpecialStarted') === undefined && tickOf(live, 'AttackStarted') === undefined, `live: out of reach, no cast (${names(live)})`);
  assert.ok(tickOf(old, 'AttackStarted') !== undefined, `v83: the skill swing at any distance (${names(old)})`);
});

test('the added band rows: the reaper, bite, warhammer, bow and staff take the off-band penalty live and none below 84', () => {
  for (const [weapon, gap] of [['reaper', 1.5], ['bite', 2], ['warhammer', 1], ['bow', 1], ['staff', 1]] as [WeaponId, number][]) {
    assert.ok(bestRange(weapon), `${weapon} has a best band live`);
    assert.ok(bandFactor(weapon, gap) < 1, `${weapon} off its band at ${gap} m is scaled live`);
    assert.equal(underRecord({ v: FIRST_ROWS84_VERSION - 1 }, () => bandFactor(weapon, gap)), 1, `${weapon}: unscaled below 84`);
    assert.equal(underRecord({ v: FIRST_ROWS84_VERSION - 1 }, () => bestRange(weapon)), undefined, `${weapon}: no band row below 84`);
  }
});
