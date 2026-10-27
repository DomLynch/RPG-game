// SPECIAL 2 as a melee special (the specials PR, RV75; donor: Combat-sandbox 93f619b27): slot b holds an existing class skill and fights through ITS move-defs row (reach, windup, stagger, knockback, stamina, posture),
// on its own cooldown, never the flat special share. The six picks (Strategy 2026-10-17: lunge, ironrush, pommel, shove, cleave, stomp; hewer is the alternate) must really differ, and a fight with no skill2 is untouched.
import './lib/era-off.ts';   // RV78: the legacy suite runs on trunk's rules; sandbox-era.ts is the one switch (tests/lib/era-off.ts)
import test from 'node:test';
import assert from 'node:assert/strict';
import { legal, stepDuel, withSkill2, type CombatEvent, type Duel } from '../src/fight/duel.ts';
import { OPPONENTS, RULES, SKILL_MOVE, weaponOf, DEFAULT_WEAPON, type SkillId } from '../src/fight/moves.ts';
import { act, arena, idle } from './strategies.ts';

const PICKS = ['lunge', 'ironrush', 'pommel', 'shove', 'cleave', 'reaping', 'stomp'] as SkillId[];
const fight = (skill?: SkillId): Duel => { let d = arena(OPPONENTS.veteran); d.fighters[0].skillCooldown = 0; d.fighters[1].skillCooldown = 0; return skill ? withSkill2(d, 0, skill) : d; };
const run = (d: Duel, ticks: number) => { const ev: CombatEvent[] = []; for (let t = 0; t < ticks; t++) { d = stepDuel(d, [t === 0 ? act('skill2') : idle(), idle()]); ev.push(...d.events); } return { d, ev }; };

test('slot b is inert with no skill2, and legal for each pick once it is set', () => {
  assert.equal(legal(fight().fighters[0], 'skill2'), false, 'no skill2 and no spell2: the press is inert');
  for (const p of PICKS) assert.equal(legal(fight(p).fighters[0], 'skill2'), true, `${p} is pressable`);
});

test('the press starts the picked skill\'s OWN move, spends that move row\'s stamina and starts only slot b\'s cooldown', () => {
  for (const p of PICKS) {
    const start = fight(p), move = SKILL_MOVE[p]!, row = weaponOf(DEFAULT_WEAPON).moves[move];
    const { ev, d } = run(start, 2);
    const started = ev.find((e) => e.type === 'AttackStarted' && e.actor === 0);
    assert.equal((started as { move?: string } | undefined)?.move, move, `${p} fights through ${move}`);
    assert.equal(d.fighters[0].skillCooldown2, RULES.skillCooldown - 1, `${p}: slot b's own cooldown runs (one tick on)`);
    assert.equal(d.fighters[0].skillCooldown, 0, `${p}: slot a's cooldown is untouched`);
    assert.ok(start.fighters[0].stamina - d.fighters[0].stamina >= row.stamina - 1, `${p}: the move row's stamina is spent (${row.stamina})`);
    assert.equal(legal(d.fighters[0], 'skill2'), false, `${p}: refused while it cools`);
  }
});

test('the six picks differ: each lands a different blow (move, windup, damage, posture, stagger) through its move row', () => {
  const seen = new Map<string, string>();
  for (const p of PICKS) {
    const { ev, d } = run(fight(p), 160);
    const hit = ev.find((e) => e.type === 'Hit' && e.actor === 0) as { damage?: number; stagger?: number; posture?: number; move?: string } | undefined;
    const sig = JSON.stringify([SKILL_MOVE[p], weaponOf(DEFAULT_WEAPON).moves[SKILL_MOVE[p]!].windup, Math.round((hit?.damage ?? 0) * 100), d.fighters[1].posture, d.fighters[1].health]);
    for (const [other, s] of seen) assert.notEqual(s, sig, `${p} and ${other} play identically: ${sig}`);
    seen.set(p, sig);
  }
  assert.equal(seen.size, PICKS.length);   // RV80: seven picks (Whirlwind joined)
});

test('a fight with no skill2 is byte for byte what it was: the field is absent, not undefined-valued', () => {
  const a = run(fight(), 120).d, b = run(fight(), 120).d;
  assert.deepEqual(a, b); assert.ok(!('skill2' in a.fighters[0]), 'nothing was added to a one-slot fighter');
});
