// The sandbox's melee-special rules (windup 32, reach 220 / slack 40, react) are scoped to the player's PICKED special (a skill, no `specialName`): a NAMED class special (witch, plague doctor, a boss) keeps trunk's windup, reach and react
// (Combat RV78, Lead). So the class-special battery (the opponent casts its own class special, nothing picked) fights the same with ONLY those rows on as with the era OFF.
// The other shipped rows (weapon commit / bind / brace, executeMult, bands ...) legitimately change every weapon fight, class-special fights included, so they are held off here: this test is about the melee-special rows alone.
import './lib/era-on.ts';   // RV78: this file switches the era itself (setSandbox); era-on.ts lifts the force tests/lib/era-off.ts sets (import it FIRST)
import test from 'node:test';
import assert from 'node:assert/strict';
import DEFS from '../src/fight/sandbox-rules-defs.json' with { type: 'json' };
import { setSandbox, underSandbox } from '../src/fight/sandbox-era.ts';
import { setStab } from '../src/fight/stab-rule.ts';
import { classSpecialBatteryHash } from './lib/class-special-battery.ts';

const MELEE_SPECIAL_ROWS = /^(specialMeleeWindup|specialMeleeReach|specialMeleeSlack|specialReact|specialReactStagger|specialReactKnock|specialReactPosture)$/;
const TABLES_KEPT = new Set(['rules', 'specialReactFloor']);

test('a named class special at the melee-special rows is the era-OFF fight', () => {
  const defs = DEFS as unknown as Record<string, { id?: string; value?: number }[]>;
  const saved = Object.fromEntries(Object.entries(defs).map(([k, rows]) => [k, rows.map((r) => ({ ...r }))]));
  setStab(true);
  try {
    for (const rule of defs.rules!) if (!MELEE_SPECIAL_ROWS.test(rule.id ?? '')) rule.value = 0;   // every other rule off
    for (const [table, rows] of Object.entries(defs)) if (!TABLES_KEPT.has(table)) rows.length = 0;   // every other table empty
    setSandbox(false); setSandbox(true);   // re-read the rows
    const on = classSpecialBatteryHash();
    const off = underSandbox(0, () => classSpecialBatteryHash());   // a record below v78: the era OFF
    assert.equal(on, off, 'windup, reach and react do not touch a class special');
  } finally {
    for (const [table, rows] of Object.entries(saved)) defs[table]!.splice(0, defs[table]!.length, ...rows);
    setStab(false); setSandbox(false); setSandbox(true);
  }
});
