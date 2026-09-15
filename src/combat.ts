import { decide, initialAi, type AiMode, type AiState } from './ai.ts';
import type { HitLocation } from './blade.ts';
import { inBufferWindow, initialDuel, legal, stepDuel, timing, type Action, type CombatEvent, type Duel, type Fighter, type Finish, type Intent, type Side } from './duel.ts';
import { MOVES, PATHS, PROFILES, RULES, total, type AiProfile, type MoveId, type PathId } from './moves.ts';
import type { State } from './sim.ts';
export { PROFILES, RULES, MOVES } from './moves.ts';
export type { Intent, Action, CombatEvent, Duel, Fighter } from './duel.ts';
export type { AiProfile } from './moves.ts';

// Legacy constant views. Presentation, the blade bake and older tests read these shapes; the simulation reads moves.ts.
export const SWORD = { draw: RULES.draw, contact: PATHS.light_right.windup, recovery: total(PATHS.light_right), damage: MOVES.light_right.damage, reach: MOVES.light_right.reach, arc: RULES.guardArc, reaction: MOVES.light_right.stagger, death: RULES.death } as const;
const clipSpec = (path: PathId, move: MoveId) => ({ contact: PATHS[path].windup, recovery: total(PATHS[path]), damage: MOVES[move].damage, reach: MOVES[move].reach, cost: MOVES[move].stamina });
// Clip keys: the rig has one authored clip per key; a left cut plays the Return clip whether or not it was chained.
export const ATTACKS = { light: clipSpec('light_right', 'light_right'), return: clipSpec('light_left_chain', 'light_left'), heavy: clipSpec('heavy_overhead', 'heavy_overhead'), riposte: clipSpec('riposte', 'riposte') } as const;
export type Attack = keyof typeof ATTACKS;

export type LegacyPhase = 'sheathed' | 'draw' | 'ready' | 'attack' | 'roll' | 'backstep' | 'guard' | 'hurt' | 'dead' | 'kick';
export type Result = 'none' | 'hit' | 'miss' | 'hurt' | 'blocked' | 'parried' | 'dodged' | 'broken' | 'kicked' | 'enemyBlocked' | 'enemyBroken' | 'enemyParried' | 'enemyDodged' | 'enemyKicked';
// Practice = the duel plus a read-only view in the vocabulary the renderer and HUD already speak. Never write to the view.
export type Practice = {
  duel: Duel; ai: AiState; events: CombatEvent[]; result: Result; resultAge: number; resultDamage: number; resultPerfect: boolean; resultCounter: boolean;
  fighter: State; enemy: State; finish: Finish | null;
  phase: LegacyPhase; age: number; attack: Attack; chain: number; threat: boolean; threatMove: MoveId | null;
  enemyPhase: LegacyPhase; enemyAge: number; enemyAttacking: boolean; enemyMode: AiMode;
  health: number; playerHealth: number; stamina: number; enemyStamina: number; exhausted: boolean;
  wound: number; enemyWound: number; woundSite: HitLocation; enemyWoundSite: HitLocation; reaction: number;
};
const clipOf = (move: MoveId | null): Attack => move === 'light_left' ? 'return' : move === 'heavy_overhead' || move === 'heavy_riposte' ? 'heavy' : move === 'riposte' ? 'riposte' : 'light';
const legacyPhase = (f: Fighter): LegacyPhase => f.phase === 'attack' && f.move === 'kick' ? 'kick' : f.phase;
const RESULTS: Partial<Record<CombatEvent['type'], [Result, Result]>> = { Hit: ['hit', 'hurt'], AttackMissed: ['miss', 'dodged'], Blocked: ['blocked', 'enemyBlocked'], Parried: ['parried', 'enemyParried'], GuardBroken: ['broken', 'enemyBroken'], Dodged: ['dodged', 'enemyDodged'] };
export function project(duel: Duel, ai: AiState, previous?: Practice): Practice {
  const [p, w] = duel.fighters;
  let result: Result = previous?.result ?? 'none', resultAge = previous ? Math.min(120, previous.resultAge + 1) : 0, resultDamage = previous?.resultDamage ?? 0, resultPerfect = previous?.resultPerfect ?? false, resultCounter = previous?.resultCounter ?? false;
  for (const event of duel.events) {
    const pair = RESULTS[event.type];
    if (!pair) continue;
    result = event.type === 'Hit' && event.move === 'kick' ? (event.actor === 0 ? 'kicked' : 'enemyKicked') : pair[event.actor];
    resultAge = 0; resultDamage = event.damage ?? event.stamina ?? 0; resultPerfect = !!event.perfect; resultCounter = !!event.counter || !!event.rear;   // the renderer keys on 'blocked'; perfection rides alongside
  }
  const wardenTiming = w.phase === 'attack' ? timing(w) : null;
  return {
    duel, ai, events: duel.events, result, resultAge, resultDamage, resultPerfect, resultCounter, fighter: p.body, enemy: w.body, finish: duel.finish,
    phase: legacyPhase(p), age: p.age, attack: clipOf(p.lastMove), chain: p.chain,
    threat: w.phase === 'attack' && !w.landed && w.age < wardenTiming!.windup + wardenTiming!.active, threatMove: w.phase === 'attack' ? w.move : null,
    enemyPhase: legacyPhase(w), enemyAge: w.age, enemyAttacking: w.phase === 'attack', enemyMode: w.phase === 'guard' ? 'guard' : ai.mode,
    health: w.health, playerHealth: p.health, stamina: p.stamina, enemyStamina: w.stamina, exhausted: p.exhausted,
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
  const f = s.duel.fighters[side], phase = legacyPhase(f), attack = clipOf(f.lastMove);
  const pose: Pose = phase === 'dead' ? 'death' : phase === 'hurt' ? 'hit' : phase === 'backstep' ? 'ready' : phase;   // a backstep is armed footwork; travel direction drives the walk
  const duration = phase === 'attack' || phase === 'kick' ? total(timing(f)) : phase === 'draw' ? RULES.draw : phase === 'roll' ? RULES.roll : phase === 'hurt' || phase === 'dead' ? f.stun : 1;
  const contact = phase === 'attack' || phase === 'kick' ? timing(f).windup / duration : ATTACKS[attack].contact / ATTACKS[attack].recovery;
  return { pose, progress: Math.min(1, f.age / Math.max(1, duration)), attack, contact };
}

const NAMES: Record<MoveId, string> = { light_right: 'right cut', light_left: 'left cut', heavy_overhead: 'heavy', riposte: 'riposte', heavy_riposte: 'heavy riposte', kick: 'kick' };
export function practiceHint(s: Practice): string {
  const me = s.duel.fighters[0];
  if (!s.playerHealth) return 'You fell. Rematch and try another defence.';
  if (!s.health) return 'Warden defeated. Ready for a rematch?';
  if (s.phase === 'sheathed') return 'Draw your sword. The warden will counterattack.';
  if (s.phase === 'draw') return 'Drawing longsword…';
  if (s.threat) return s.threatMove === 'heavy_overhead' ? 'Incoming strike — heavy: roll or time your guard!' : 'Incoming strike — roll or time your guard!';
  if (me.exhausted) return 'Exhausted · walk it off until your stamina returns';
  if (s.enemyMode === 'guard' && !s.reaction && !s.enemyAttacking) return 'Warden guarding · heavy or close-range kick';
  if (s.phase === 'ready' && s.chain > 0) return 'Light again to follow through · or reset your footing';
  if (s.result !== 'none' && s.resultAge < 120) {
    const name = me.chained ? 'follow-up' : NAMES[me.lastMove ?? 'light_right'];
    return { kicked: 'Kick connected · press the opening', hit: `${s.resultCounter ? 'Counter' : 'Clean'} ${name} hit · −${s.resultDamage}`, miss: 'Miss — close the distance and face the warden.', hurt: `${s.resultCounter ? 'Countered' : 'Hit taken'} · −${s.resultDamage}`, blocked: `${s.resultPerfect ? 'Perfect block' : 'Blocked'} · −${Math.round(s.resultDamage)} stamina`, parried: 'Parried! The warden is open.', dodged: 'Evaded!', broken: 'Guard broken · recover your stamina', enemyBlocked: 'Warden blocked · use a heavy attack or change angle', enemyBroken: 'Guard shattered · press the opening', enemyParried: 'Your strike was turned aside — recover!', enemyDodged: 'The warden rolled clear.', enemyKicked: `Kicked · −${s.resultDamage}` }[s.result];
  }
  if (s.phase === 'guard') return me.parrying ? 'Parry window open' : 'Guarding · release to recover stamina';
  if (me.exposed) return 'Parry missed · guard down for a moment';
  return 'Hold guard to block · tap just before impact to parry';
}

// Debug overlay text: developer readout of the simulation, never a source of truth for presentation or rules.
export function describe(s: Practice, difficulty = 'normal'): string {
  const bar = (f: Fighter) => {
    if (f.phase !== 'attack' || !f.move) return f.phase === 'hurt' ? `hurt ${f.age}/${f.stun}` : f.phase === 'guard' ? `guard ${f.age}${f.age < RULES.parry ? ' PARRY' : ''}` : f.phase === 'roll' ? `roll ${f.age}/${RULES.roll}${f.age >= RULES.safeStart && f.age <= RULES.safeEnd ? ' safe' : ''}` : `${f.phase} ${f.age}`;
    const t = timing(f), cells: string[] = Array.from({ length: total(t) }, (_, k) => k < t.windup ? '·' : k < t.windup + t.active ? '#' : '-');
    if (f.age < cells.length) cells[f.age] = '|';
    return `${f.move}${f.chained ? '+' : ''} ${f.age}/${total(t)} ${cells.join('')}${f.landed ? ' landed' : ''}`;
  };
  const fighter = (name: string, f: Fighter) => `${name}: hp ${f.health} st ${f.stamina.toFixed(0)}${f.exhausted ? ' EXH' : ''} rest ${f.rest} wound ${f.wound}\n  ${bar(f)}\n  chain ${f.chain} punish ${f.punish} parryCd ${f.parryCooldown} buf ${f.buffer ? `${f.buffer.action}:${f.buffer.ttl}` : '-'} pos ${f.body.x.toFixed(2)},${f.body.z.toFixed(2)} hd ${f.body.heading.toFixed(2)}`;
  const [p, w] = s.duel.fighters;
  const scores = Object.entries(s.ai.scores).map(([k, v]) => `${k}=${typeof v === 'number' ? v.toFixed(2) : v}`).join(' ');
  const recent = s.events.map(e => `${e.type}${e.move ? `(${e.move})` : e.action ? `(${e.action})` : ''}${e.damage ? ` -${e.damage}` : ''}`).join(' ');
  return `tick ${s.duel.tick} gap ${Math.hypot(p.body.x - w.body.x, p.body.z - w.body.z).toFixed(2)}\n${fighter('you', p)}\n${fighter('warden', w)}\nai ${difficulty}: mode ${s.ai.mode} plan ${s.ai.plan ?? '-'} wait ${s.ai.wait} decide ${s.ai.decision} ${scores}\nresult ${s.result} ${s.resultAge}${recent ? `\nevents ${recent}` : ''}`;
}
