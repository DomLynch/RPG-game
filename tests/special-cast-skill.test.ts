import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MOVES } from '../src/fight/moves.ts';
import { ROSTER, type OpponentId } from '../src/roster.ts';
import { isBloodTithe, isHadesShadow } from '../src/fight/special-timing.ts';
import { isCharge } from '../src/fight/charge-timing.ts';
import { isShieldQuake } from '../src/fight/special-fx-quake.ts';
import { isGoblinCast } from '../src/fight/special-fx-goblin.ts';
import { isPitbornSpecial } from '../src/fight/special-fx-pitborn.ts';

// Lead 2026-10-12 (check:as-data, #2323): a cast test names the class skill it draws (special-timing.ts skillCast); the skill's row says whose it is.
// Byte-identical: every opponent x actor x move answers exactly as the opponent-named test it replaced.
type Test = (opponent: OpponentId, actor: number, move?: string) => boolean;
const was = (opponent: string, move?: string): Test => (o, a, m) => o === opponent && a === 1 && (move === undefined || m === move);
export const CASES: [string, Test, Test][] = [
  ['isHadesShadow', isHadesShadow, was('nightborn', 'skill_lunge')],
  ['isBloodTithe', isBloodTithe, was('veteran', 'skill_shove')],
  ['isCharge', isCharge, was('veteran', 'skill_shove')],
  ['isShieldQuake', isShieldQuake, was('veteran', 'skill_shove')],
  ['isGoblinCast', isGoblinCast, was('goblin')],
  ['isPitbornSpecial', isPitbornSpecial, was('pitborn', 'skill_cleave')],
];
export const sweep = (cases: readonly [string, Test, Test][]) => {
  const opponents = Object.keys(ROSTER) as OpponentId[], moves = [undefined, 'none', ...Object.keys(MOVES)];
  for (const [name, now, before] of cases) for (const o of opponents) for (const a of [0, 1, 2]) for (const m of moves) assert.equal(now(o, a, m), before(o, a, m), `${name}(${o}, ${a}, ${m})`);
};

test('the cast tests read the skill rows and answer exactly as the opponent-named tests they replaced', () => sweep(CASES));

test('the special cast tests name no opponent', () => {
  for (const file of ['special-timing.ts', 'charge-timing.ts', 'special-fx-quake.ts', 'special-fx-goblin.ts', 'special-fx-pitborn.ts'])
    assert.doesNotMatch(readFileSync(new URL(`../src/fight/${file}`, import.meta.url), 'utf8'), /(opponent|id) === '[a-z]+' && actor/, file);
});
