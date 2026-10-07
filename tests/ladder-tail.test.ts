// The tail past hard: Origin II–V, levels 47–50 (Dom via Strategy 2026-10-05; Lead GO, option B, 2026-10-06). Levels 1–46 are the old ladder BYTE FOR BYTE
// (the hard anchor stays at 46); each level past it blends a quarter further toward moves.ts tailApex — skill knobs only, capped. The fairness of every
// rung up there is judged against the hard caps (no strategy over a third of its fights, none untouched), like the 46 beneath it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { LADDER } from '../src/ladder.ts';
import { LEVELS, LEVEL_ANCHORS, OPPONENTS, opponentAt, profileAt, type AiProfile } from '../src/moves.ts';
import { battery } from './strategies.ts';
import { setStab } from '../src/stab-rule.ts';

const ladder = LADDER.map(o => OPPONENTS[o.id]);
const IDENTITY: (keyof AiProfile)[] = ['pressure', 'feint', 'guard', 'disengage', 'circle', 'step', 'interrupt', 'kick', 'dash', 'discipline', 'aggression', 'dodge', 'stab', 'anticipate', 'tellReaction', 'regen', 'braceHeavy'];

// Levels 1–46 of every rung (profile and body) hashed on trunk 4e88c8d7, before the tail existed: the 50-level ladder must not move one of them.
// Re-pinned 2026-10-07 (RV29, deliberately): the Nightborn's normal row moved (lapse .3 -> .25, aggression .55 -> .52: moves.ts), the one profile change in the batch; everything else on L1-46 is as before.
const OLD_LADDER_DIGEST = '98fa460c72224d2c4f99ef84c338fdfa89cea02b6daf873595926fb57b203874';   // RV31 (2026-10-07): re-pinned deliberately — spamRun / spamBoth join the five gated opponents' rows at every level (REACH[31]); before: RV30 (2026-10-07): re-pinned deliberately — the Shieldmaiden, Knight and Plague Doctor own profile rows change levels 1–46 of those three (REACH[30]); was e8df9077014d74c09d55a6146571ecb26f7abdc80713b4db9a7682290c833359, before that 371e6568d247540f27e9def244401f2e724e0e60f0db711892ae0d1f76cd11ca
test('levels 1–46 are byte for byte what they were before the tail (every rung, profile and body)', () => {
  const h = createHash('sha256');
  for (const o of ladder) for (let l = 1; l <= 46; l++) h.update(`${o.id}:${l}:`).update(JSON.stringify(profileAt(o, l))).update(JSON.stringify(opponentAt(o, l)));
  assert.equal(h.digest('hex'), OLD_LADDER_DIGEST);
  assert.equal(LEVELS, 50); assert.equal(LEVEL_ANCHORS.hard, 46, 'the hard anchor stays at 46');
});

test('past hard: skill knobs only, a few steps, capped; identity knobs stay hard\'s; every knob moves one way from L46 to L50', () => {
  for (const o of ladder) {
    const hard = o.profiles.hard;
    let prev: AiProfile = hard;
    for (let l = 47; l <= LEVELS; l++) {
      const p = profileAt(o, l);
      assert.equal(p.softNotice, 1, `${o.id} ${l}: late notice like the levels between the rungs`);
      for (const key of IDENTITY) assert.equal(p[key], hard[key], `${o.id} ${l} ${key} is identity: held at hard's`);
      assert.ok(p.reaction <= prev.reaction && p.lapse <= prev.lapse + 1e-9 && p.accuracy >= prev.accuracy - 1e-9 && (p.parry ?? 0) >= (prev.parry ?? 0) - 1e-9 && (p.read ?? 1) >= (prev.read ?? 1) - 1e-9, `${o.id} ${l}: never easier than the level below`);
      assert.ok(p.reaction >= Math.min(5, hard.reaction) && p.accuracy <= Math.max(.98, hard.accuracy) && p.parry <= Math.max(.9, hard.parry) && p.lapse >= Math.min(hard.lapse, .02), `${o.id} ${l}: inside the caps`);
      assert.equal(p.parry === 0, hard.parry === 0, `${o.id} ${l}: the Goblin still never parries`);
      assert.ok(Number.isInteger(p.reaction), `${o.id} ${l}: whole ticks`);
      prev = p;
    }
    assert.ok(profileAt(o, 50).reaction <= hard.reaction && profileAt(o, 50).lapse <= hard.lapse, `${o.id}: L50 is at least as hard as L46`);
  }
});

// Fairness at the top (Lead's gate: every rung inside the caps or it falls back to flat hard): no scripted strategy wins more than a third of its fights
// at L47–50, none goes untouched more than the table allows. The same rows as scripts/player-weapon-battery.mjs, on the longsword, 24 seeds.
test('every rung at levels 47 and 50 stays inside the hard fairness caps [slow]', () => {
  setStab(true);   // the shipped Goblin has the stab (stab-rule.ts is an era flag, off in a headless run)
  const UNTOUCHED: Record<string, number> = { default: 2, 'perfect parry': 8 };
  const over: string[] = [];
  for (const o of ladder) for (const level of [47, 50]) {
    const rows = battery(level, 24, 7200, o, undefined, 'longsword');
    for (const [name, r] of Object.entries(rows)) {
      if (name !== 'perfect parry' && r.wins > 8) over.push(`${o.id} L${level} ${name} wins ${r.wins}/24`);
      if (r.untouched > (UNTOUCHED[name] ?? UNTOUCHED.default!)) over.push(`${o.id} L${level} ${name} untouched ${r.untouched}/24`);
    }
  }
  assert.deepEqual(over, []);
});
