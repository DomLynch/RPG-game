// Strategy battery: simple, repeatable human strategies against the warden. AI-vs-AI cannot find these; a human finds them in ten minutes.
// Gate: no scripted strategy wins more than half its fights at normal or more than a third at hard, and none goes untouched.
import test from 'node:test';
import assert from 'node:assert/strict';
import { OPPONENTS, type Opponent } from '../src/moves.ts';
import { battery } from './strategies.ts';
// The Veteran as shipped (the trident since slice V) and the same man with the longsword: the sword warden is the AI every other opponent starts from, so it stays gated.
const WARDENS: [string, Opponent][] = [[`${OPPONENTS.veteran.id} (${OPPONENTS.veteran.weapon})`, OPPONENTS.veteran], ...(OPPONENTS.veteran.weapon === 'longsword' ? [] : [['veteran (longsword)', { ...OPPONENTS.veteran, weapon: 'longsword' as const }] as [string, Opponent]])];
for (const [who, opponent] of WARDENS) test(`no simple strategy dominates the ${who} warden: wins ≤ 50 % at normal, ≤ 35 % at hard, and every strategy gets hit [slow]`, () => {
  for (const [level, cap] of [['normal', .5], ['hard', .35]] as const) {
    const rows = battery(level, 24, 7200, opponent);
    const table = Object.entries(rows).map(([n, r]) => `${n}: ${r.wins}W ${r.losses}L ${r.stalls}S untouched ${r.untouched} taken ${r.taken} landed ${r.landed}`).join('\n  ');
    for (const [name, r] of Object.entries(rows)) {
      // The perfect-information parry is mastery, not an exploit: it may win, but the warden's baits, feints and kicks must still land on it.
      if (name !== 'perfect parry') assert.ok(r.wins / 24 <= cap, `${level} · ${name} wins ${r.wins}/24 (cap ${cap * 100} %)\n  ${table}`);
      // The perfect-information script parries everything parryable and rolls every kick on its first ready tick (no thumb does): the warden must still land on it in
      // two thirds of the fights. (Cap 6 → 8 with the slice-P regen — 40/s means the script always has the 30 stamina to roll; the old number leaned on its starvation.)
      assert.ok(r.untouched <= (name === 'perfect parry' ? 8 : 2), `${level} · ${name} untouched in ${r.untouched}/24 fights\n  ${table}`);
    }
    console.log(`battery ${who} ${level}\n  ${table}`);
  }
});
