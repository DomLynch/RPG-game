// The cross-engine determinism fixture (docs/duel-architecture.md §2.3): seeded warden-vs-warden PvP duels, every weapon on both sides,
// each folded into one fingerprint chain. Node (tests/net-determinism.test.ts) and each browser engine (scripts/net-engines-check.mjs:
// Chromium and WebKit on CI, a phone through the same module) must return identical chains — zero tolerance, no "close enough".
// Imported by nothing in the game.
import { decide, initialAi, type AiState } from '../ai.ts';
import { idleIntent, stepDuel, type Duel, type Intent, type Side } from '../duel.ts';
import { PLAYER_WEAPONS, PROFILES } from '../moves.ts';
import { quantizeIntent } from '../record.ts';
import { fnv64, hashDuel, NET, pvpDuel } from './rollback.ts';

export type Chain = { fight: number; tick: number; finish: string; chain: string };

// `trace`: every tick's fingerprint as well, so a differing fight names its first differing tick.
export function fightChain(fight: number, ticks = 3600, trace?: string[], states?: Map<number, string>): Chain {
  const w = PLAYER_WEAPONS, a = w[fight % w.length], b = w[Math.floor(fight / w.length) % w.length];
  let duel: Duel = pvpDuel({ weapon: a, skill: fight % 3 === 0 ? 'pommel' : null }, { weapon: b, skill: null });
  const ai: [AiState, AiState] = [initialAi(fight * 2 + 1), initialAi(fight * 2 + 2)];
  let chain = '';
  const intent = (side: Side): Intent => {
    if (duel.fighters[side].phase === 'sheathed') return { ...idleIntent(), action: 'light' };
    const d = decide(duel, side, ai[side], PROFILES.normal); ai[side] = d.ai; return quantizeIntent(d.intent);   // the wire's bits
  };
  // To the finish plus two seconds (a draw or a late kill still steps), or `ticks` for a fight nobody wins.
  let end = ticks;
  for (let t = 1; t <= end; t++) {
    duel = stepDuel(duel, [intent(0), intent(1)]);
    if (duel.finish && end === ticks) end = Math.min(ticks, t + 120);
    if (trace) trace.push(hashDuel(duel));
    if (states?.has(t)) states.set(t, JSON.stringify({ f: duel.fighters, x: duel.finish }));
    if (t % NET.hashEvery === 0) chain = fnv64(chain + hashDuel(duel));
  }
  return { fight, tick: duel.tick, finish: JSON.stringify(duel.finish), chain };
}

export const fixtureChains = (fights: number, ticks = 3600): Chain[] => Array.from({ length: fights }, (_, i) => fightChain(i, ticks));
export const fightTrace = (fight: number, ticks = 3600): string[] => { const trace: string[] = []; fightChain(fight, ticks, trace); return trace; };
// The state at one tick, for naming the field that differs.
export const fightStateAt = (fight: number, tick: number): string => { const states = new Map([[tick, '']]); fightChain(fight, tick, undefined, states); return states.get(tick)!; };
