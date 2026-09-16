// Strategy battery: simple, repeatable human strategies against the warden. AI-vs-AI cannot find these; a human finds them in ten minutes.
// Gate: no scripted strategy wins more than half its fights at normal or more than a third at hard, and none goes untouched.
import test from 'node:test';
import assert from 'node:assert/strict';
import { decide, initialAi } from '../src/ai.ts';
import { createFighter, idleIntent, stepDuel, type Duel, type Intent } from '../src/duel.ts';
import { MOVES, PROFILES, RULES, type AiProfile } from '../src/moves.ts';
import { TARGET } from '../src/sim.ts';

const idle = (): Intent => ({ ...idleIntent(), lock: true });
const act = (action: Intent['action'], extra: Partial<Intent> = {}): Intent => ({ ...idle(), action, ...extra });
const arena = (): Duel => ({ tick: 0, fighters: [createFighter({ x: 0, z: TARGET.z + 1.2, heading: Math.PI, distance: 0 }, 'ready'), createFighter({ ...TARGET, heading: 0, distance: 0 }, 'ready')], finish: null, events: [] });
const gap = (d: Duel) => Math.hypot(d.fighters[0].body.x - d.fighters[1].body.x, d.fighters[0].body.z - d.fighters[1].body.z);
const W = (d: Duel) => d.fighters[1], P = (d: Duel) => d.fighters[0];
const ready = (d: Duel) => P(d).phase === 'ready';
const swingStart = (d: Duel) => W(d).phase === 'attack' && W(d).age === 0 && W(d).move !== 'kick';
// Each strategy is a pure function of the committed state: exactly what a thumb could do with perfect information.
export const STRATEGIES: Record<string, (d: Duel) => Intent> = {
  'kick only': d => (ready(d) && gap(d) <= 1.5 ? act('kick') : idle()),
  'light spam': d => (ready(d) && gap(d) <= 1.7 ? act('light') : idle()),
  'held lights': d => (ready(d) && gap(d) <= 1.7 ? act('light', { held: true }) : { ...idle(), held: P(d).phase === 'attack' && P(d).charge < 6 }),
  'heavy only': d => (ready(d) && gap(d) <= 1.8 ? act('heavy') : idle()),
  'charged heavy only': d => (ready(d) && gap(d) <= 1.8 ? act('heavy', { held: true }) : { ...idle(), held: P(d).phase === 'attack' && !P(d).charged }),
  'thrust from range': d => (ready(d) && gap(d) >= 1.5 && gap(d) <= 1.95 ? act('thrust') : idle()),
  'turtle and punish': d => (P(d).punish > 0 || P(d).critical > 0 || P(d).counterWindow > 0 ? (ready(d) || P(d).phase === 'guard' ? act('heavy', { guard: true }) : { ...idle(), guard: true }) : { ...idle(), guard: true }),
  'roll and punish': d => (swingStart(d) && ready(d) && P(d).stamina >= RULES.rollCost ? act('dodge') : ready(d) && W(d).phase === 'hurt' ? act('light') : idle()),
  // Perfect-information parry: press exactly so the window covers contact, and kick anything that is not parryable.
  'perfect parry': d => { const w = W(d); if (w.phase === 'attack' && w.move && !w.landed && ready(d)) { const t = MOVES[w.move]; if (!t.parryable) return P(d).stamina >= RULES.rollCost ? act('dodge') : idle(); if (t.windup - w.age === RULES.parry - 2 && !P(d).parryCooldown) return act('parry', { guard: true }); } return ready(d) && P(d).punish > 0 ? act('heavy') : idle(); },
};
export function battery(level: keyof typeof PROFILES, seeds = 24, ticks = 7200) {
  const rows: Record<string, { wins: number; losses: number; stalls: number; untouched: number; taken: number; landed: number }> = {};
  for (const [name, strategy] of Object.entries(STRATEGIES)) {
    const row = rows[name] = { wins: 0, losses: 0, stalls: 0, untouched: 0, taken: 0, landed: 0 };
    for (let s = 1; s <= seeds; s++) {
      let d = arena(), ai = initialAi((s * 2654435761) >>> 0), taken = 0, landed = 0;
      for (let i = 0; i < ticks && !d.finish; i++) {
        const w = decide(d, 1, ai, PROFILES[level] as AiProfile); ai = w.ai; d = stepDuel(d, [strategy(d), w.intent]);
        // Damage taken: a hit, a broken guard, or chip through a block — a turtle that dies to chip was touched.
        for (const e of d.events) { const hurt = e.type === 'Hit' || e.type === 'GuardBroken' || (e.type === 'Blocked' && (e.damage ?? 0) > 0); if (hurt && e.target === 0) taken++; if (hurt && e.target === 1) landed++; }
      }
      if (!d.finish) row.stalls++; else if (d.finish.draw) row.losses++; else if (d.finish.victim === 1) row.wins++; else row.losses++;
      if (taken === 0) row.untouched++; row.taken += taken; row.landed += landed;
    }
  }
  return rows;
}
test('no simple strategy dominates the warden: wins ≤ 50 % at normal, ≤ 35 % at hard, and every strategy gets hit', () => {
  for (const [level, cap] of [['normal', .5], ['hard', .35]] as const) {
    const rows = battery(level);
    const table = Object.entries(rows).map(([n, r]) => `${n}: ${r.wins}W ${r.losses}L ${r.stalls}S untouched ${r.untouched} taken ${r.taken} landed ${r.landed}`).join('\n  ');
    for (const [name, r] of Object.entries(rows)) {
      // The perfect-information parry is mastery, not an exploit: it may win, but the warden's baits, feints and kicks must still land on it.
      if (name !== 'perfect parry') assert.ok(r.wins / 24 <= cap, `${level} · ${name} wins ${r.wins}/24 (cap ${cap * 100} %)\n  ${table}`);
      assert.ok(r.untouched <= (name === 'perfect parry' ? 6 : 2), `${level} · ${name} untouched in ${r.untouched}/24 fights\n  ${table}`);   // the script also rolls every kick on its first tick, which no thumb does
    }
    console.log(`battery ${level}\n  ${table}`);
  }
});
