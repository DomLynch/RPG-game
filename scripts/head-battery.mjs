// Head-region evidence battery (combat lane, 2026-09-18). Answers artifacts/finishers/REQUESTS.md: can any shipped move land
// `head` organically? Two instruments, both deterministic and seeded:
//   1. Static grid — every weapon × every baked path × distance 0.85–1.90 m, the exact registering rule the duel uses
//      (bladeImpact over the move's ACTIVE window only, first sweep sample inside the 0.31·k tube decides the region).
//   2. AI battery — seeded AI-vs-AI duels (the same decide/stepDuel entry points as the tests), Hit/GuardBroken/Killed
//      locations tallied per move, mirroring the finishers lane's 24-duel setup with the weapons isolated one at a time.
// Run from the repo root: node scripts/head-battery.mjs  (writes artifacts/combat/head-region-evidence.json)
import fs from 'node:fs/promises';
import { decide, initialAi } from '../src/ai.ts';
import { bladeImpact } from '../src/blade.ts';
import { bladePaths } from '../src/blade-paths.ts';
import { createFighter, opponentFighter, stepDuel } from '../src/duel.ts';
import { OPPONENTS, PATHS, PROFILES, WEAPONS } from '../src/moves.ts';
import { TARGET } from '../src/sim.ts';

const body = (x, z, heading) => ({ x, z, heading, distance: 0 });
const at = (d) => body(0, d, Math.PI), df = () => body(0, 0, 0);

// ── Instrument 1: the static grid, judged by the duel's registering rule (active window only, first contact wins) ──
function grid() {
  const rows = [];
  for (const [weapon, kinds] of Object.entries(bladePaths)) {
    for (const [kind, frames] of Object.entries(kinds)) {
      const spec = PATHS[kind];
      if (!spec) continue;   // death/finisher clips are not combat paths
      const tally = { head: 0, torso: 0, legs: 0, none: 0 };
      const byDistance = {};
      for (let d = 85; d <= 190; d += 5) {
        let first = null;
        for (let age = spec.windup; age < spec.windup + spec.active; age++) {
          first = bladeImpact(weapon, kind, age - 1, age, at(d / 100), at(d / 100), df(), df(), 1);
          if (first) break;
        }
        tally[first ?? 'none']++;
        byDistance[(d / 100).toFixed(2)] = first ?? 'none';
      }
      rows.push({ weapon, kind, tally, byDistance });
    }
  }
  return rows;
}

// ── Instrument 2: seeded AI-vs-AI duels, locations tallied per move for each side ──
function duelBattery(weapon, seeds = 24, ticks = 7200) {
  const tally = {};   // move -> { head, torso, legs, kills }
  const note = (move, location, kill) => {
    const row = tally[move] ??= { head: 0, torso: 0, legs: 0, kills: 0 };
    if (location) row[location]++;
    if (kill) row.kills++;
  };
  for (let s = 1; s <= seeds; s++) {
    let d = {
      tick: 0,
      fighters: [createFighter({ x: 0, z: TARGET.z + 1.2, heading: Math.PI, distance: 0 }, 'ready', weapon), opponentFighter(OPPONENTS.veteran, { ...TARGET, heading: 0, distance: 0 })],
      finish: null, events: [],
    };
    let a = initialAi(((s * 2654435761) >>> 0) ^ 0x9e3779b9), b = initialAi((s * 2654435761) >>> 0);
    for (let i = 0; i < ticks && !d.finish; i++) {
      const x = decide(d, 0, a, PROFILES.normal), y = decide(d, 1, b, OPPONENTS.veteran.profiles.normal);
      a = x.ai; b = y.ai; d = stepDuel(d, [x.intent, y.intent]);
      for (const e of d.events) {
        if (e.actor !== 0 || !e.move) continue;
        if (e.type === 'Hit' || e.type === 'GuardBroken') note(e.move, e.location, false);
        if (e.type === 'Killed') note(e.move, e.location, true);
      }
    }
  }
  return tally;
}

const gridRows = grid();
const ai = { longsword: duelBattery('longsword'), cleaver: duelBattery('cleaver') };
const summary = {
  grid: gridRows.map(({ weapon, kind, tally }) => `${weapon}/${kind}: head ${tally.head}, torso ${tally.torso}, legs ${tally.legs}, out-of-range ${tally.none}`),
  ai,
};
console.log('STATIC GRID (registering rule, active window, distances 0.85–1.90 m)\n  ' + summary.grid.join('\n  '));
console.log('\nAI BATTERY (24 seeds each, side 0 weapon isolated, Veteran answers)\n  longsword: ' + JSON.stringify(ai.longsword) + '\n  cleaver:   ' + JSON.stringify(ai.cleaver));
await fs.mkdir('artifacts/combat', { recursive: true });
await fs.writeFile('artifacts/combat/head-region-evidence.json', JSON.stringify({ generated: '2026-09-18', grid: gridRows, ai }, null, 2));
console.log('\nwrote artifacts/combat/head-region-evidence.json');
