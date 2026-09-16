import { decide, initialAi, readOpponent, type AiMode, type AiState } from './ai.ts';
import type { HitLocation } from './blade.ts';
import { inBufferWindow, initialDuel, legal, movesOf, stepDuel, timing, type Action, type CombatEvent, type Duel, type Fighter, type Finish, type Intent, type Side } from './duel.ts';
import { MOVES, PATHS, PROFILES, RULES, total, weaponOf, type AiProfile, type MoveId, type PathId, type Weapon, type WeaponId } from './moves.ts';
import type { State } from './sim.ts';
export { PROFILES, RULES, MOVES } from './moves.ts';
export type { Intent, Action, CombatEvent, Duel, Fighter } from './duel.ts';
export type { AiProfile } from './moves.ts';

// Legacy constant views. Presentation, the blade bake and older tests read these shapes; the simulation reads moves.ts.
export const SWORD = { draw: RULES.draw, contact: PATHS.light_right.windup, recovery: total(PATHS.light_right), damage: MOVES.light_right.damage, reach: MOVES.light_right.reach, arc: RULES.guardArc, reaction: MOVES.light_right.stagger, death: RULES.death } as const;
const clipSpec = (w: Weapon, path: PathId, move: MoveId) => ({ contact: w.paths[path].windup, recovery: total(w.paths[path]), damage: w.moves[move].damage, reach: w.moves[move].reach, cost: w.moves[move].stamina, source: w.paths[path].source });
// Clip keys: the renderer plays one role per key (characters.ts maps a role to the weapon's clip); a left cut plays the Return role whether or not it was chained.
// `source` is where the authored clip's contact key sits, so the swing eases to it at the simulation's contact tick.
export const attackSpecs = (weapon: WeaponId) => { const w = weaponOf(weapon); return { light: clipSpec(w, 'light_right', 'light_right'), return: clipSpec(w, 'light_left_chain', 'light_left'), heavy: clipSpec(w, 'heavy_overhead', 'heavy_overhead'), riposte: clipSpec(w, 'riposte', 'riposte'), thrust: clipSpec(w, 'thrust', 'thrust') }; };
export const ATTACKS = attackSpecs('longsword');
export type Attack = keyof typeof ATTACKS;

export type LegacyPhase = 'sheathed' | 'draw' | 'ready' | 'attack' | 'roll' | 'backstep' | 'guard' | 'hurt' | 'dead' | 'kick';
export type Result = 'none' | 'hit' | 'miss' | 'hurt' | 'blocked' | 'parried' | 'dodged' | 'broken' | 'kicked' | 'postureBroken' | 'enemyBlocked' | 'enemyBroken' | 'enemyParried' | 'enemyDodged' | 'enemyKicked' | 'enemyPostureBroken';
// Practice = the duel plus a read-only view in the vocabulary the renderer and HUD already speak. Never write to the view.
export type Practice = {
  duel: Duel; ai: AiState; events: CombatEvent[]; result: Result; resultAge: number; resultDamage: number; resultStamina: number; resultPerfect: boolean; resultCounter: boolean; resultStop: boolean; resultTrip: boolean; resultWalled: boolean;
  maxStamina: number; enemyMaxStamina: number; legWound: boolean;   // attrition: the bars' ceilings this duel and a slowing leg wound
  fighter: State; enemy: State; finish: Finish | null;
  phase: LegacyPhase; age: number; attack: Attack; chain: number; threat: boolean; threatMove: MoveId | null;
  enemyPhase: LegacyPhase; enemyAge: number; enemyAttacking: boolean; enemyMode: AiMode;
  health: number; playerHealth: number; stamina: number; enemyStamina: number; exhausted: boolean; posture: number; enemyPosture: number;
  wound: number; enemyWound: number; woundSite: HitLocation; enemyWoundSite: HitLocation; reaction: number;
};
// The thrust plays its own role; a chained thrust rides the riposte path (the second thrust, from half-withdrawn), so it plays the riposte's clip.
const clipOf = (f: Fighter): Attack => { const move = f.lastMove; return move === 'light_left' ? 'return' : move === 'heavy_overhead' || move === 'heavy_riposte' || move === 'heavy_counter' || move === 'critical' ? 'heavy' : move === 'riposte' || (move === 'thrust' && f.chained) ? 'riposte' : move === 'thrust' ? 'thrust' : 'light'; };
const legacyPhase = (f: Fighter): LegacyPhase => f.phase === 'attack' && f.move === 'kick' ? 'kick' : f.phase;
const RESULTS: Partial<Record<CombatEvent['type'], [Result, Result]>> = { PostureBroken: ['enemyPostureBroken', 'postureBroken'], Hit: ['hit', 'hurt'], AttackMissed: ['miss', 'dodged'], Blocked: ['blocked', 'enemyBlocked'], Parried: ['parried', 'enemyParried'], GuardBroken: ['enemyBroken', 'broken'], Dodged: ['dodged', 'enemyDodged'] };
export function project(duel: Duel, ai: AiState, previous?: Practice): Practice {
  const [p, w] = duel.fighters;
  let result: Result = previous?.result ?? 'none', resultAge = previous ? Math.min(120, previous.resultAge + 1) : 0, resultDamage = previous?.resultDamage ?? 0, resultStamina = previous?.resultStamina ?? 0, resultPerfect = previous?.resultPerfect ?? false, resultCounter = previous?.resultCounter ?? false, resultStop = previous?.resultStop ?? false, resultTrip = previous?.resultTrip ?? false, resultWalled = previous?.resultWalled ?? false;
  for (const event of duel.events) {
    const pair = RESULTS[event.type];
    if (!pair) continue;
    result = event.type === 'Hit' && event.move === 'kick' ? (event.actor === 0 ? 'kicked' : 'enemyKicked') : pair[event.actor];
    resultAge = 0; resultDamage = event.damage ?? 0; resultStamina = event.stamina ?? 0; resultPerfect = !!event.perfect; resultCounter = !!event.counter || !!event.rear; resultStop = !!event.stop; resultTrip = !!event.trip;   // the renderer keys on 'blocked'; perfection rides alongside
    resultWalled = duel.events.some(e => e.type === 'Staggered' && e.walled && e.actor === event.target);   // the blow drove them into the ring wall
  }
  const wardenTiming = w.phase === 'attack' ? timing(w) : null;
  return {
    duel, ai, events: duel.events, result, resultAge, resultDamage, resultStamina, resultPerfect, resultCounter, resultStop, resultTrip, resultWalled, maxStamina: p.maxStamina, enemyMaxStamina: w.maxStamina, legWound: p.legWound, fighter: p.body, enemy: w.body, finish: duel.finish,
    phase: legacyPhase(p), age: p.age, attack: clipOf(p), chain: p.chain,
    threat: w.phase === 'attack' && !w.landed && w.age < wardenTiming!.windup + wardenTiming!.active, threatMove: w.phase === 'attack' ? w.move : null,
    enemyPhase: legacyPhase(w), enemyAge: w.age, enemyAttacking: w.phase === 'attack', enemyMode: w.phase === 'guard' ? 'guard' : ai.mode,
    health: w.health, playerHealth: p.health, stamina: p.stamina, enemyStamina: w.stamina, exhausted: p.exhausted, posture: p.posture, enemyPosture: w.posture,
    wound: p.wound, enemyWound: w.wound, woundSite: p.woundSite, enemyWoundSite: w.woundSite,
    reaction: w.phase === 'hurt' || w.phase === 'dead' ? Math.max(0, w.stun - w.age) : 0,
  };
}
export const initialPractice = (seed = 731): Practice => project(initialDuel(), initialAi(seed));
export function stepPractice(current: Practice, intent: Intent, profile: AiProfile = PROFILES.normal): Practice {
  const warden = decide(current.duel, 1, current.ai, profile);
  return project(stepDuel(current.duel, [intent, warden.intent]), warden.ai, current);
}
export const canStrike = (s: Practice): boolean => legal(s.duel.fighters[0], 'light');
export const canDefend = (s: Practice): boolean => s.health > 0 && s.playerHealth > 0 && (s.phase === 'ready' || s.phase === 'guard');
// Controls stay responsive while busy: an action is accepted now, or queued in the last ticks of a committed action.
export const accepts = (s: Practice, action: Action): boolean => s.health > 0 && s.playerHealth > 0 && (legal(s.duel.fighters[0], action) || (inBufferWindow(s.duel.fighters[0]) && !(action === 'heavy' && s.phase === 'draw')));

// Presentation helper: which clip, how far through it, and where its contact pose sits. Animation observes; it never decides.
export type Pose = Exclude<LegacyPhase, 'hurt' | 'dead' | 'backstep'> | 'hit' | 'death';
export function actorPose(s: Practice, side: Side): { pose: Pose; progress: number; attack: Attack; contact: number } {
  const f = s.duel.fighters[side], phase = legacyPhase(f), attack = clipOf(f), specs = attackSpecs(f.weapon);
  const pose: Pose = phase === 'dead' ? 'death' : phase === 'hurt' ? 'hit' : phase === 'backstep' ? 'ready' : phase;   // a backstep is armed footwork; travel direction drives the walk
  const duration = phase === 'attack' || phase === 'kick' ? total(timing(f)) : phase === 'draw' ? RULES.draw : phase === 'roll' ? RULES.roll : phase === 'hurt' || phase === 'dead' ? f.stun : 1;
  const contact = phase === 'attack' || phase === 'kick' ? timing(f).windup / duration : specs[attack].contact / specs[attack].recovery;
  return { pose, progress: Math.min(1, f.age / Math.max(1, duration)), attack, contact };
}

const NAMES: Record<MoveId, string> = { light_right: 'right cut', light_left: 'left cut', heavy_overhead: 'heavy', thrust: 'thrust', riposte: 'riposte', heavy_riposte: 'heavy riposte', critical: 'critical', heavy_counter: 'guard counter', kick: 'kick' };
export function practiceHint(s: Practice): string {
  const me = s.duel.fighters[0];
  if (s.finish?.draw) return 'You both fell. Rematch?';
  if (!s.playerHealth) return 'You fell. Rematch and try another defence.';
  if (!s.health) return 'Warden defeated. Ready for a rematch?';
  if (s.phase === 'sheathed') return 'Draw your sword. The warden will counterattack.';
  if (s.phase === 'draw') return 'Drawing longsword…';
  if (me.critical > 0 && me.phase !== 'attack') return 'Posture broken — Heavy for the critical!';
  if (me.phase === 'attack' && me.charge) return !movesOf(me)[me.move!].charges ? 'Chambered · release to strike · back to centre to feint' : me.charged ? 'Charged · breaks a guard' : 'Charging… keep holding';
  if (s.threat) return s.threatMove === 'heavy_overhead' ? (s.duel.fighters[1].charge ? 'Incoming strike — charged heavy: a guard will break · roll or parry the release!' : 'Incoming strike — heavy: guard takes chip · parry or roll') : s.threatMove === 'thrust' ? 'Incoming strike — thrust: fast and long · block it or step aside' : 'Incoming strike — roll or time your guard!';
  if (me.exhausted) return 'Exhausted · walk it off until your stamina returns';
  if (s.enemyMode === 'guard' && !s.reaction && !s.enemyAttacking) return 'Warden guarding · heavy or close-range kick';
  if (s.phase === 'ready' && s.chain > 0) return 'Light again to follow through · or reset your footing';
  if (s.result !== 'none' && s.resultAge < 120) {
    const name = me.chained ? 'follow-up' : NAMES[me.lastMove ?? 'light_right'];
    return { kicked: 'Kick connected · press the opening', hit: `${s.resultStop ? 'Stop-hit' : s.resultCounter ? 'Counter' : 'Clean'} ${name} hit · −${s.resultDamage}${s.resultWalled ? ' · into the wall' : ''}`, miss: 'Miss — close the distance and face the warden.', hurt: `${s.resultStop ? 'Stop-hit — you walked onto the point' : s.resultTrip ? 'Swept — a low blade trips a roll' : s.resultCounter ? 'Countered' : 'Hit taken'} · −${s.resultDamage}${s.resultWalled ? ' · pinned on the wall' : ''}`, blocked: `${s.resultPerfect ? 'Perfect block' : 'Blocked'} · −${Math.round(s.resultStamina)} stamina${s.resultDamage ? ` · −${s.resultDamage} chip` : ''}${me.counterWindow > 0 ? ' · heavy to counter' : ''}`, parried: 'Parried! The warden is open.', dodged: 'Evaded!', broken: 'Guard broken · a charged heavy or kick goes through a guard', enemyBlocked: 'Warden blocked · use a heavy attack or change angle', enemyBroken: 'Guard shattered · press the opening', enemyParried: 'Your strike was turned aside — recover!', enemyDodged: 'The warden rolled clear.', enemyKicked: `Kicked · −${s.resultDamage}`, postureBroken: 'Your posture broke — brace for the critical', enemyPostureBroken: 'Warden staggering · Heavy for the critical!' }[s.result];
  }
  if (s.phase === 'guard') return me.parrying ? 'Parry window open' : 'Guarding · release to recover stamina';
  if (me.exposed) return 'Parry missed · guard down for a moment';
  if (s.posture >= RULES.posture.max * .7) return 'Your posture is breaking · back off or parry';
  if (s.enemyPosture >= RULES.posture.max * .7) return 'Warden near a posture break · keep the pressure on';
  return 'Hold guard to block · tap just before impact to parry';
}

// Debug overlay text: developer readout of the simulation, never a source of truth for presentation or rules.
export function describe(s: Practice, difficulty = 'normal'): string {
  const bar = (f: Fighter) => {
    if (f.phase !== 'attack' || !f.move) return f.phase === 'hurt' ? `hurt ${f.age}/${f.stun}` : f.phase === 'guard' ? `guard ${f.age}${f.age < RULES.parry ? ' PARRY' : ''}` : f.phase === 'roll' ? `roll ${f.age}/${RULES.roll}${f.age >= RULES.safeStart && f.age <= RULES.safeEnd ? ' safe' : ''}` : `${f.phase} ${f.age}`;
    const t = timing(f), cells: string[] = Array.from({ length: total(t) }, (_, k) => k < t.windup ? '·' : k < t.windup + t.active ? '#' : '-');
    if (f.age < cells.length) cells[f.age] = '|';
    return `${f.move}${f.chained ? '+' : ''} ${f.age}/${total(t)} ${cells.join('')}${f.landed ? ' landed' : ''}${f.charge ? ` charge ${f.charge}${f.charged ? ' CHARGED' : ''}` : ''}`;
  };
  const fighter = (name: string, f: Fighter) => `${name}: hp ${f.health} st ${f.stamina.toFixed(0)}${f.exhausted ? ' EXH' : ''} po ${f.posture.toFixed(0)}${f.critical ? ` CRIT ${f.critical}` : ''} rest ${f.rest} wound ${f.wound}\n  ${bar(f)}\n  chain ${f.chain} punish ${f.punish} parryCd ${f.parryCooldown} buf ${f.buffer ? `${f.buffer.action}:${f.buffer.ttl}` : '-'} pos ${f.body.x.toFixed(2)},${f.body.z.toFixed(2)} hd ${f.body.heading.toFixed(2)}`;
  const [p, w] = s.duel.fighters;
  const scores = Object.entries(s.ai.scores).map(([k, v]) => `${k}=${typeof v === 'number' ? v.toFixed(2) : v}`).join(' ');
  const h = s.ai.habits, reads = Object.entries(readOpponent(h)).filter(([, on]) => on).map(([k]) => k).join(',') || '-';
  const habits = `habits g${h.ticks ? Math.round(h.guard / h.ticks * 100) : 0}% parry ${h.parries}/${h.attacks} roll ${h.rolls}/${h.attacks} L${h.lights} H${h.heavies} T${h.thrusts} reads ${reads}`;
  const recent = s.events.map(e => `${e.type}${e.move ? `(${e.move})` : e.action ? `(${e.action})` : ''}${e.damage ? ` -${e.damage}` : ''}`).join(' ');
  return `tick ${s.duel.tick} gap ${Math.hypot(p.body.x - w.body.x, p.body.z - w.body.z).toFixed(2)}\n${fighter('you', p)}\n${fighter('warden', w)}\nai ${difficulty}: mode ${s.ai.mode} plan ${s.ai.plan ?? '-'} wait ${s.ai.wait} decide ${s.ai.decision} ${scores}\n${habits}\nresult ${s.result} ${s.resultAge}${recent ? `\nevents ${recent}` : ''}`;
}
