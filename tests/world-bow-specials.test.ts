import './lib/era-on.ts';   // the shipped sandbox rows (bow missile row, bowSpecial rows, bands) are the live game's: this file tests the live era
import test from 'node:test';
import assert from 'node:assert/strict';
import { player, type Event, type Fighter, type Input } from '../src/fight/world.ts';
import { heroSheeted, openBout, stepBout } from '../src/fight/open-fight.ts';
import { RECORD_VERSION } from '../src/fight/record.ts';
import { WORLD_SIM_VERSION, replayWorldRecord, ME, type WorldRecord } from '../src/fight/world-record.ts';
import { underRecord } from '../src/fight/detmath.ts';
import { FIRST_ROWS83_VERSION } from '../src/fight/sandbox-era.ts';
import { bowSpecialRows, missileMinGap, missileOf } from '../src/fight/sandbox-rules.ts';
import type { SkillId, WeaponId } from '../src/fight/moves.ts';

// RV83 (Backend's finding at RV82 on a disposable DB): an open-world hero with a bow and a picked special threw the melee skill swing (no special share without a spell: open-fight.ts heroSheeted),
// which whiffed at range with no arrow. From RV83 he carries the Pit hero's share, so beyond the missile gap the special is the bow special's arrows, inside it the melee special; any other weapon is unchanged.
const TICK = 1 / 60, IDLE: Input = { x: 0, z: 0 };
type Run = { events: Event[]; foe: Fighter; pit: string[] };
/** The hero at the origin facing +z, a still player foe `gap` metres away (no brain: it stands), one SPECIAL press, then `ticks` idle ticks. */
function fight(weapon: WeaponId, skill: SkillId, gap: number, ticks = 240): Run {
  const hero = player(ME, 0, 0, 0, 1, skill, { weapon }), foe = player('p2', 0, gap, Math.PI, 1, null);
  let bout = openBout(hero, foe);
  const events: Event[] = [];
  for (let k = 0; k <= ticks; k++) { const r = stepBout(bout, hero, foe, k === 0 ? { ...IDLE, special: true } : IDLE, IDLE, TICK, k); bout = r.bout; events.push(...r.events); }
  return { events, foe, pit: events.map((e) => (e.pit as { type?: string } | undefined)?.type ?? '') };
}
const hitsOnFoe = (r: Run) => r.events.filter((e): e is Extract<Event, { type: 'Hit' }> => e.type === 'Hit' && e.victim === 'p2');

test('the shipped rows: the bow has a bow missile row and the four bow specials exist', () => {
  assert.equal(missileOf('bow')?.kind, 'bow');
  for (const s of ['cleave', 'reaping', 'stomp', 'lunge']) assert.ok(bowSpecialRows().some((r) => r.skill === s), `bowSpecial row ${s}`);
  assert.ok(missileMinGap() > 0 && missileMinGap() < 4, 'a missile gap the 4 m test stands beyond');
});

for (const skill of ['cleave', 'reaping'] as const) {
  test(`a world bow hero with special ${skill} fires the bow special from range: arrows launch, hit, and the foe loses exactly that`, () => {
    const r = fight('bow', skill, 4);
    assert.ok(r.pit.includes('SpecialStarted'), 'the press is a special, not a swing');
    assert.ok(r.pit.includes('MissileLaunched'), `the arrows fly (${r.pit.filter(Boolean).join(',')})`);
    const hits = hitsOnFoe(r);
    assert.ok(hits.length > 0 && hits.every((h) => h.damage > 0), 'the arrows hit');
    assert.equal(r.foe.health, r.foe.maxHealth - hits.reduce((s, h) => s + h.damage, 0), 'the foe loses what the arrows dealt');
  });
}

test('the same bow hero inside the missile gap gets the melee special (no arrow)', () => {
  const r = fight('bow', 'cleave', 1.2);
  assert.ok(r.pit.includes('SpecialStarted') && r.pit.includes('SpecialLanded'), `the melee special lands up close (${r.pit.filter(Boolean).join(',')})`);
  assert.ok(!r.pit.includes('MissileLaunched'), 'no arrow inside the gap');
});

test('a longsword world hero under RV83 (a record at 83) is unchanged: no share, the special press is the skill swing (RV84 widens the share: tests/world-picked-specials.test.ts)', () => {
  const hero = player(ME, 0, 0, 0, 1, 'cleave', { weapon: 'longsword' });
  underRecord({ v: FIRST_ROWS83_VERSION }, () => {
    assert.equal(heroSheeted(hero).specialShare, undefined);
    assert.deepEqual(heroSheeted(hero), underRecord({ v: FIRST_ROWS83_VERSION - 1 }, () => heroSheeted(hero)), 'the same hero before and after RV83');
    const r = fight('longsword', 'cleave', 1.2);
    assert.ok(!r.pit.includes('SpecialStarted') && r.pit.includes('AttackStarted'), 'the skill swing, as before');
  });
});

test('a record stamped 82 keeps the old hero: no share, the bow special press is the melee skill swing and no arrow flies; a world record below 83 is refused, not replayed under RV83', () => {
  assert.equal(RECORD_VERSION, 88);
  const old = underRecord({ v: 82 }, () => {
    assert.equal(heroSheeted(player(ME, 0, 0, 0, 1, 'cleave', { weapon: 'bow' })).specialShare, undefined, 'v82: the bow hero has no share');
    return fight('bow', 'cleave', 4);
  });
  assert.ok(!old.pit.includes('SpecialStarted') && !old.pit.includes('MissileLaunched'), `v82: the old swing, no arrow (${old.pit.filter(Boolean).join(',')})`);
  assert.ok(old.pit.includes('AttackStarted'), 'v82: the melee skill swing');
  const hero = { weapon: 'bow' as WeaponId, level: 1, health: 100, stamina: 100, posture: 0, exhausted: false, skill: 'cleave' as SkillId, x: 0, z: 0, facing: 0 };
  const rec = { rv: 82, wv: WORLD_SIM_VERSION, hero, joins: [], releases: [], steps: [{ pose: { x: 0, z: 0, f: 0 }, guard: false, gd: null, attack: null, roll: null }] } as unknown as WorldRecord;
  assert.deepEqual(replayWorldRecord(rec), { ok: false, reason: 'sim version' });
});
