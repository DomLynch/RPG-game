// sandbox-mech: armour vs blow type. A blow has a kind (cut / stab / crush) from its weapon and move; the defender an armour class; a row scales the landed blow. No rows (trunk) = untouched.
import test from 'node:test';
import assert from 'node:assert/strict';
import DEFS from '../src/fight/sandbox-rules-defs.json' with { type: 'json' };

const d = DEFS as unknown as { rules: { id: string; value?: number }[]; blowKinds: { weapon: string; move: string; kind: string }[]; armourVs: { kind: string; armour: string; value: number }[] };
const shipped = [d.blowKinds.length, d.armourVs.length];
d.rules.find((r) => r.id === 'armourYou')!.value = 4;   // the loadout menu forces YOUR class to heavy
d.blowKinds.push({ weapon: '*', move: '*', kind: 'slash' }, { weapon: '*', move: 'thrust', kind: 'pierce' }, { weapon: 'maul', move: '*', kind: 'crush' });
d.armourVs.push({ kind: 'slash', armour: 'heavy', value: 600 }, { kind: 'pierce', armour: 'heavy', value: 900 }, { kind: 'crush', armour: 'heavy', value: 1400 }, { kind: 'slash', armour: 'light', value: 1300 });
const { blowKind, armourClassOf, armourPerMille } = await import('../src/fight/sandbox-rules.ts');

test('trunk ships armour-vs-blow off', () => assert.deepEqual(shipped, [0, 0]));
test('the most specific row names the blow kind', () => {
  assert.equal(blowKind('longsword', 'light_right'), 'slash');
  assert.equal(blowKind('longsword', 'thrust'), 'pierce');
  assert.equal(blowKind('maul', 'thrust'), 'crush', 'a maul crushes with everything: weapon+* beats *+thrust');
});
test('a creature reads its class from its gear owner; the player from the sheet', () => {
  assert.equal(armourClassOf(undefined, 'veteran'), 'heavy');
  assert.equal(armourClassOf(undefined, 'witch'), 'light');
  assert.equal(armourClassOf({ armour: 25 } as never, undefined), 'heavy');
  assert.equal(armourClassOf({ stamina: 25 } as never, undefined), 'medium');
  assert.equal(armourClassOf(undefined, undefined), null);
});
test('plate shrugs a cut, feels a stab less than a crush; cloth fears the cut; unknown = untouched', () => {
  assert.equal(armourPerMille('longsword', 'light_right', undefined, 'veteran'), 600);
  assert.equal(armourPerMille('longsword', 'thrust', undefined, 'veteran'), 900);
  assert.equal(armourPerMille('maul', 'heavy_overhead', undefined, 'veteran'), 1400);
  assert.equal(armourPerMille('longsword', 'light_right', undefined, 'witch'), 1300);
  assert.equal(armourPerMille('longsword', 'light_right', undefined, undefined), 1000);
  assert.equal(armourPerMille('longsword', 'thrust', undefined, 'witch'), 1000, 'no row for stab vs light here: untouched');
});
test('the loadout menu forces a side\'s class: your side heavy, the foe side still reads its own', () => {
  assert.equal(armourPerMille('longsword', 'light_right', undefined, undefined, 0), 600, 'forced heavy takes a cut at 600');
  assert.equal(armourPerMille('longsword', 'light_right', undefined, 'witch', 1), 1300, 'the foe side is not forced: the Witch is robes');
  assert.equal(armourPerMille('longsword', 'light_right', undefined, 'veteran', 0), 600, 'forced beats the creature\'s own class');
});
