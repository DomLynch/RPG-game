import './lib/era-on.ts';   // the LIVE rules: the band is a promise about the game players play
import test from 'node:test';
import assert from 'node:assert/strict';
import { creature, newWorld, player, stepCombat, type Input } from '../src/fight/world.ts';
import { rungSheet } from '../scripts/lib/rung-sheet.ts';

// Guards the Zone 1 bounty band (Strategy 2026-10-21: a named Zone 1 bounty is beaten by 25-40 % of Recruit heroes at the zone's entry level) against Pit-knight retunes.
// Hrungnir has NO combat row of his own: origins/region1/progression.json encounterForms opponent "knight" level 3 (his encounter has no one-health-bar flag; the "named" row in career-rules.json
// is a reward weight; the embers twist is an Origins flag Combat does not read, origins/encounters/encounters.test.ts), and zone1.row.json looks him up as "knight". So he fights as the PIT knight at
// level 3, and a Pit-knight retune (archetype-defs.json "knight", the knight's weapon rows, the level ladder) moves him silently. This runs the repo's balance instrument (scripts/kite-farm.ts `stand`:
// a stand-still hero who holds guard while the creature is in windup/active within 5 m and otherwise swings a light every 20 ticks; the creature spawns 7 m out; the hero is the Recruit starter at the
// creature's level, full plate at Recruit quality = no bonus) against the level-3 knight over fixed seeds. The sim is deterministic, so the count is exact: 2026-10-21, trunk 3ae8e79bd (K6q4), 64 seeds:
// 18 wins (28 %), 46 hero deaths (mean 68 s to kill). Embers caveat: the page's hazard (standing still for 2 s hurts) is not simulated here, so a stand-still hero in the live page does worse than this
// bot, and one who moves is unaffected.
const SEEDS = 64, LEVEL = 3, DT = 1 / 60, MAX_S = 180;
const swinging = (phase: string) => phase === 'windup' || phase === 'active';

function fight(seed: number): 'won' | 'died' | 'timeout' {
  const sheet = rungSheet(0, LEVEL, 'plate', true), a = seed * 0.37;
  let w = newWorld([player('hero', 0, 0, 0, LEVEL, null, { weapon: 'longsword', ...(sheet ? { sheet } : {}) }), creature('c0', 'knight', Math.sin(a) * 7, Math.cos(a) * 7, a + Math.PI, LEVEL)]);
  for (let k = 0; k < MAX_S / DT; k++) {
    const h = w.fighters[0]!, c = w.fighters.find((f) => f.id === 'c0')!;
    const input: Input = swinging(c.phase) && Math.hypot(h.x - c.x, h.z - c.z) < 5 ? { x: 0, z: 0, guard: true } : { x: 0, z: 0, attack: k % 20 === 0 ? 'light' : null };
    const res = stepCombat(w, { hero: input }, DT); w = res.world;
    for (const e of res.events) { if (e.type === 'Died' && e.id === 'c0') return 'won'; if (e.type === 'Died' && e.id.startsWith('hero')) return 'died'; }
  }
  return 'timeout';
}

test('Hrungnir (the Pit knight at level 3) is beaten by 25-40 % of Recruit heroes on the live rules: the Zone 1 bounty band', () => {
  const results = Array.from({ length: SEEDS }, (_, i) => fight(i + 1)), won = results.filter((r) => r === 'won').length, died = results.filter((r) => r === 'died').length;
  console.log(`hrungnir-band: ${won}/${SEEDS} wins (${Math.round((100 * won) / SEEDS)} %), ${died} hero deaths, ${SEEDS - won - died} timeouts`);
  assert.ok(won >= 0.25 * SEEDS && won <= 0.4 * SEEDS, `Hrungnir's hero win rate left the 25-40 % band: ${won}/${SEEDS}. A Pit-knight retune (knight archetype, weapon rows, level ladder) moved the Zone 1 bounty; tune the knight back, or give Hrungnir his own opponent row, or have Strategy re-rule the band.`);
});
