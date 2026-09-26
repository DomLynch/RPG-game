// SCOPE 8: the nine opponents' moves (moves.ts `skill_lunge` … `skill_hewer`; Combat's rows, Strategy's ruling 2026-09-26). The caps
// Strategy accepted are pinned here mechanically, so a mistyped row fails CI rather than slipping past a win-share battery:
//   timing  — windup/active/recovery copy an existing row unchanged (the light, the chained light, the heavy, the thrust or the kick);
//   damage  — ≥ 18: at least the heavy's, and over every opponent's poise so a hero's take staggers them all;
//   stun    — the worst stun a clean hit can deal (counter × rear) is short of a guaranteed follow-up light (only the Pommel owns that);
//   block   — after a blocked contact the caster stays exposed long enough for the hero's 16-tick thrust with ≥ 9 ticks to spare.
// The full fairness sweep is scripts/skill-battery.mjs --skill <id>; its output goes in the PR that changes a row.
import test from 'node:test';
import assert from 'node:assert/strict';
import { aim, createFighter, idleIntent, initialDuel, mirror, stepDuel, type CombatEvent, type Duel, type Intent } from '../src/duel.ts';
import { MOVES, OPPONENTS, RULES, SKILL_MOVE, WEAPONS, type MoveId, type SkillId, type Timing } from '../src/moves.ts';
import { SKILLS, skillOf } from '../src/loot.ts';
import type { OpponentId } from '../src/roster.ts';

const NINE: Record<Exclude<SkillId, 'witchfire' | 'pommel'>, OpponentId> = {
  lunge: 'nightborn', reaping: 'executioner', shove: 'veteran', jab: 'goblin', cleave: 'pitborn', stomp: 'dwarf', miasma: 'plaguedoctor', ironrush: 'knight', hewer: 'shieldmaiden',
};
const ids = Object.keys(NINE) as (keyof typeof NINE)[];
const light = MOVES.light_right;
const TIMINGS: Record<string, Timing> = {
  light, 'chained light': light.chained!, heavy: MOVES.heavy_overhead, thrust: MOVES.thrust, kick: MOVES.kick,
};
const same = (a: Timing, b: Timing) => a.windup === b.windup && a.active === b.active && a.recovery === b.recovery;
const tail = (t: Timing) => t.active - 1 + t.recovery;   // ticks the caster stays committed after the first contact tick
const HERO_FASTEST = MOVES.thrust.windup;

const PULLED = new Set<string>([]);   // a skill over the battery's bar after its knob round: unoffered (loot.ts opponent null), row and code kept. Empty since RV15 (Strategy 2026-09-26): Lunge and Iron Rush at reach 1.6 / stepIn 0, Jab re-offered as is

test('SCOPE 8: the nine skills are the fixed SkillIds, each firing skill_<id>, each offered by its own opponent unless pulled', () => {
  assert.deepEqual(Object.keys(SKILL_MOVE).sort(), ['pommel', 'witchfire', ...ids].sort());
  for (const id of ids) {
    assert.equal(SKILL_MOVE[id], `skill_${id}`);
    assert.equal(MOVES[SKILL_MOVE[id]].id, `skill_${id}`);
    if (PULLED.has(id)) { assert.equal(SKILLS[id].opponent, null, `${id} is pulled`); assert.equal(skillOf(NINE[id]), null, `${NINE[id]}'s kill offers nothing`); continue; }
    assert.equal(SKILLS[id].opponent, NINE[id]);
    assert.equal(skillOf(NINE[id]), id, `${NINE[id]}'s kill offers ${id}`);
  }
});

test('SCOPE 8: every skill copies an existing timing row and holds the damage, stun and block caps', () => {
  for (const id of ids) {
    const m = MOVES[SKILL_MOVE[id]];
    assert.ok(Object.values(TIMINGS).some(t => same(m, t)), `${id}: ${m.windup}/${m.active}/${m.recovery} copies none of ${Object.keys(TIMINGS).join(', ')}`);
    assert.ok(m.damage >= MOVES.heavy_overhead.damage, `${id}: damage ${m.damage} under the heavy's ${MOVES.heavy_overhead.damage}`);
    for (const o of Object.values(OPPONENTS)) assert.ok(m.damage > o.poise, `${id}: ${o.id}'s poise ${o.poise} shrugs it`);
    const worst = Math.round(m.stagger * RULES.counter.stagger * RULES.rear.stagger);
    assert.ok(worst <= tail(m) + light.windup, `${id}: worst stun ${worst} buys a follow-up light (line ${tail(m) + light.windup})`);
    assert.ok(tail(m) - HERO_FASTEST >= 9, `${id}: only ${tail(m) - HERO_FASTEST} ticks to punish on a block`);
    assert.equal(m.path, null, `${id}: a cone, as the Pommel`);
    assert.equal(m.parryable, true, `${id}: parryable`);
    assert.equal(m.breaksGuard, false, `${id}: blockable (SCOPE 8)`);
    assert.equal(m.feintUntil, 0); assert.equal(m.chamber, null); assert.equal(m.charges, false);
  }
  // The four flags Strategy ruled.
  assert.equal(MOVES.skill_cleave.staminaDamage, RULES.breakCost, 'Cleave: a block costs the break price');
  assert.ok(same(MOVES.skill_jab, light.chained!), 'Jab: the chained light');
  assert.deepEqual([MOVES.skill_ironrush.poise, MOVES.skill_ironrush.poiseFrom], [24, 8], 'Iron Rush: armoured from tick 8');
  assert.deepEqual([MOVES.skill_miasma.active, MOVES.skill_miasma.staminaDamage], [MOVES.heavy_overhead.active, 50], 'Miasma: the heavy\'s window, 50 drain');
});

test('SCOPE 8: every weapon carries the one shared row of each skill', () => {
  for (const w of Object.values(WEAPONS)) for (const id of ids) assert.equal(w.moves[SKILL_MOVE[id]], MOVES[SKILL_MOVE[id]], `${w.id} ${id}`);
});

// The caster (side 0, the skill equipped) and a plain foe (side 1) a metre apart, facing, both ready: inside every skill's cone.
function exchange(skill: SkillId): Duel {
  const d = initialDuel(OPPONENTS.veteran, 'longsword', skill);
  const f = createFighter({ ...d.fighters[1].body }, 'ready'), p = d.fighters[0];
  p.phase = 'ready';
  p.body = { ...p.body, x: 0, z: -.5 }; f.body = { ...f.body, x: 0, z: .5 };
  p.body.heading = aim(p.body, f.body); f.body.heading = aim(f.body, p.body);
  d.fighters[1] = f;
  return d;
}
function run(d: Duel, ticks: number, foe: (t: number) => Intent = () => idleIntent()) {
  const events: CombatEvent[] = [];
  for (let k = 0; k < ticks; k++) { d = stepDuel(d, [{ ...idleIntent(), action: d.tick === 0 ? 'skill' : null }, foe(d.tick + 1)]); events.push(...d.events); }
  return { duel: d, events };
}
const through = (move: MoveId) => MOVES[move].windup + MOVES[move].active + 2;

test('SCOPE 8: each skill lands clean for its damage and spends the cooldown at commitment', () => {
  for (const id of ids) {
    const m = MOVES[SKILL_MOVE[id]], { duel, events } = run(exchange(id), through(m.id));
    const hit = events.find(e => e.type === 'Hit' && e.actor === 0);
    assert.ok(hit && hit.type === 'Hit', `${id}: no clean hit`);
    assert.equal(hit.move, m.id); assert.equal(hit.damage, m.damage, `${id}: damage`);
    assert.equal(duel.fighters[0].skillCooldown, RULES.skillCooldown - through(m.id) + 1, `${id}: cooldown spent at commitment`);
  }
});

test('SCOPE 8: blocked, a skill stops at its chip; the Hewer\'s all goes through, and the Cleave breaks a guard that cannot pay 60 at contact', () => {
  const guard = (id: SkillId) => (): Intent => ({ ...idleIntent(), guard: true, guardDirection: mirror(MOVES[SKILL_MOVE[id]].direction) });
  for (const id of ids) {
    const m = MOVES[SKILL_MOVE[id]], { events } = run(exchange(id), through(m.id), guard(id));
    const blocked = events.find(e => e.type === 'Blocked');
    assert.ok(blocked && blocked.type === 'Blocked', `${id}: not blocked`);
    assert.equal(blocked.damage ?? 0, Math.round(m.damage * m.chip), `${id}: chip`);
    assert.ok(!events.some(e => e.type === 'Staggered' && e.actor === 1), `${id}: no stagger through a block`);
  }
  assert.equal(Math.round(MOVES.skill_hewer.damage * MOVES.skill_hewer.chip), MOVES.skill_hewer.damage);
  // A guard regenerates while it waits (RULES.guardRegen), so start low enough to stay under 60 through the 33-tick wind-up to contact.
  const tired = exchange('cleave'); tired.fighters[1].stamina = RULES.breakCost / 2;
  const broken = run(tired, through('skill_cleave'), guard('cleave'));
  assert.ok(broken.events.some(e => e.type === 'GuardBroken' && e.move === 'skill_cleave'), 'Cleave: a guard under 60 breaks');
});
