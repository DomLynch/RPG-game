// The sandbox's melee-special rules (windup 32, reach 220 / slack 40, react) are scoped to the player's PICKED special (a skill, no `specialName`): a NAMED class special (witch, plague doctor, a boss) keeps trunk's windup, reach and react
// (Combat RV78, Lead). So the class-special battery (the opponent casts its own class special, nothing picked) fights the same with the era ON as with the era OFF.
import test from 'node:test';
import assert from 'node:assert/strict';
import { setSandbox, underSandbox } from '../src/fight/sandbox-era.ts';
import { setStab } from '../src/fight/stab-rule.ts';
import { classSpecialBatteryHash } from './lib/class-special-battery.ts';

test('a named class special at the ON rows is the era-OFF fight', () => {
  setStab(true);
  try {
    setSandbox(true);
    const on = classSpecialBatteryHash();
    const off = underSandbox(0, () => classSpecialBatteryHash());   // a record below v78: the era OFF
    assert.equal(on, off, 'windup, reach and react do not touch a class special');
  } finally { setStab(false); setSandbox(true); }
});
