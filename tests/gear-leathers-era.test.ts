// Gear in the world (Dom 2026-10-17: Zone 1 fight stats come from the gear picked up): the leathers set (goblin, werewolf) takes a new shape from record version 74 (armour up instead of down), and a record
// fought before it still verifies against the shape it was fought with. The era lives in the set row (gear-defs.json sets eras), read by gearDeltas, and sets the floor a sheet fight is stamped at.
import assert from 'node:assert/strict';
import test from 'node:test';
import { loadGearDefs, GEAR, gearDeltas } from '../src/fight/gear-rows.ts';
import { wornGear } from '../src/fight/gear-stats.ts';
import { FIRST_CAST_PENALTY_VERSION } from '../src/fight/cast-penalty-era.ts';
import { RECORD_VERSION } from '../src/fight/record.ts';
import { TIERS } from '../src/core/grades.ts';
import GEAR_DEFS from '../src/fight/gear-defs.json' with { type: 'json' };

const FROM = GEAR.sets.leathers!.eras![0]!.fromRecordVersion;

test('leathers era: below it the old shape (stamina up, armour down), from it armour goes up', () => {
  const old = gearDeltas('leathers', 1, 0, FROM - 1), now = gearDeltas('leathers', 1, 0, FROM);
  assert.equal(old.armour, -25, 'a record fought before the era keeps the old armour'); assert.equal(old.stamina, 25);
  assert.ok(now.armour! > 0, 'from the era a worn leathers set adds armour'); assert.ok(now.magicResist! < 0, 'against some dial going down');
  assert.deepEqual(gearDeltas('leathers', 1, 0), gearDeltas('leathers', 1, 0, RECORD_VERSION), 'no version = this build');
  assert.deepEqual(gearDeltas('plate', 1, 0, FROM - 1), gearDeltas('plate', 1, 0, FROM), 'plate and robes have no era: they do not move');
});

test('leathers era: the starter pair and the whole goblin drop set now add armour; a sheet fight is stamped no lower than the era', () => {
  const pair = wornGear({ head: 'goblin.Helmet', legs: 'goblin.Greaves' } as never, () => TIERS[0]!), whole = wornGear({ head: 'goblin.Helmet', body: 'goblin.Body', arms: 'goblin.Arms', hands: 'goblin.Gloves', legs: 'goblin.Greaves', feet: 'goblin.Boots' } as never, () => TIERS[0]!);
  assert.ok(pair.armour! > 0, 'a picked-up helmet and shin plates count'); assert.ok(whole.armour! > pair.armour!, 'and more pieces count for more');
  assert.ok(FIRST_CAST_PENALTY_VERSION >= FROM, 'the sheet floor is no lower than the newest set era');
});

test('leathers era: the loader holds an era to the same rules as a shape, in rising order', () => {
  const sets = (eras: unknown) => ({ ...GEAR_DEFS, sets: GEAR_DEFS.sets.map((s) => (s.id === 'leathers' ? { ...s, eras } : s)) });
  assert.throws(() => loadGearDefs(sets([{ fromRecordVersion: 74, shape: { armour: 30, magicResist: -25 } }]) as never), /within \+-25/, 'a dial over shapeMax');
  assert.throws(() => loadGearDefs(sets([{ fromRecordVersion: 74, shape: { armour: 10 } }]) as never), /against some down/, 'all dials up');
  assert.throws(() => loadGearDefs(sets([{ fromRecordVersion: 80, shape: { armour: 10, stamina: -5 } }, { fromRecordVersion: 74, shape: { armour: 10, stamina: -5 } }]) as never), /rising order/, 'eras out of order');
});
