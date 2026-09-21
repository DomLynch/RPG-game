import { RULES, type AiProfile, type Direction, type MoveId, weaponOf } from './moves.ts';
import { aim, distance, elapsed, idleIntent, legal, mirror, movesOf, timing, walled, type Action, type Duel, type Intent, type Side, guardOf } from './duel.ts';

// Local opponent controller. It reads only committed duel state (never the other side's pending intent), notices a fresh
// action `reaction` ticks late, and emits an ordinary Intent that stepDuel judges by the same rules as the player's.
export type AiMode = 'approach' | 'circle' | 'retreat' | 'guard';
type AiPlan = 'parry' | 'dodge' | 'block' | 'evade' | 'ignore';
// Habits: what the opponent has done this match, counted from committed state edges only. The warden reads them (see `readOpponent`)
// and adapts — a parry-happy player gets baited swings, a turtle gets kicked and charged through, a roller gets delayed swings and
// tail punishes, a light-spammer gets parried more. Reads need evidence first, so the first exchanges are always the honest ones.
export type Habits = { ticks: number; guard: number; parries: number; rolls: number; steps: number; lights: number; heavies: number; thrusts: number; kicks: number; attacks: number; parks: number };
export type Reads = { parryHappy: boolean; turtle: boolean; roller: boolean; stepper: boolean; spammer: boolean; parker: boolean; poker: boolean; kicker: boolean };
export const READ = { feint: 1 / 6, after: 2, parry: .5, guardTicks: 180, guardShare: .45, roll: .4, swings: 11, lightShare: .7, baitHold: 12, parryBoost: 2, parryCap: .85, chargeBoost: .4, kickBoost: .3, anticipate: 8, baitShare: .7, parkShare: .5 } as const;   // swings 11 / anticipate 8 (re-swept after the slice-P stamina economy): a cut-only player at normal still wins about a quarter of duels (owner: 5–8 of 24)
export const readOpponent = (h: Habits): Reads => ({
  parryHappy: h.attacks >= READ.after && h.parries / h.attacks >= READ.parry,
  turtle: h.ticks >= READ.guardTicks && h.guard / h.ticks >= READ.guardShare,
  roller: h.attacks >= READ.after && h.rolls / h.attacks >= READ.roll,
  stepper: h.attacks >= READ.after && h.steps / h.attacks >= READ.roll,   // backsteps out of most of my swings (the whiff punisher's habit): a kick reaches where a swing does not
  spammer: h.lights + h.heavies + h.thrusts >= READ.swings && h.lights / (h.lights + h.heavies + h.thrusts) >= READ.lightShare,   // cuts only: a player mixing in thrusts or heavies is not a spammer
  parker: h.lights + h.heavies + h.thrusts >= READ.after && h.parks / (h.lights + h.heavies + h.thrusts) >= READ.parkShare,
  poker: h.lights + h.heavies + h.thrusts >= READ.after && h.thrusts / (h.lights + h.heavies + h.thrusts) >= .5,   // thrusts more than he cuts: a fighter with no guard respects his reach and goes in on the whiff
  kicker: h.kicks >= READ.after && h.kicks / (h.lights + h.heavies + h.thrusts + h.kicks) >= .5,   // kicks more than he swings: the same respect for the kick's reach   // swings mostly held at their chamber (baits, charges): the park is a habit, not a read of the moment
});
export type AiState = { seed: number; lastGap: number; lastTravel: number; mode: AiMode; side: 1 | -1; decision: number; wait: number; next: 'light' | 'heavy' | 'thrust' | null; plan: AiPlan | null; readSide: Direction | null; jitter: number; retreatUntil: number; hold: boolean; feint: boolean; disengageUntil: number; habits: Habits; scores: Record<string, number> };   // disengageUntil: the tick until which a landed blow is followed by a hop back out (profile.disengage)
export const initialAi = (seed = 731): AiState => ({ seed, lastGap: 99, lastTravel: 0, mode: 'approach', side: 1, decision: 90, wait: 90, next: null, plan: null, readSide: null, jitter: 0, retreatUntil: 0, hold: false, feint: false, disengageUntil: 0, habits: { ticks: 0, guard: 0, parries: 0, rolls: 0, steps: 0, lights: 0, heavies: 0, thrusts: 0, kicks: 0, attacks: 0, parks: 0 }, scores: {} });
const lcg = (seed: number) => (Math.imul(seed, 1664525) + 1013904223) >>> 0;

export function decide(duel: Duel, me: Side, ai: AiState, profile: AiProfile): { intent: Intent; ai: AiState } {
  const M = duel.fighters[me], F = duel.fighters[1 - me], tick = duel.tick, next = { ...ai, scores: {} as Record<string, number> }, intent = idleIntent();
  if (!M.health || !F.health || F.phase === 'sheathed' || F.phase === 'draw') return { intent, ai: next };
  const roll = () => { next.seed = lcg(next.seed); return next.seed / 2 ** 32; };
  // Every exit: a raised guard or a parry press carries the side read for the current threat; with nothing coming the guard stands straight (null = thrust).
  const done = () => { if (intent.guard || intent.action === 'parry') intent.guardDirection = threat && noticed && next.readSide ? next.readSide : undefined; return { intent, ai: next }; };
  const gap = distance(M.body, F.body), facing = aim(M.body, F.body), mine = movesOf(M), theirs = movesOf(F), fight = weaponOf(M.weapon).fight;   // each side reads its own weapon's tables
  const inside = gap < (mine.thrust.minReach ?? 0);   // inside a pole's point: the thrust meets nothing here; the answer is the kick, then a step back out
  next.lastGap = gap; next.lastTravel = F.body.distance;   // for the next tick's read of an advancing opponent
  const canAct = M.phase === 'ready' || M.phase === 'guard';
  const guardShare = profile.guard ?? 1;   // fight-identity knobs (moves.ts AiProfile): absent = the warden as it always was
  // Hit and run: a blow that landed this tick earns a hop back out of range (profile.disengage), taken as soon as the swing has recovered.
  if (profile.disengage && duel.events.some(e => e.type === 'Hit' && e.actor === me) && roll() < profile.disengage) next.disengageUntil = tick + 40;
  // Observe the opponent's habits from state edges (age 0 = this tick's start) and read them.
  const h = next.habits = { ...ai.habits, ticks: ai.habits.ticks + 1 };
  if (F.phase === 'guard') h.guard++;
  if (F.phase === 'guard' && F.parrying && F.age === 0) h.parries++;
  if (F.phase === 'roll' && F.age === 0) h.rolls++;
  if (F.phase === 'backstep' && F.age === 0) h.steps++;
  if (F.phase === 'attack' && F.charge === 1) h.parks++;   // the first tick a swing sat at its chamber
  if (F.phase === 'attack' && F.age === 0 && F.move) { if (F.move === 'heavy_overhead') h.heavies++; else if (F.move === 'thrust') h.thrusts++; else if (F.move === 'light_left' || F.move === 'light_right') h.lights++; else if (F.move === 'kick') h.kicks++; }   // ripostes, counters and criticals are earned, not habits
  if (M.phase === 'attack' && M.age === 0 && M.move !== 'kick') h.attacks++;
  const reads = readOpponent(h);
  // A held swing: a heavy thrown at a standing guard (or at a roller / parrier) is held to the charge that breaks or outlasts them; a
  // light held against a parry-happy player is a bait that outlives the parry window. The hold ends with the swing.
  if (M.phase !== 'attack') { next.hold = false; next.feint = false; }
  // A feinted swing: started to draw the parry, cancelled into a guard on the last feintable tick — the parry-happy player's press now meets nothing.
  if (next.feint && M.phase === 'attack' && M.move && M.age === mine[M.move].feintUntil - 1) { next.feint = false; return { intent: { ...intent, action: 'parry', guard: true }, ai: next }; }
  intent.held = next.hold && M.phase === 'attack' && (M.move === 'heavy_overhead' ? M.charge < RULES.charge.min : M.charge < READ.baitHold);
  const charging = (f: typeof F) => f.phase === 'attack' && f.move !== null && f.charge > 0 && movesOf(f)[f.move].charges;   // a chambered light is a bait, not a guard breaker
  // Being hit: back off briefly, then decide afresh (re-engage or keep distance) rather than drifting away.
  if (M.phase === 'hurt' && M.age === 1) { next.retreatUntil = tick + 48; next.decision = 48; next.mode = 'retreat'; next.plan = null; next.next = null; next.wait = Math.round((45 + roll() * 60) * (1.6 - profile.aggression)); }   // a landed blow earns the player a window; no instant retaliation
  // Perception. An attack is noticed `reaction` ticks after it starts; one response is planned per attack.
  const threat = F.phase === 'attack' && !F.landed && F.move !== null && F.age < timing(F).windup + timing(F).active;   // a swing is a threat until its active window closes
  // Perception runs on elapsed time, not the animation clock: a swing parked at its chamber is still a swing that started `reaction` ticks ago.
  // A read cut-spammer's cuts are anticipated, not reacted to: the warden is already waiting for the cut it knows is coming, so the cut is
  // noticed within a few ticks — the parry that a 14-tick cut is otherwise too fast for. Heavies and kicks keep the honest reaction.
  const reaction = reads.spammer && (F.move === 'light_left' || F.move === 'light_right') ? Math.min(profile.reaction, READ.anticipate) : profile.reaction;
  const noticed = threat && elapsed(F) >= reaction;
  if (!threat) { next.plan = null; next.readSide = null; }
  else if (elapsed(F) === reaction) {
    // The side (directional guard): the warden reads which side the blow arrives on with `profile.read`; a misread picks one of the other four,
    // and the guard he holds or the parry he presses goes there. Rolled once per threat; a profile without the knob rolls nothing and reads
    // perfectly (the pre-directional guard). A kick read right is met low — the braced kick (below).
    const want = mirror(theirs[F.move!].direction);
    next.readSide = guardShare === 0 ? null : profile.read === undefined || roll() < profile.read ? want : (['left', 'right', 'overhead', 'thrust', 'low'] as Direction[]).filter(d => d !== want)[Math.floor(roll() * 4)];   // a guardless fighter (the goblin) has no side to pick and rolls nothing: his stream is untouched
    const r = roll(), inRange = gap <= theirs[F.move!].reach + .4, unblockable = theirs[F.move!].breaksGuard || charging(F) || (guardOf(M).heavyBreaks && theirs[F.move!].direction === 'overhead'), affordable = M.stamina >= theirs[F.move!].staminaDamage;
    // A kick cannot be parried and punishes a raised guard, so a guard or a parry is never the answer. With its dodge share the warden rolls
    // (or steps out without the stamina); otherwise it takes the kick — a cheap poke whose point is to open a guard, and a warden that
    // escaped every kick would have no guard left to open (a backstep escapes it as surely as a roll).
    // A stepper takes the cheap step out when the step will clear the blow's reach before it lands (half the step is all the reaction leaves), else the roll.
    // A kick he READ is braced behind a low guard (directional guard: an ordinary block); misread or guardless, he takes it as before.
    const clears = gap + RULES.backstep.ticks * RULES.backstep.speed * 3 / 60 * M.speed * .5 > theirs[F.move!].reach + .1;
    if (inRange && !theirs[F.move!].parryable) { next.plan = r < profile.dodge ? (M.stamina >= RULES.rollCost && !(profile.step && clears && roll() < profile.step) ? 'dodge' : 'evade') : next.readSide === 'low' && guardShare > 0 && affordable ? 'block' : 'ignore'; next.jitter = Math.round((1 - profile.accuracy) * 8 * (roll() * 2 - 1)); }
    else {
    // A lapse: the swing was seen but gets no answer (a cut of 20 ticks is reactable; a human still eats a share of them). Reads sharpen attention:
    // against a read spammer the lapse halves.
    const lapse = reads.spammer ? profile.lapse * .5 : profile.lapse;
    const parryChance = reads.spammer ? Math.min(READ.parryCap, 1 - profile.dodge, profile.parry * READ.parryBoost) : profile.parry;   // a cut-only player is parried more (never by a profile that cannot parry; rolls keep their share)
    // A swing that cannot reach is ignored. A guard stops what it can afford; a charged heavy or a riposte calls for a timed parry, a roll or distance.
    next.plan = !inRange || roll() < lapse ? 'ignore' : r < parryChance && !M.parryCooldown ? 'parry' : r < parryChance + profile.dodge && M.stamina >= RULES.rollCost ? 'dodge' : unblockable ? (M.stamina >= RULES.rollCost && !(profile.step && clears && roll() < profile.step) ? 'dodge' : !M.parryCooldown && guardShare > 0 ? 'parry' : 'evade') : affordable && (guardShare >= 1 || roll() < guardShare) ? 'block' : 'evade';
    next.jitter = Math.round((1 - profile.accuracy) * 8 * (roll() * 2 - 1));
    }
  } else if (noticed && next.plan === 'block' && charging(F)) next.plan = M.stamina >= RULES.rollCost ? 'dodge' : !M.parryCooldown && guardShare > 0 ? 'parry' : 'evade';   // a heavy seen to be charging will break the guard: change the answer
  // Openings: a stagger, exhaustion, the recovery of a swing that missed — and, against a roller, the tail of a roll. A landed hit is not an opening: it staggered me.
  const opening = (F.phase === 'hurt' && F.age >= profile.reaction) || F.exhausted || F.exposed > 0 || (F.phase === 'attack' && !F.landed && F.age - timing(F).windup - timing(F).active >= profile.reaction) || (reads.roller && F.phase === 'roll' && F.age >= RULES.safeEnd);   // a parry that met nothing is the classic opening
  const guarded = F.phase === 'guard' && F.age >= profile.reaction;
  // Walking onto the point: the opponent moved this tick and the gap closed, from beyond cutting range to inside the thrust's.
  const advancing = (F.phase === 'ready' || F.phase === 'guard') && F.body.distance > ai.lastTravel && ai.lastGap > gap + .01 && gap < mine.thrust.reach - .1 && gap > mine.light_right.reach - .1;
  const pressured = reads.spammer && F.phase === 'ready' && gap <= theirs.light_right.reach + .1;   // a read spammer standing ready inside cutting range will cut before a slow swing lands
  // Movement mode: seeded, bounded decisions; never reads hidden input.
  // Timers pause while staggered: the punish window is measured from recovery, not from the blow.
  if (M.phase !== 'hurt') { next.decision = Math.max(0, next.decision - 1); next.wait = Math.max(0, next.wait - 1); }
  // When the cadence timer expires the warden commits to the kind of attack it will close in for.
  // The first opener is always the heavy (the readable parry lesson); after that the warden also opens with the thrust — a faster tell
  // (16 ticks to the heavy's 32) with the longest reach, so it is the spacing opener from just outside cutting range.
  // A read parrier sees mostly cuts (held past the parry window as baits, or feinted), not the heavy whose long tell is what they are parrying.
  // The lorarii: three quarters of a loiter clock at the wall and the next opener is now, not on the cadence, and a circler closes to
  // deliver it (an attack resets the clock; circling at 1.3 m with a knife swings at nothing and gets lashed).
  if (M.loiter >= RULES.wall.loiter.ticks * .75) { next.wait = 0; if (next.mode === 'circle' && M.stamina >= profile.discipline * M.maxStamina / 100) next.mode = 'approach'; }
  if (!next.wait && !next.next && canAct) next.next = roll() < (reads.parryHappy ? Math.max(profile.pressure, READ.baitShare) : profile.pressure) ? 'light' : h.attacks > 0 && roll() < fight.thrustShare ? 'thrust' : 'heavy';
  // An opener the bar's worn ceiling can no longer pay for (attrition; a weapon whose heavy costs more than the floor) would be waited for
  // for ever: it becomes a cut, which every weapon can always afford at the floor.
  if (next.next && next.next !== 'light' && mine[next.next === 'heavy' ? 'heavy_overhead' : 'thrust'].stamina > M.maxStamina) next.next = 'light';
  // A planned cut whose blade has a point (minReach) is useless against a man standing inside it; if the heavy or the thrust can be thrown from here,
  // the plan becomes that instead of waiting for a cut that never comes (the Executioner at hard stood over a man at 1.2 m for a minute: his cut
  // needs 1.5 m, his heavy 0 — and hard plans cuts half the time).
  if (next.next === 'light' && gap < (mine.light_right.minReach ?? 0) + .1) { const can = (id: 'heavy_overhead' | 'thrust', action: 'heavy' | 'thrust') => gap >= (mine[id].minReach ?? 0) + .1 && gap <= mine[id].reach - .1 && legal(M, action); if (can('heavy_overhead', 'heavy')) next.next = 'heavy'; else if (can('thrust', 'thrust')) next.next = 'thrust'; }
  if (pressured && next.next === 'heavy') next.next = 'light';   // a heavy planned against a read spammer becomes a cut: the 32-tick swing would be cut first (and never left the warden waiting in guard for a cut that does not come)
  // Below the stamina floor it recovers by circling just outside the player's light reach; it only backs right off
  // when very low or freshly hit. Guarding stops regeneration, so it is a choice made with stamina in hand.
  // The stamina floor is a share of the bar's current ceiling: attrition wounds lower the ceiling, and a floor above it would leave the warden circling for ever.
  const floor = profile.discipline * M.maxStamina / 100, low = M.stamina < floor, shaky = M.posture >= RULES.posture.max * .7;   // near a posture break it gives ground so the bar drains
  if (!next.decision) {
    const r = roll();
    next.decision = 36 + Math.floor(r * 45); next.side = next.seed & 1 ? 1 : -1;
    next.mode = low || shaky ? (gap < 1.7 || M.stamina < RULES.rollCost ? 'retreat' : 'circle') : gap > 1.4 ? 'approach' : gap < 1 ? 'retreat' : r < .33 * guardShare ? 'guard' : 'circle';
  }
  if (gap > 2.5 || (!low && !shaky && gap > 1.9)) next.mode = 'approach';
  if (tick < next.retreatUntil || ((low || shaky) && gap < 1.2)) next.mode = 'retreat';
  else if ((low || shaky) && next.mode === 'retreat' && gap >= 1.9) next.mode = 'circle';
  // The ring wall. A retreat that would put its own back to the wall becomes a circle along it, on the side that leads inward; a player with
  // the wall at their back is pressed straight (no circling: the wall is doing the cutting off).
  const myBack = walled(M.body, -Math.sin(facing), -Math.cos(facing)), theirBack = walled(F.body, Math.sin(facing), Math.cos(facing));
  if (next.mode === 'retreat' && myBack) { next.mode = 'circle'; next.side = (M.body.x * Math.cos(facing) - M.body.z * Math.sin(facing)) > 0 ? -1 : 1; }   // lateral toward the centre
  if (next.mode === 'circle' && theirBack && !low && !shaky) next.mode = 'approach';
  if (canAct && noticed && next.plan !== 'ignore') {
    // Contact is estimated on the animation clock, so a swing parked at its chamber does not draw the press. A committing parrier (the
    // Nightborn) reads the tell instead — elapsed ticks since the swing began, the way a human does — so a swing held at its chamber draws
    // his press and meets nothing: the bait and the charge are his weaknesses. Until the park is read as a habit (reads.parker): then he
    // waits for the blade to pass its chamber and presses on its clock like a man. The first baits land; a habit does not.
    const commits = guardOf(M).commits, wary = commits && reads.parker, window = guardOf(M).window;
    const estimate = timing(F).windup - (commits && !wary ? elapsed(F) : F.age) + next.jitter;
    const moving = !wary || F.age > (theirs[F.move!].chamber ?? -1);
    next.scores = { [next.plan!]: 1, estimate };
    if (next.plan === 'parry') {
      // Press when the window will cover the estimated contact; hold an open window; release a stale standing guard so a fresh press can parry.
      // The press comes `window − 2` ticks before contact so the window's tail covers it: a man's 10-tick window presses at contact − 8; a longer
      // window (the Nightborn's 14) presses earlier — inside the player's feint window, which is exactly what makes him baitable.
      if (M.phase === 'ready') { if (estimate <= window - 2 && moving) { intent.action = 'parry'; intent.guard = true; } }
      else intent.guard = M.age < window || estimate <= 3;
    } else if (next.plan === 'dodge' && M.stamina >= RULES.rollCost && estimate <= RULES.safeEnd - 2 && estimate >= RULES.safeStart) intent.action = 'dodge';
    else if (next.plan === 'evade') { if (legal(M, 'backstep') && gap <= theirs[F.move!].reach + .2) intent.action = 'backstep'; else intent.move = { x: -Math.sin(facing), z: -Math.cos(facing), yaw: 0, run: false }; }   // step out of the blow's reach (one step while inside it), then keep walking back, still facing the blade
    else if (guardShare > 0) intent.guard = true;   // a block, or a roll whose moment has not come: wait behind the guard (a guardless fighter waits on his feet)
    return done();
  }
  // Offence: utility scores over what the opponent is committed to. A light is a punish or a chain; a heavy or kick is the
  // honest, readable attack against a standing opponent, so every difficulty shows the player the parry timing.
  if (canAct && !M.exhausted) {
    // Move reach already includes the wind-up step-in; a small margin keeps swings from whiffing at the edge.
    const inReach = (id: MoveId) => gap <= mine[id].reach - .1 && gap >= (mine[id].minReach ?? 0) + .1 && legal(M, id === 'heavy_overhead' ? 'heavy' : id === 'kick' ? 'kick' : id === 'thrust' ? 'thrust' : 'light');
    const r = roll();
    const scores: Record<string, number> = {
      critical: M.critical > 0 && inReach('heavy_overhead') ? 1.6 : 0,   // a broken posture is finished with the critical, not a riposte
      counter: M.counterWindow > 0 && inReach('heavy_overhead') ? 1.4 : 0,   // a block opens the guard counter: the designed answer to cut pressure
      punish: opening && inReach('light_right') ? 1.5 : 0,
      chain: M.chain > 0 && (inReach('light_right') || (M.lastMove !== null && !!mine[M.lastMove].chain?.follow.includes('thrust') && inReach('thrust'))) && r < profile.aggression ? 1.2 : 0,   // a follow-up the cut cannot reach goes as the thrust when the chain allows it
      kick: inReach('kick') && ((inside && !threat && tick >= next.retreatUntil) || ((guarded || reads.parryHappy) && r < .5 + (reads.turtle || reads.parryHappy ? READ.kickBoost : 0)) || (!!profile.kick && !threat && (reads.roller || reads.stepper) && r < profile.kick)) ? 1.1 + (reads.turtle ? READ.kickBoost : 0) : 0,   // profile.kick: a kicker's answer to a read roller or backstepper — the one blow their timing does not escape   // inside a pole's point the kick is the only blow that lands — not into a swing already in the air, and not inside the window a landed blow earned the player   // a turtle is kicked more; a kick goes through a parry window, so a parrier is kicked too
      heavy: guarded && inReach('heavy_overhead') ? 1 : next.next === 'heavy' && !threat && !pressured && inReach('heavy_overhead') ? .8 : 0,   // never a slow opener into a ready spammer: the cut lands first
      light: next.next === 'light' && !threat && !guarded && inReach('light_right') ? .8 : 0,
      // A fast fighter's counter-swing: a cut INTO a slower tell that will land first (their wind-up has more left than his whole cut) — the interrupt.
      interrupt: profile.interrupt && threat && F.move !== null && !F.landed && timing(F).windup - F.age > mine.light_right.windup + 2 && inReach('light_right') && r < profile.interrupt ? 1.3 : 0,
      // The thrust: a stop-hit into an opponent walking onto the point (it lands at 1.5× and staggers longer), or the scheduled opener from wherever it
      // stands; blockable, so never into a standing guard.
      thrust: !threat && !guarded && inReach('thrust') && next.next !== null && (advancing || next.next === 'thrust') ? (advancing ? .9 : .8) : 0,   // on the cadence only: an attack that is due anyway becomes the stop-hit when the opponent is walking in
    };
    if (low) for (const key of ['chain', 'kick', 'heavy', 'light', 'thrust', 'interrupt']) scores[key] = 0;   // stamina discipline: only punishes below the floor
    next.scores = scores;
    const [best, score] = Object.entries(scores).sort((x, y) => y[1] - x[1])[0];
    if (score > 0) {
      const action: Action = best === 'kick' ? 'kick' : best === 'heavy' || best === 'critical' || best === 'counter' ? 'heavy' : best === 'thrust' || (best === 'chain' && !inReach('light_right')) ? 'thrust' : 'light';
      next.wait = Math.round((45 + roll() * 60) * (1.6 - profile.aggression)); next.next = null;
      // A less aggressive warden sometimes baits instead: a visible guard the player must open with a heavy or a kick.
      // The stop-hit is never traded for a bait: the moment is now.
      if ((best === 'heavy' || best === 'light' || (best === 'thrust' && !advancing)) && !guarded && roll() < (1 - profile.aggression) * .6 * guardShare) { next.mode = 'guard'; next.decision = 36 + Math.floor(roll() * 45); intent.guard = true; return done(); }
      // A guard is charged through 20/40/60 % of the time by level (more against a turtle or a roller, whose answer a charge outlasts); a
      // parry-happy player has lights held past the parry window as baits.
      const chargeChance = profile.aggression - .25 + (reads.turtle || reads.roller || reads.parryHappy ? READ.chargeBoost : 0);
      next.hold = best === 'heavy' ? (guarded || reads.roller || reads.parryHappy) && roll() < chargeChance : best === 'light' && reads.parryHappy && roll() < READ.baitShare;
      const feintChance = Math.max(profile.feint ?? 0, reads.parryHappy ? READ.feint : 0);   // one swing in six at a parrier is a feint; a feinting fighter (profile.feint) feints anyone
      next.feint = feintChance > 0 && (action === 'heavy' || action === 'light') && !next.hold && roll() < feintChance;
      return { intent: { ...intent, action, held: next.hold }, ai: next };
    }
  }
  // Against a read cut-spammer the warden walks in guard inside cutting range when it is not swinging: the cuts are blocked (no chip) and
  // every block opens the guard counter above. It keeps closing (a guard walk, at guard speed) so a spammer hovering at the edge of
  // reach is met, never waited for. Below the stamina floor it steps back out instead.
  if (pressured && canAct && !M.exhausted && !threat && !low && guardShare > 0) intent.guard = true;
  if (next.mode === 'guard' && canAct && !M.exhausted) { intent.guard = true; return done(); }
  // Inside the point with no kick to give (spent, or just thrown): a backstep out to where the pole works, still facing the blade.
  if (inside && canAct && !threat && legal(M, 'backstep')) return { intent: { ...intent, action: 'backstep' }, ai: next };
  // Hit and run: the hop back out after a landed blow.
  if (tick < next.disengageUntil && canAct && !threat && legal(M, 'backstep')) { next.disengageUntil = 0; return { intent: { ...intent, action: 'backstep' }, ai: next }; }
  // Closing distance: to cutting range normally; a warden that has decided on a thrust stops just inside thrust reach, so the thrust opens from where a cut cannot reach.
  // Between a pole's point and its first move in reach (minReach … minReach + .1, the margin inReach keeps): a step back to where the pole works
  // instead of standing frozen — the reaper Wraith, whose approach stops at 1.9 m, met a fighter parked at 1.45 m and never moved again.
  const cramped = next.mode === 'approach' && gap < (mine.thrust.minReach ?? 0) + .1;
  let forward = next.mode === 'approach' && gap > (next.next === 'thrust' ? mine.thrust.reach - .2 : fight.close) ? .6 : next.mode === 'retreat' && gap < (low ? 1.9 : 2.2) ? -.4 : cramped ? -.4 : 0;
  // A fighter who cannot block, against a read poker: hover just outside the thrust's reach and go in on the whiff (the opening), never walk onto the point.
  // (Standing at the edge of the reach, not beyond it: a poker who is never given the shot never whiffs. The step out answers the thrust; the whiff opens him.)
  const hover = guardShare === 0 ? (reads.poker ? theirs.thrust.reach : reads.kicker ? theirs.kick.reach + .3 : 0) : 0;   // the reach respected: the thrust's, or the kick's cone plus its lunge
  if (hover && !opening && (F.phase === 'ready' || F.phase === 'guard' || (threat && (!noticed || next.plan === 'ignore'))) && gap < hover - .05 && forward > 0) forward = gap < hover - .3 ? -.4 : 0;   // a blow not yet noticed is not walked into either
  const lateral = next.mode === 'circle' ? next.side * .25 : next.mode === 'approach' && forward ? next.side * .25 * (profile.circle ?? 0) : 0;   // a circler drifts sideways while closing in
  // The dart: a sprint into an opening from outside reach (profile.dash), so the whiff is punished before it closes.
  const dash = !!profile.dash && opening && forward > 0 && gap > fight.close + .3 && M.stamina > RULES.rollCost && roll() < profile.dash;
  intent.move = { x: Math.sin(facing) * forward + Math.cos(facing) * lateral, z: Math.cos(facing) * forward - Math.sin(facing) * lateral, yaw: 0, run: dash };
  // The lorarii (RULES.wall.loiter): three quarters of a loiter clock spent in the wall band and the fighter walks off it, toward the centre, whatever his
  // mode — the whip is a worse deal than a step. Same rule for every rung (the Goblin, circling along the wall, was lashed 17 times in 24 fights).
  if (M.loiter >= RULES.wall.loiter.ticks * .75 && intent.action === null && gap > fight.close + .3) {   // in melee he attacks instead (that resets the clock)
    const r = Math.hypot(M.body.x, M.body.z), inward = { x: -M.body.x / r, z: -M.body.z / r };
    intent.move = { x: intent.move.x * .5 + inward.x * .5, z: intent.move.z * .5 + inward.z * .5, yaw: 0, run: false };
  }
  return done();
}
