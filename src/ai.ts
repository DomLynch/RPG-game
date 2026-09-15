import { MOVES, RULES, type AiProfile } from './moves.ts';
import { aim, distance, idleIntent, legal, timing, type Action, type Duel, type Intent, type Side } from './duel.ts';

// Local opponent controller. It reads only committed duel state (never the other side's pending intent), notices a fresh
// action `reaction` ticks late, and emits an ordinary Intent that stepDuel judges by the same rules as the player's.
export type AiMode = 'approach' | 'circle' | 'retreat' | 'guard';
export type AiPlan = 'parry' | 'dodge' | 'block' | 'evade' | 'ignore';
export type AiState = { seed: number; mode: AiMode; side: 1 | -1; decision: number; wait: number; next: 'light' | 'heavy' | null; plan: AiPlan | null; jitter: number; retreatUntil: number; hold: boolean; scores: Record<string, number> };
export const initialAi = (seed = 731): AiState => ({ seed, mode: 'approach', side: 1, decision: 90, wait: 90, next: null, plan: null, jitter: 0, retreatUntil: 0, hold: false, scores: {} });
const lcg = (seed: number) => (Math.imul(seed, 1664525) + 1013904223) >>> 0;

export function decide(duel: Duel, me: Side, ai: AiState, profile: AiProfile): { intent: Intent; ai: AiState } {
  const M = duel.fighters[me], F = duel.fighters[1 - me], tick = duel.tick, next = { ...ai, scores: {} as Record<string, number> }, intent = idleIntent();
  if (!M.health || !F.health || F.phase === 'sheathed' || F.phase === 'draw') return { intent, ai: next };
  const roll = () => { next.seed = lcg(next.seed); return next.seed / 2 ** 32; };
  const gap = distance(M.body, F.body), facing = aim(M.body, F.body);
  const canAct = M.phase === 'ready' || M.phase === 'guard';
  // A heavy thrown at a standing guard is held to the charge that breaks it; the hold ends with the swing.
  if (M.phase !== 'attack') next.hold = false;
  intent.held = next.hold && M.phase === 'attack' && M.move === 'heavy_overhead' && M.charge < RULES.charge.min;
  const charging = (f: typeof F) => f.phase === 'attack' && f.move !== null && f.charge > 0 && MOVES[f.move].charges;   // a chambered light is a bait, not a guard breaker
  // Being hit: back off briefly, then decide afresh (re-engage or keep distance) rather than drifting away.
  if (M.phase === 'hurt' && M.age === 1) { next.retreatUntil = tick + 48; next.decision = 48; next.mode = 'retreat'; next.plan = null; next.next = null; next.wait = Math.round((45 + roll() * 60) * (1.6 - profile.aggression)); }   // a landed blow earns the player a window; no instant retaliation
  // Perception. An attack is noticed `reaction` ticks after it starts; one response is planned per attack.
  const threat = F.phase === 'attack' && !F.landed && F.move !== null && F.age < timing(F).windup + timing(F).active;   // a swing is a threat until its active window closes
  const noticed = threat && F.age >= profile.reaction;
  if (!threat) next.plan = null;
  else if (F.age === profile.reaction) {
    const r = roll(), inRange = gap <= MOVES[F.move!].reach + .4, unblockable = MOVES[F.move!].breaksGuard || charging(F), affordable = M.stamina >= MOVES[F.move!].staminaDamage;
    // A swing that cannot reach is ignored. A guard stops what it can afford; a charged heavy or a riposte calls for a timed parry, a roll or distance.
    next.plan = !inRange ? 'ignore' : r < profile.parry && !M.parryCooldown ? 'parry' : r < profile.parry + profile.dodge && M.stamina >= RULES.rollCost ? 'dodge' : unblockable ? (M.stamina >= RULES.rollCost ? 'dodge' : !M.parryCooldown ? 'parry' : 'evade') : affordable ? 'block' : 'evade';
    next.jitter = Math.round((1 - profile.accuracy) * 8 * (roll() * 2 - 1));
  } else if (noticed && next.plan === 'block' && charging(F)) next.plan = M.stamina >= RULES.rollCost ? 'dodge' : !M.parryCooldown ? 'parry' : 'evade';   // a heavy seen to be charging will break the guard: change the answer
  // Openings: a stagger, exhaustion, or the recovery of a swing that missed. A landed hit is not an opening: it staggered me.
  const opening = (F.phase === 'hurt' && F.age >= profile.reaction) || F.exhausted || (F.phase === 'attack' && !F.landed && F.age - timing(F).windup - timing(F).active >= profile.reaction);
  const guarded = F.phase === 'guard' && F.age >= profile.reaction;
  // Movement mode: seeded, bounded decisions; never reads hidden input.
  // Timers pause while staggered: the punish window is measured from recovery, not from the blow.
  if (M.phase !== 'hurt') { next.decision = Math.max(0, next.decision - 1); next.wait = Math.max(0, next.wait - 1); }
  // When the cadence timer expires the warden commits to the kind of attack it will close in for.
  if (!next.wait && !next.next && canAct) next.next = roll() < profile.pressure ? 'light' : 'heavy';
  // Below the stamina floor it recovers by circling just outside the player's light reach; it only backs right off
  // when very low or freshly hit. Guarding stops regeneration, so it is a choice made with stamina in hand.
  const low = M.stamina < profile.discipline;
  if (!next.decision) {
    const r = roll();
    next.decision = 36 + Math.floor(r * 45); next.side = next.seed & 1 ? 1 : -1;
    next.mode = low ? (gap < 1.7 || M.stamina < RULES.rollCost ? 'retreat' : 'circle') : gap > 1.4 ? 'approach' : gap < 1 ? 'retreat' : r < .33 ? 'guard' : 'circle';
  }
  if (gap > 2.5 || (!low && gap > 1.9)) next.mode = 'approach';
  if (tick < next.retreatUntil || (low && gap < 1.2)) next.mode = 'retreat';
  else if (low && next.mode === 'retreat' && gap >= 1.9) next.mode = 'circle';
  if (canAct && noticed && next.plan !== 'ignore') {
    const estimate = timing(F).windup - F.age + next.jitter;
    next.scores = { [next.plan!]: 1, estimate };
    if (next.plan === 'parry') {
      // Press when the window will cover the estimated contact; hold an open window; release a stale standing guard so a fresh press can parry.
      if (M.phase === 'ready') { if (estimate <= RULES.parry - 2) { intent.action = 'parry'; intent.guard = true; } }
      else intent.guard = M.age < RULES.parry || estimate <= 3;
    } else if (next.plan === 'dodge' && M.stamina >= RULES.rollCost && estimate <= RULES.safeEnd - 2 && estimate >= RULES.safeStart) intent.action = 'dodge';
    else if (next.plan === 'evade') { if (legal(M, 'backstep')) intent.action = 'backstep'; else intent.move = { x: -Math.sin(facing), z: -Math.cos(facing), yaw: 0, run: false }; }   // step out of reach, still facing the blade
    else intent.guard = true;
    return { intent, ai: next };
  }
  // Offence: utility scores over what the opponent is committed to. A light is a punish or a chain; a heavy or kick is the
  // honest, readable attack against a standing opponent, so every difficulty shows the player the parry timing.
  if (canAct && !M.exhausted) {
    // Move reach already includes the wind-up step-in; a small margin keeps swings from whiffing at the edge.
    const inReach = (id: keyof typeof MOVES) => gap <= MOVES[id].reach - .1 && legal(M, id === 'heavy_overhead' ? 'heavy' : id === 'kick' ? 'kick' : 'light');
    const r = roll();
    const scores: Record<string, number> = {
      punish: opening && inReach('light_right') ? 1.5 : 0,
      chain: M.chain > 0 && inReach('light_right') && r < profile.aggression ? 1.2 : 0,
      kick: guarded && inReach('kick') && r < .5 ? 1.1 : 0,
      heavy: guarded && inReach('heavy_overhead') ? 1 : next.next === 'heavy' && !threat && inReach('heavy_overhead') ? .8 : 0,
      light: next.next === 'light' && !threat && !guarded && inReach('light_right') ? .8 : 0,
    };
    if (M.stamina < profile.discipline) for (const key of ['chain', 'kick', 'heavy', 'light']) scores[key] = 0;   // stamina discipline: only punishes below the floor
    next.scores = scores;
    const [best, score] = Object.entries(scores).sort((x, y) => y[1] - x[1])[0];
    if (score > 0) {
      const action: Action = best === 'kick' ? 'kick' : best === 'heavy' ? 'heavy' : 'light';
      next.wait = Math.round((45 + roll() * 60) * (1.6 - profile.aggression)); next.next = null;
      // A less aggressive warden sometimes baits instead: a visible guard the player must open with a heavy or a kick.
      if ((best === 'heavy' || best === 'light') && !guarded && roll() < (1 - profile.aggression) * .6) { next.mode = 'guard'; next.decision = 36 + Math.floor(roll() * 45); intent.guard = true; return { intent, ai: next }; }
      next.hold = best === 'heavy' && guarded && roll() < profile.aggression - .25;   // a guard is charged through 20/40/60 % of the time by level; the rest are plain heavies the guard can take for chip
      return { intent: { ...intent, action, held: next.hold }, ai: next };
    }
  }
  if (next.mode === 'guard' && canAct && !M.exhausted) { intent.guard = true; return { intent, ai: next }; }
  const forward = next.mode === 'approach' && gap > 1.15 ? .6 : next.mode === 'retreat' && gap < (low ? 1.9 : 2.2) ? -.4 : 0;
  const lateral = next.mode === 'circle' ? next.side * .25 : 0;
  intent.move = { x: Math.sin(facing) * forward + Math.cos(facing) * lateral, z: Math.cos(facing) * forward - Math.sin(facing) * lateral, yaw: 0, run: false };
  return { intent, ai: next };
}
