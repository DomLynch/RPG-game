// The hero's day-one skill, Pommel Strike (Dom, 2026-09-25: "Hero starts with Pommel Strike; one skill slot; a take swaps it").
// The move's numbers live in one MoveDef (moves.ts skill_pommel) and its name in one SKILLS entry (loot.ts); these tests pin both,
// the stagger that is the point of it, the day-one default and the one-slot swap, and the fairness caps against every opponent.
import test from 'node:test';
import assert from 'node:assert/strict';
import { aim, createFighter, idleIntent, initialDuel, legal, opponentFighter, stepDuel, type CombatEvent, type Duel, type Intent } from '../src/duel.ts';
import { MOVES, OPPONENTS, PLAYER_WEAPONS, RULES, SKILL_MOVE, WEAPONS, type Opponent } from '../src/moves.ts';
import { DAY_ONE_SKILL, SKILLS, cleanLoot, emptyLoot, equippedSkill, mergeLoot, skillOf } from '../src/loot.ts';
import { loadProfile } from '../src/profile.ts';
import { absorbCloud, type CloudProfile } from '../src/cloud-profile.ts';
import { battery, gap, idle, act, ready, W, P } from './strategies.ts';

const M = MOVES.skill_pommel;
// The striker (side 0, pommel equipped) and `foe` (side 1) a metre apart, facing each other, both ready: inside the 1.3 m cone.
function exchange(foe: Opponent | null = null): Duel {
  const d = initialDuel(OPPONENTS.veteran, 'longsword', 'pommel');
  const f = foe ? opponentFighter(foe, { ...d.fighters[1].body }) : createFighter({ ...d.fighters[1].body }, 'ready');
  const p = d.fighters[0];
  p.phase = 'ready';
  p.body = { ...p.body, x: 0, z: -.5 }; f.body = { ...f.body, x: 0, z: .5 };
  p.body.heading = aim(p.body, f.body); f.body.heading = aim(f.body, p.body);
  d.fighters[1] = f;
  return d;
}
function run(d: Duel, ticks: number, script: (tick: number, d: Duel) => [Intent, Intent]) {
  const events: CombatEvent[] = [];
  for (let k = 0; k < ticks; k++) { d = stepDuel(d, script(d.tick + 1, d)); events.push(...d.events); }
  return { duel: d, events };
}
const strike = (tick: number): Intent => ({ ...idleIntent(), action: tick === 1 ? 'skill' : null });
const CONTACT = 1 + M.windup;   // pressed on tick 1 (age 0), contact when age reaches the windup

test('skill_pommel: one shared MoveDef on every weapon; the stagger length is named in it', () => {
  assert.deepEqual({ windup: M.windup, active: M.active, recovery: M.recovery, damage: M.damage, stamina: M.stamina, stagger: M.stagger, knockback: M.knockback, reach: M.reach, parryable: M.parryable, breaksGuard: M.breaksGuard, path: M.path },
    { windup: 18, active: 4, recovery: 18, damage: 20, stamina: 40, stagger: 50, knockback: 0, reach: 1.3, parryable: true, breaksGuard: false, path: null });
  assert.equal(SKILL_MOVE.pommel, 'skill_pommel');
  assert.ok(M.damage >= MOVES.heavy_overhead.damage, 'heavy-class damage');
  assert.ok(M.reach < MOVES.thrust.reach, 'arm\'s length: shorter than a thrust');
  assert.equal(M.stamina, MOVES.skill_witchfire.stamina, 'the Witch-fire\'s stamina');
  for (const o of Object.values(OPPONENTS)) assert.ok(M.damage > o.poise, `${o.id}: poise ${o.poise} does not shrug it`);
  for (const w of Object.values(WEAPONS)) assert.equal(w.moves.skill_pommel, M, `${w.id}: the shared entry`);
});

test('skill_pommel: a clean hit lands 20, spends 40 stamina and the cooldown, and staggers the foe for 50 ticks', () => {
  const { duel, events } = run(exchange(), CONTACT, t => [strike(t), idleIntent()]);
  assert.deepEqual(events.filter(e => e.type === 'AttackStarted' && e.actor === 0).map(e => [e.tick, e.move]), [[1, 'skill_pommel']]);
  const hit = events.find(e => e.type === 'Hit');
  assert.ok(hit, 'the pommel landed');
  assert.equal(hit.tick, CONTACT); assert.equal(hit.move, 'skill_pommel'); assert.equal(hit.damage, 20);
  assert.ok(events.some(e => e.type === 'Staggered' && e.actor === 1 && e.ticks === 50), 'the foe is staggered for the MoveDef\'s 50');
  assert.equal(duel.fighters[1].phase, 'hurt'); assert.equal(duel.fighters[1].stun, 50);
  assert.equal(duel.fighters[1].health, RULES.health - 20);
  assert.equal(duel.fighters[0].skillCooldown, RULES.skillCooldown - (CONTACT - 1));
  assert.ok(duel.fighters[0].stamina <= 100 - 40 + CONTACT, 'spent 40 at commitment (regeneration since is at most a tick each)');
});

test('skill_pommel: every opponent is staggered by a clean hit, and a follow-up light lands before he recovers', () => {
  for (const foe of Object.values(OPPONENTS)) {
    const { events } = run(exchange(foe), CONTACT, t => [strike(t), idleIntent()]);
    const hit = events.find(e => e.type === 'Hit' && e.actor === 0 && e.move === 'skill_pommel');
    assert.ok(hit, `${foe.id}: the pommel landed`);
    assert.ok(events.some(e => e.type === 'Staggered' && e.actor === 1 && e.ticks === M.stagger), `${foe.id}: staggered for ${M.stagger}`);
  }
  // The window, measured once on the plain man: the light's contact comes inside the stagger.
  let struckAt = 0;
  const { events } = run(exchange(), CONTACT + M.stagger, (t, d) => {
    if (!struckAt && d.events.some(e => e.type === 'Hit' && e.move === 'skill_pommel')) struckAt = d.tick;
    return [struckAt && ready(d) ? act('light') : strike(t), idleIntent()];
  });
  const follow = events.find(e => e.type === 'Hit' && e.actor === 0 && (e.move === 'light_right' || e.move === 'light_left'));
  assert.ok(follow, 'the follow-up light landed');
  assert.ok(follow.tick < CONTACT + M.stagger, `the light landed at ${follow.tick}, inside the stagger that ends at ${CONTACT + M.stagger}`);
});

test('skill_pommel: a block or a parry leaves the foe unstaggered; the parry staggers the striker', () => {
  const guard = (): Intent => ({ ...idleIntent(), guard: true, guardDirection: 'thrust' });
  const blocked = run(exchange(), CONTACT, t => [strike(t), guard()]);
  assert.ok(blocked.events.some(e => e.type === 'Blocked' && e.move === 'skill_pommel'), 'blocked');
  assert.ok(!blocked.events.some(e => e.type === 'Staggered' && e.actor === 1), 'no stagger through a block');
  assert.notEqual(blocked.duel.fighters[1].phase, 'hurt');
  const press = CONTACT - 5;
  const parry = (t: number): Intent => ({ ...idleIntent(), guard: t >= press, guardDirection: 'thrust', action: t === press ? 'parry' : null });
  const parried = run(exchange(), CONTACT, t => [strike(t), parry(t)]);
  assert.ok(parried.events.some(e => e.type === 'Parried' && e.move === 'skill_pommel'), 'parried');
  assert.ok(!parried.events.some(e => e.type === 'Staggered' && e.actor === 1), 'the parrier is not staggered');
  assert.equal(parried.duel.fighters[0].phase, 'hurt'); assert.equal(parried.duel.fighters[0].stun, RULES.parryStun);
});

test('skill_pommel: refused for the 900-tick cooldown and under 40 stamina', () => {
  const { duel } = run(exchange(), 2, t => [strike(t), idleIntent()]);
  const cooled = { ...duel.fighters[0], phase: 'ready' as const, move: null, stamina: 100 };
  assert.equal(legal(cooled, 'skill'), false, 'cooling');
  assert.equal(legal({ ...cooled, skillCooldown: 0 }, 'skill'), true);
  assert.equal(legal({ ...cooled, skillCooldown: 0, stamina: 39 }, 'skill'), false);
});

test('day one: a guest, a signed-in profile and an empty loot all fight with Pommel Strike; it is the hero\'s own, never offered', () => {
  assert.equal(DAY_ONE_SKILL, 'pommel');
  assert.equal(SKILLS.pommel.name, 'Pommel Strike'); assert.equal(SKILLS.pommel.opponent, null);
  for (const o of Object.values(OPPONENTS)) assert.notEqual(skillOf(o.id), 'pommel', `${o.id} does not offer it`);
  const m = new Map<string, string>(), storage = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } };
  const guest = loadProfile(storage, () => 'device-new').profile;
  assert.equal(equippedSkill(guest.loot), 'pommel', 'a fresh guest');
  assert.equal(equippedSkill(emptyLoot()), 'pommel', 'a loot with pieces but no move');
  const cloud: CloudProfile = { display_name: 'Aldren', encounter: null, revision: 1, victory_marks: 3, loot: { owned: [], equipped: {} } };
  assert.equal(equippedSkill(absorbCloud(guest, cloud).loot), 'pommel', 'a signed-in account with no move stored');
});

test('one slot: a Witch-fire take replaces the Pommel Strike rather than adding a second, and survives the cloud', () => {
  const taken = { ...emptyLoot(), skill: 'witchfire' as const };
  assert.equal(equippedSkill(taken), 'witchfire');
  assert.equal(equippedSkill(cleanLoot(taken)), 'witchfire');
  assert.equal(equippedSkill(mergeLoot(undefined, taken)), 'witchfire');
  assert.equal(initialDuel(OPPONENTS.veteran, 'longsword', equippedSkill(taken)).fighters[0].skill, 'witchfire', 'the fighter carries one move: the taken one');
  assert.equal(initialDuel(OPPONENTS.veteran, 'longsword', equippedSkill(undefined)).fighters[0].skill, 'pommel');
});

// Fairness (the caps of scripts/player-weapon-battery.mjs): the Pommel Strike equipped, against all 14 opponents, with every weapon a player
// can carry at normal (the pommel is on every weapon, so the battery covers what ships) and the longsword, Dom's pick, at hard too.
// Two scripted uses a thumb could run: strike whenever it is ready and in reach, and the combo it exists for (strike, then a light into the stagger).
const POMMEL: Record<string, (d: Duel) => Intent> = {
  'pommel on cooldown': d => (ready(d) && gap(d) <= M.reach && legal(P(d), 'skill') ? act('skill') : idle()),
  'pommel then light': d => (ready(d) && W(d).phase === 'hurt' && gap(d) <= 1.7 ? act('light') : ready(d) && gap(d) <= M.reach && legal(P(d), 'skill') ? act('skill') : ready(d) && gap(d) <= 1.7 ? act('light') : idle()),
};
test('skill_pommel: fairness battery against every opponent, every player weapon at normal and the longsword at hard, stays within the caps [slow]', () => {
  const CAP = { normal: .5, hard: .35 } as const, seeds = 24, over: string[] = [];
  const runs = [...PLAYER_WEAPONS.map(w => [w, 'normal'] as const), ['longsword', 'hard'] as const];
  for (const [weapon, level] of runs) for (const o of Object.values(OPPONENTS)) {
    const rows = battery(level, seeds, 7200, o, POMMEL, weapon, 'pommel');
    for (const [name, r] of Object.entries(rows)) {
      console.log(`# ${weapon.padEnd(10)} ${o.id.padEnd(12)} ${level.padEnd(6)} ${name.padEnd(18)} ${r.wins}W/${r.losses}L/${r.stalls}S u${r.untouched}`);
      if (r.wins / seeds > CAP[level]) over.push(`${weapon} ${o.id} ${level} ${name} ${r.wins}/${seeds}`);
    }
  }
  assert.deepEqual(over, [], 'no pommel row over its cap');
});
