// Origins: tag-team crowd fights (combat study §2, option 2A with the 2E roles and the 2F sweep push). Several enemies, ONE token: the
// enemy holding it fights you in the arena's own 1v1 duel; the rest circle at 4–6 m and wait their turn. Written from our spec only
// (docs/specs/origins/combat-study.md on expansion/combat-study), no donor code.
//
//   holder fights ──3 attack starts or 6 s, at a quiet moment, ≥ 120 ticks since the last pass──▶ backs off to the ring, next steps in
//   holder falls  ──45-tick breath──▶ next steps in            last enemy falls ──▶ won            player falls ──▶ lost
//
// The director never touches the simulation: it reads one Observation per tick (observe() builds it from the live Duel and its events)
// and says who holds the token. The page swaps the duel's side 1 (handOver) and carries the player's Fighter between duels (carryPlayer);
// stepDuel is pure, so no src/ file changes, no record version, no fingerprint move. Its only randomness is its own seeded LCG (the order
// and the ring's starting angles), a stream separate from every warden's AI seed. Waiting enemies are presentation: their ring places
// come from here, never from the sim. Every number is PROVISIONAL (spec: "until Combat measures it on the battery"); 60 Hz ticks.
import type { AiState } from '../../src/fight/index.ts';
import type { CombatEvent, Duel, Fighter, Phase } from '../../src/fight/index.ts';
import type { MoveId } from '../../src/fight/index.ts';

export const CROWD = {
  breath: 45,          // ticks after the holder falls before the next steps in ("so you can turn")
  starts: 3,           // the holder's attack starts before he hands over
  hold: 360,           // ticks (6 s) the holder may keep the token before he hands over
  minPassGap: 120,     // never more than one hand-over per this many ticks
  ring: { min: 4, max: 6 },   // metres from the player the waiting enemies circle at
  ringReturn: 0.02,    // metres per tick a pushed enemy drifts back to his role's circle
  maxEnemies: 8,       // a pack larger than this is refused (preview scale; one token, the rest presentation)
} as const;
// 2E: Skirmisher — the holder before him hands over sooner. Pack leader — while he lives the others hand over every 4 s.
export const SKIRMISHER_HANDOVER = { starts: 2, hold: 240 } as const;
export const LEADER_HOLD = 240;
// 2F: a player sweep that lands on the holder pushes every waiting enemy within `reach` metres OF THE HOLDER back to the outer ring and
// delays his next token by `delay` ticks. Which player moves count as a sweep: the horizontal cuts (no wide technique exists yet, §4).
export const SWEEP = { reach: 2.5, delay: 60 } as const;
export const SWEEP_MOVES: ReadonlySet<MoveId> = new Set<MoveId>(['light_left', 'light_right']);
// A quiet moment (2A): neither fighter in one of these phases, nor in a Special wind-up, and the player not inside his chain window.
export const BUSY_PHASES: ReadonlySet<Phase> = new Set<Phase>(['attack', 'hurt', 'roll']);

export type Role = 'duellist' | 'brute' | 'skirmisher' | 'leader';
// Where each role circles while waiting: radius (m) and angular pace (rad/tick). Skirmisher fast and closest, brute slower, leader back.
export const ROLE_RING: Readonly<Record<Role, { radius: number; pace: number }>> = {
  duellist: { radius: 5, pace: 0.006 },
  brute: { radius: 5.5, pace: 0.003 },
  skirmisher: { radius: CROWD.ring.min, pace: 0.012 },
  leader: { radius: CROWD.ring.max, pace: 0.002 },
};

export type Spot = { x: number; z: number };
export type Ring = { angle: number; radius: number; turn: 1 | -1; delay: number };   // angle from the player, sim convention (x = sin, z = cos)
export type CrowdEnemy = { id: string; role: Role; seed: number; alive: boolean; turns: number; ring: Ring };
export type CrowdState = {
  tick: number; rng: number;
  enemies: readonly CrowdEnemy[];
  queue: readonly number[];      // waiting, alive enemies in the order they step in (the holder is never in it)
  holder: number | null;         // index into enemies; null only during a breath or after the end
  heldAt: number; starts: number; lastPass: number;
  breath: number;                // ticks left before the next steps in (0 = none pending)
  duellistHad: boolean;          // a Duellist has held the token (the Brute waits for it)
  leaderFell: boolean;           // the pack leader was killed: the rest fight one each to the end
  outcome: 'won' | 'lost' | null;
};
export type Observation = {
  holderStarted: boolean;        // the holder began an attack this tick (AttackStarted, actor 1)
  quiet: boolean;
  holderDown: boolean; playerDown: boolean;
  sweep: boolean;                // a player sweep landed on the holder this tick
  player: Spot; holder: Spot;
};
export type CrowdEvent =
  | { kind: 'pass'; from: number; to: number }   // mid-duel hand-over: the page swaps side 1 in place
  | { kind: 'fell'; who: number }
  | { kind: 'step-in'; to: number }              // after a breath: the page builds the next duel with the carried player
  | { kind: 'pushed'; who: number }
  | { kind: 'won' } | { kind: 'lost' };
export type Step = { state: CrowdState; events: CrowdEvent[] };

// The director's own LCG (the same constants as pit.ts fightSeed / src/match.ts nextSeed), never 0.
const lcg = (s: number): number => ((Math.imul(s >>> 0, 1664525) + 1013904223) >>> 0) || 731;
const unit = (s: number): number => s / 0x1_0000_0000;
// Each enemy's own AI seed: from the encounter seed and his slot, never 0.
export const enemySeed = (seed: number, i: number): number => lcg((seed ^ Math.imul(i + 1, 0x9e3779b1)) >>> 0);

const isLeader = (s: CrowdState, i: number) => s.enemies[i]!.role === 'leader';
const othersAlive = (s: CrowdState, i: number) => s.enemies.some((e, j) => j !== i && e.alive && !isLeader(s, j));

// May enemy i take the token now? `relaxed`: after a breath somebody MUST step in, so the role gates and the sweep delay give way.
function eligible(s: CrowdState, i: number, relaxed: boolean): boolean {
  const e = s.enemies[i]!;
  if (!e.alive || i === s.holder) return false;
  if (relaxed) return true;
  if (e.ring.delay > 0) return false;
  if (e.role === 'leader' && othersAlive(s, i)) return false;   // last to take the token
  if (e.role === 'brute' && !s.duellistHad && s.enemies.some((d, j) => j !== i && d.alive && d.role === 'duellist')) return false;   // only after a Duellist had it (while one lives)
  return true;
}
// Who steps in next: the first eligible in the queue (the "next" marker); a breath falls back to the first alive waiting enemy.
export function nextUp(s: CrowdState, relaxed = false): number | null {
  for (const i of s.queue) if (eligible(s, i, false)) return i;
  if (relaxed) for (const i of s.queue) if (eligible(s, i, true)) return i;
  return null;
}
// The holder's hand-over limits, set by who steps in after him and whether a pack leader still lives.
export function limits(s: CrowdState, next: number | null): { starts: number; hold: number } {
  const skirmisher = next !== null && s.enemies[next]!.role === 'skirmisher';
  const base = skirmisher ? SKIRMISHER_HANDOVER : { starts: CROWD.starts, hold: CROWD.hold };
  const leaderLives = s.enemies.some((e, j) => e.alive && e.role === 'leader' && j !== s.holder);
  return { starts: base.starts, hold: leaderLives ? Math.min(base.hold, LEADER_HOLD) : base.hold };
}

export type PackMember = { id: string; role?: Role };
// A new encounter: the order is a seeded shuffle with any leader moved last; the first eligible steps in at tick 0, the rest spread round
// the ring at their role's radius. Refuses an empty pack, one over CROWD.maxEnemies, or a repeated id.
export function newCrowd(seed: number, pack: readonly PackMember[]): CrowdState {
  if (!pack.length || pack.length > CROWD.maxEnemies) throw new Error(`crowd: a pack is 1..${CROWD.maxEnemies} enemies, got ${pack.length}`);
  if (new Set(pack.map((m) => m.id)).size !== pack.length) throw new Error('crowd: repeated enemy id');
  let rng = lcg(seed >>> 0);
  const order = pack.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) { rng = lcg(rng); const j = Math.floor(unit(rng) * (i + 1)); [order[i], order[j]] = [order[j]!, order[i]!]; }
  const ranked = [...order.filter((i) => pack[i]!.role !== 'leader'), ...order.filter((i) => pack[i]!.role === 'leader')];
  const enemies = pack.map((m, i): CrowdEnemy => {
    rng = lcg(rng); const turn: 1 | -1 = unit(rng) < 0.5 ? 1 : -1;
    rng = lcg(rng); const jitter = (unit(rng) - 0.5) * (Math.PI / pack.length);
    const role = m.role ?? 'duellist', slot = ranked.indexOf(i);
    return { id: m.id, role, seed: enemySeed(seed, i), alive: true, turns: 0, ring: { angle: (slot / pack.length) * Math.PI * 2 + jitter, radius: ROLE_RING[role].radius, turn, delay: 0 } };
  });
  const s: CrowdState = { tick: 0, rng, enemies, queue: ranked, holder: null, heldAt: 0, starts: 0, lastPass: -CROWD.minPassGap, breath: 0, duellistHad: false, leaderFell: false, outcome: null };
  return take(s, nextUp(s, true)!);
}

// Give the token to `to` (out of the queue); the old holder, if any and alive, goes to the back of the queue at the ring.
function take(s: CrowdState, to: number, from: number | null = null, at?: Spot, player?: Spot): CrowdState {
  const enemies = s.enemies.map((e, i) => {
    if (i === to) return { ...e, turns: e.turns + 1 };
    if (i === from && at && player) return { ...e, ring: { ...e.ring, angle: Math.atan2(at.x - player.x, at.z - player.z), radius: ROLE_RING[e.role].radius } };
    return e;
  });
  const queue = [...s.queue.filter((i) => i !== to), ...(from !== null && s.enemies[from]!.alive ? [from] : [])];
  return { ...s, enemies, queue, holder: to, heldAt: s.tick, starts: 0, lastPass: s.tick, breath: 0, duellistHad: s.duellistHad || s.enemies[to]!.role === 'duellist' };
}

// Where a waiting enemy stands now (sim metres).
export const ringSpot = (e: CrowdEnemy, player: Spot): Spot => ({ x: player.x + Math.sin(e.ring.angle) * e.ring.radius, z: player.z + Math.cos(e.ring.angle) * e.ring.radius });

// One 60 Hz tick of the director. Pure: the same state and observation always give the same result.
export function stepCrowd(prev: CrowdState, obs: Observation): Step {
  if (prev.outcome) return { state: prev, events: [] };
  const events: CrowdEvent[] = [];
  let s: CrowdState = { ...prev, tick: prev.tick + 1 };
  if (obs.playerDown) { events.push({ kind: 'lost' }); return { state: { ...s, outcome: 'lost' }, events }; }

  // The ring: everyone waiting circles, his sweep delay runs down and a pushed enemy drifts back to his role's radius.
  const push = obs.sweep && s.holder !== null;
  s = { ...s, enemies: s.enemies.map((e, i) => {
    if (!e.alive || i === s.holder) return e;
    const home = ROLE_RING[e.role];
    let ring: Ring = { ...e.ring, angle: e.ring.angle + e.ring.turn * home.pace, delay: Math.max(0, e.ring.delay - 1) };
    ring = { ...ring, radius: ring.radius > home.radius ? Math.max(home.radius, ring.radius - CROWD.ringReturn) : Math.min(home.radius, ring.radius + CROWD.ringReturn) };
    if (push) {
      const at = ringSpot({ ...e, ring }, obs.player);
      if (Math.hypot(at.x - obs.holder.x, at.z - obs.holder.z) <= SWEEP.reach) { ring = { ...ring, radius: CROWD.ring.max, delay: SWEEP.delay }; events.push({ kind: 'pushed', who: i }); }
    }
    return { ...e, ring };
  }) };

  if (s.holder !== null) {
    const h = s.holder;
    if (obs.holderDown) {
      const enemies = s.enemies.map((e, i) => (i === h ? { ...e, alive: false } : e));
      s = { ...s, enemies, holder: null, queue: s.queue.filter((i) => i !== h), leaderFell: s.leaderFell || s.enemies[h]!.role === 'leader' };
      events.push({ kind: 'fell', who: h });
      if (!enemies.some((e) => e.alive)) { events.push({ kind: 'won' }); return { state: { ...s, outcome: 'won' }, events }; }
      return { state: { ...s, breath: CROWD.breath }, events };
    }
    if (obs.holderStarted) s = { ...s, starts: s.starts + 1 };
    const next = nextUp(s), cap = limits(s, next);
    const due = s.starts >= cap.starts || s.tick - s.heldAt >= cap.hold;
    if (next !== null && due && obs.quiet && !s.leaderFell && s.tick - s.lastPass >= CROWD.minPassGap) {
      s = take(s, next, h, obs.holder, obs.player);
      events.push({ kind: 'pass', from: h, to: next });
    }
    return { state: s, events };
  }

  // A breath: count it down, then the next steps in.
  if (s.breath > 1) return { state: { ...s, breath: s.breath - 1 }, events };
  const to = nextUp(s, true)!;
  events.push({ kind: 'step-in', to });
  return { state: take(s, to), events };
}

// ---- Reading the duel and building the next one (pure; src/ types only, nothing in src/ changes) ----

const busy = (f: Fighter) => BUSY_PHASES.has(f.phase) || (f.special ?? 0) > 0;
// One tick's observation from the live two-fighter duel (side 0 the player, side 1 the holder) and that tick's events.
export function observe(duel: Duel, events: readonly CombatEvent[]): Observation {
  const [p, h] = duel.fighters;
  return {
    holderStarted: events.some((e) => e.type === 'AttackStarted' && e.actor === 1),
    quiet: !busy(p) && !busy(h) && p.chain === 0,
    holderDown: h.health <= 0 || duel.finish?.victim === 1,
    playerDown: p.health <= 0 || duel.finish?.victim === 0,
    sweep: events.some((e) => e.type === 'Hit' && e.actor === 0 && e.target === 1 && e.move !== undefined && SWEEP_MOVES.has(e.move)),
    player: { x: p.body.x, z: p.body.z }, holder: { x: h.body.x, z: h.body.z },
  };
}

// What carries over from the player's last duel into the next (2A: "your health, stamina, posture and wounds carry over"): onto a fresh
// player Fighter (the new duel's own side 0) go the bars, the wound and the leg wound; he stands where he stood, sword drawn.
export function carryPlayer(live: Fighter, fresh: Fighter): Fighter {
  return {
    ...fresh, body: { ...live.body }, phase: live.health > 0 ? 'ready' : live.phase,
    health: live.health, maxHealth: live.maxHealth, stamina: live.stamina, maxStamina: live.maxStamina, rest: live.rest, exhausted: live.exhausted,
    posture: live.posture, postureRest: live.postureRest, wound: live.wound, woundSite: live.woundSite, legWound: live.legWound,
    skill: live.skill, skillCooldown: live.skillCooldown,
  };
}
// An enemy coming in from the ring: his own saved Fighter (or a fresh one the first time), standing at his ring spot, facing the player,
// guard down and no move in hand. Each enemy keeps his own health, stamina and posture.
export function fromRing(saved: Fighter, at: Spot, player: Spot): Fighter {
  return { ...saved, body: { ...saved.body, x: at.x, z: at.z, heading: Math.atan2(player.x - at.x, player.z - at.z) }, phase: 'ready', age: 0, move: null, chained: false, buffer: null, charge: 0, charged: false, attackFrom: null, stall: 0 };
}
// A mid-duel hand-over: the same duel, the player untouched, side 1 replaced. The page saves the outgoing Fighter and AiState first.
export const handOver = (duel: Duel, incoming: Fighter): Duel => ({ ...duel, fighters: [duel.fighters[0], incoming], finish: null });
// The record 2A names for a later verifier (not a ladder FightRecord; never carries the arena RV).
export type EncounterRecord = { encounter: string; seed: number; enemySeeds: readonly number[]; ticks: number };
export const encounterRecord = (encounter: string, seed: number, s: CrowdState): EncounterRecord => ({ encounter, seed, enemySeeds: s.enemies.map((e) => e.seed), ticks: s.tick });
// Saved per enemy between his turns (the page's bookkeeping, typed here so tests and page agree).
export type Bench = { fighter: Fighter | null; ai: AiState | null };
