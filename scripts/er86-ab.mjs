// RV86 fairness A/B (Elden Ring light and thrust timings): one side per run, ER86=0 (old timings) or ER86=1 (new), through the preload so the same tree and the same seeds fight both.
//   ER86=0 node --import ./scripts/lib/er86-era.mjs scripts/er86-ab.mjs out-old.json [--seeds 24] [--weapons knife,longsword,...]
//   ER86=1 node --import ./scripts/lib/er86-era.mjs scripts/er86-ab.mjs out-new.json
//   node scripts/er86-compare.mjs out-old.json out-new.json
// Two tables: `fair` = the player weapon battery (tests/strategies.ts, the same scripted strategies, 24 seeds, every ladder rung at normal and hard; wins / losses / stalls / untouched / blows taken and landed), and
// `whiff` = per weapon the swings started and the swings that found nothing (AttackStarted / AttackMissed events) for the PLAYER's light and thrust, and for the WARDEN's, over light spam, thrust from range and a first-timer.
/* global process, console */
import fs from 'node:fs';
import { LADDER } from '../src/ladder.ts';
import { OPPONENTS, PLAYER_WEAPONS } from '../src/fight/moves.ts';
import { decide, initialAi } from '../src/fight/ai.ts';
import { stepDuel } from '../src/fight/duel.ts';
import { STRATEGIES, arena, battery } from '../tests/strategies.ts';
import { setLateNotice } from '../src/fight/play-radius.ts';
import { setStab } from '../src/fight/stab-rule.ts';

setStab(true); setLateNotice(true);   // live-era flags, as scripts/ladder-sweep.mjs
const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const out = process.argv[2], seeds = Number(arg('seeds', 24)), weapons = arg('weapons', 'longsword,knife,gladius,cleaver,maul,warhammer,scythe,estoc,trident').split(',').filter((w) => PLAYER_WEAPONS.includes(w));
const result = { era: process.env.ER86 === '0' ? 'old' : 'new', seeds, fair: [], whiff: [] };
for (const weapon of weapons) {
  for (const rung of LADDER) for (const level of ['normal', 'hard']) {
    const rows = battery(level, seeds, 7200, OPPONENTS[rung.id], undefined, weapon);
    for (const [strategy, r] of Object.entries(rows)) result.fair.push({ weapon, rung: rung.id, level, strategy, wins: r.wins, losses: r.losses, stalls: r.stalls, untouched: r.untouched, taken: r.taken, landed: r.landed });
  }
  for (const strategy of ['light spam', 'thrust from range']) for (const rung of LADDER.slice(0, 6)) {
    const o = OPPONENTS[rung.id], profile = o.profiles.normal;
    const t = { playerStarts: 0, playerMissed: 0, wardenStarts: 0, wardenMissed: 0 };
    for (let s = 1; s <= Math.min(seeds, 12); s++) {
      let d = arena(o, weapon), ai = initialAi((s * 2654435761) >>> 0);
      for (let i = 0; i < 3600 && !d.finish; i++) {
        const w = decide(d, 1, ai, profile); ai = w.ai; d = stepDuel(d, [STRATEGIES[strategy](d), w.intent]);
        for (const e of d.events) {
          const move = String(e.move ?? '');
          if (!/^(light|thrust)/.test(move)) continue;
          if (e.type === 'AttackStarted') t[e.actor === 0 ? 'playerStarts' : 'wardenStarts']++;
          else if (e.type === 'AttackMissed') t[e.actor === 0 ? 'playerMissed' : 'wardenMissed']++;
        }
      }
    }
    result.whiff.push({ weapon, rung: rung.id, strategy, ...t });
  }
  console.log(weapon, 'done');
}
fs.writeFileSync(out, JSON.stringify(result));
