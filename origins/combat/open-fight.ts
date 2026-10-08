// Zone 1 on the Pit's own duel (Dom, 2026-10-08: copy the Pit): ONE engaged creature fights the player through the verbatim copies duel-open.ts (stepDuel) and ai-open.ts (decide, profileAt), not through
// zone1.ts's own rows. This file is the adapter and nothing else: it builds the two Pit fighters from the world's Fighters, maps the live Input to a Pit Intent, steps the copied duel at its fixed 60 Hz,
// and writes the result back into the world's Fighters and Events. Everything the world layer owns (aggro, chase to the engage ring, leash, give-up, heal-home, the page-driven hero position) stays in zone1.ts.
// Every place this file departs from the Pit is marked `// open-world:`.
import { OPPONENTS, RULES, opponentAt, profileAt, type AiProfile } from '../../src/moves.ts';
import { initialAi, decide, type AiState } from './ai-open.ts';
import { createFighter, opponentFighter, stepDuel, timing, idleIntent, type CombatEvent, type Duel, type Fighter as PitFighter, type Intent, type Side } from './duel-open.ts';
import type { Event, Fighter, Input, Phase } from './zone1.ts';

export type Stream = { duel: Duel; ai: AiState; profile: AiProfile };
// open-world: the open world has no guard-side thumb: a held guard covers the blow from the front (RULES.directionalGuard off), the Pit's other rules stand.
const OPEN_RULES = { ...RULES, directionalGuard: false } as unknown as typeof RULES;
const TICK = 1 / 60;
const seedOf = (id: string): number => { let h = 731; for (const c of id) h = (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0; return h; };

/** The two Pit fighters for a player and one creature, from the world's Fighters (hero first, as in the Pit). A creature's body and brain are the Pit's own level rows (moves.ts opponentAt / profileAt). */
export function openStream(hero: Fighter, cr: Fighter): Stream {
  const o = OPPONENTS[cr.kind as keyof typeof OPPONENTS], body = (f: Fighter) => ({ x: f.x, z: f.z, heading: f.facing, distance: 0 });
  const h = createFighter(body(hero), 'ready', 'longsword'), c = opponentFighter(opponentAt(o, cr.level), body(cr), 'ready');
  return { duel: { tick: 0, fighters: [h, c], finish: null, events: [] }, ai: initialAi(seedOf(cr.id)), profile: profileAt(o, cr.level) };
}

const phaseOf = (f: PitFighter): { phase: Phase; t: number } => {
  if (f.phase === 'attack' && f.move) { const tm = timing(f); return f.age < tm.windup ? { phase: 'windup', t: f.age * TICK } : f.age < tm.windup + tm.active ? { phase: 'active', t: (f.age - tm.windup) * TICK } : { phase: 'recover', t: (f.age - tm.windup - tm.active) * TICK }; }
  const phase: Phase = f.phase === 'hurt' ? 'stagger' : f.phase === 'dead' ? 'dead' : f.phase === 'guard' ? 'guard' : f.phase === 'roll' || f.phase === 'backstep' ? 'roll' : 'ready';
  return { phase, t: f.age * TICK };
};

function eventsOf(list: readonly CombatEvent[], ids: readonly [string, string], after: Duel, hero: Fighter): Event[] {
  const out: Event[] = [], id = (s: Side) => ids[s], tell = (s: Side) => Math.round(timing(after.fighters[s]).windup * TICK * 1000);
  const scaled = (e: CombatEvent) => Math.round((e.damage ?? 0) * (e.actor === 0 ? hero.attack : 1) * (e.target === 0 ? hero.res : 1));   // open-world: gear (Attack out, RES in) scales the number the Pit reports
  for (const e of list) {
    if (e.type === 'AttackStarted' && e.move) out.push({ type: 'Telegraph', id: id(e.actor), move: e.move, ms: tell(e.actor) });
    else if (e.type === 'SpecialStarted') out.push({ type: 'Telegraph', id: id(e.actor), move: e.name ?? 'special', ms: Math.round(RULES.special.windup * TICK * 1000) });
    else if (e.type === 'AttackActive' && e.move) out.push({ type: 'Swing', id: id(e.actor), move: e.move });
    else if ((e.type === 'Hit' || e.type === 'GuardBroken' || e.type === 'SpecialLanded') && e.target !== undefined) {
      out.push({ type: 'Hit', attacker: id(e.actor), victim: id(e.target), damage: scaled(e), move: e.move ?? e.name ?? 'special' });
      if (e.type === 'GuardBroken') out.push({ type: 'Staggered', id: id(e.target), ms: Math.round(RULES.posture.stun * TICK * 1000), cause: 'guardBreak' });
    } else if (e.type === 'Blocked' && e.target !== undefined) out.push({ type: 'Blocked', attacker: id(e.target), victim: id(e.actor), perfect: !!e.perfect, damage: scaled(e) });
    else if (e.type === 'Parried' && e.target !== undefined) out.push({ type: 'Parried', attacker: id(e.target), victim: id(e.actor) });   // the Pit's own Staggered for the parried attacker follows in the same list
    else if (e.type === 'Dodged' && e.target !== undefined) out.push({ type: 'Dodged', attacker: id(e.target), victim: id(e.actor) });
    else if (e.type === 'PostureBroken' && e.target !== undefined) out.push({ type: 'Staggered', id: id(e.target), ms: Math.round((e.ticks ?? RULES.posture.stun) * TICK * 1000), cause: 'posture' });
    else if (e.type === 'Staggered') out.push({ type: 'Staggered', id: id(e.actor), ms: Math.round((e.ticks ?? 0) * TICK * 1000), cause: 'hit' });
    else if (e.type === 'Killed' && e.target !== undefined) out.push({ type: 'Died', id: id(e.target), by: id(e.actor) });
  }
  return out;
}

/** Live Input to a Pit Intent. The hero's walk is the page's (the world gives his position each step); the Input here is the press: a cut, a roll, a held guard, a special. */
function intentOf(input: Input, guarding: boolean): Intent {
  const base = idleIntent();
  const action = input.special ? 'skill' : input.roll ? 'dodge' : input.attack === 'heavy' ? 'heavy' : input.attack === 'kick' ? 'kick' : input.attack === 'light' ? 'light' : input.guard && !guarding ? 'parry' : null;   // open-world: a guard pressed fresh is the Pit's parry tap, held it is the standing guard
  const move = input.roll ? { x: input.roll.x, z: input.roll.z, yaw: 0, run: false } : { x: input.x, z: input.z, yaw: 0, run: !!input.run };
  return { ...base, move, action, guard: !!input.guard, lock: true };   // open-world: hero lock-on is the Pit's (he turns toward the foe while ready and in a windup)
}

/** One engaged step: `ticks` Pit ticks (60 Hz) of hero vs creature. Writes the result into `hero` and `cr` (the caller's copies) and returns the events. */
export function stepStream(s: Stream, hero: Fighter, cr: Fighter, input: Input, dt: number): { stream: Stream; events: Event[] } {
  let duel = s.duel, ai = s.ai, guarding = hero.phase === 'guard';
  const out: Event[] = [], ticks = Math.max(1, Math.round(dt / TICK));
  for (let k = 0; k < ticks; k++) {
    const [ph, pc] = duel.fighters;
    // open-world: the hero's place, facing, stance and effective health come from the world each tick (the page walks him; gear scales damage by scaling the pool: Attack divides the creature's, RES the hero's).
    const h: PitFighter = { ...ph, body: { ...ph.body, x: hero.x, z: hero.z, heading: ph.phase === 'roll' ? ph.body.heading : hero.facing }, health: hero.health / hero.res, maxHealth: hero.maxHealth / hero.res, stamina: hero.stamina, posture: hero.posture, ...(hero.stance ? { stance: hero.stance } : {}) };
    if (hero.special && h.specialShare === undefined) { h.specialShare = hero.level >= RULES.special.bossFrom ? RULES.special.bossDamage : RULES.special.damage; h.specialName = hero.special; h.skillCooldown = Math.round(hero.specialIn / TICK); }
    const c: PitFighter = { ...pc, health: cr.health / hero.attack, maxHealth: cr.maxHealth / hero.attack, ...(cr.stance ? { stance: cr.stance } : {}) };
    const before: Duel = { ...duel, fighters: [h, c] };
    const brain = decide(before, 1, ai, s.profile); ai = brain.ai;
    const press: Input = k === 0 ? input : { x: input.x, z: input.z, run: input.run, guard: input.guard };   // open-world: a press (cut, roll, special) is one tick; the rest of a frame's ticks hold only the walk and the guard
    const intent = intentOf(press, guarding); guarding = !!input.guard;
    const next = stepDuel(before, [intent, brain.intent], OPEN_RULES);
    out.push(...eventsOf(next.events, [hero.id, cr.id], next, hero));
    duel = { ...next, events: [] };
  }
  const [ph, pc] = duel.fighters;
  const write = (f: Fighter, p: PitFighter, mul: number): void => {
    const { phase, t } = phaseOf(p);
    f.x = p.body.x; f.z = p.body.z; f.facing = p.body.heading; f.health = p.health * mul; f.stamina = p.stamina; f.posture = p.posture; f.exhausted = p.exhausted; f.phase = phase; f.t = t;
  };
  write(hero, ph, hero.res); write(cr, pc, hero.attack);
  if (ph.skillCooldown !== undefined && hero.special) hero.specialIn = ph.skillCooldown * TICK;
  return { stream: { duel, ai, profile: s.profile }, events: out };
}
