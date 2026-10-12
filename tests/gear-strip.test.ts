import test from 'node:test';
import assert from 'node:assert/strict';
import { GEAR_STATS, statRows, type GearStat } from '../src/core/gear-strip.ts';
import { gearNumbers } from '../src/fight/gear-numbers.ts';
import { RULES } from '../src/fight/moves.ts';
import type { Loot } from '../src/core/loot.ts';

// The Gear tab's strip is rows, not markup: a row with a value is drawn, a row without one is not, and a new attribute is one more row (the follow-up feeds the rows from Combat's attribute table).
test('statRows draws the rows that have a value, in registry order, and skips the rest', () => {
  assert.deepEqual(statRows({ base: { health: 150, stamina: 100 }, worn: [] }).map((r) => `${r.label} ${r.value}`), ['Health 150', 'Stamina 100']);
  assert.deepEqual(statRows({ base: { health: 150 }, worn: [] }).map((r) => r.id), ['health'], 'a stat the host does not know is not invented');
  assert.deepEqual(statRows({ base: {}, worn: [] }), [], 'no numbers, no strip');
});
test('a new attribute is a row: no panel code names it', () => {
  const mana: GearStat = { id: 'mana', label: 'Mana', read: (c) => c.base.mana ?? null };
  assert.deepEqual(statRows({ base: { health: 150, mana: 162.4 }, worn: [] }, [...GEAR_STATS, mana]).map((r) => `${r.label} ${r.value}`), ['Health 150', 'Mana 162']);
  assert.deepEqual(statRows({ base: { x: NaN }, worn: [] }, [{ id: 'x', label: 'X', read: (c) => c.base.x ?? null }]), [], 'a non-finite value is skipped');
});
test('gearNumbers: the combat constants, and gear tilt in whole points from the Attack/RES table (no gear, or pieces with no rung, is 0 and 0)', () => {
  const naked = gearNumbers(undefined);
  assert.deepEqual(naked, { health: RULES.health, stamina: 100, attack: 0, res: 0 });
  const noRung: Loot = { owned: ['veteran.Helmet'], equipped: { head: 'veteran.Helmet' } };
  assert.deepEqual(gearNumbers(noRung), naked, 'a piece with no recorded rung is the identity, never a guess');
  const worn: Loot = { owned: ['veteran.Helmet', 'veteran.Body'], equipped: { head: 'veteran.Helmet', chest: 'veteran.Body' }, taken: { 'veteran.Helmet': { opponent: 'veteran', attempt: 1, healthLeft: 50, recordId: null, day: '2026-10-12', tier: 10 }, 'veteran.Body': { opponent: 'veteran', attempt: 1, healthLeft: 50, recordId: null, day: '2026-10-12', tier: 10 } } };
  const n = gearNumbers(worn);
  assert.ok(n.res > 0 && n.res <= 20, `two top-rung armour pieces tilt RES a little, never past the 20 cap: ${n.res}`); assert.equal(n.attack, 0, 'armour carries no Attack');
  assert.deepEqual(statRows({ base: n, worn: [] }).map((r) => r.id), ['health', 'stamina', 'attack', 'res']);
});
