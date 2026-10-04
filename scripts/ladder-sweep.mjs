#!/usr/bin/env node
// Ladder sweep: scripted players against every opponent at every ladder level, on the headless simulation (no browser, no GPU, ~250k ticks/s).
// It exists to answer "how does the difficulty actually move up the 46-level ladder, and is any opponent a wall or a pushover?" in minutes.
//
//   node scripts/ladder-sweep.mjs matrix [--n=40] [--levels=1,18]                       every opponent x every bot at the given levels
//   (recipes marked `hold: true` in roster.ts are not in the game and are skipped; pass --include-held to add them, or name one in --opponents)
//   node scripts/ladder-sweep.mjs curve  [--n=60] [--opponents=veteran,pitborn] [--bots=masher,blocker,skilled] [--levels=...]
//
// Fights are built the way the game builds them (combat.ts initialPractice over moves.ts opponentAt, stepped under moves.ts profileAt), against the
// default longsword player, no skill, no specials. Seeds are fixed, so a re-run on the same tree prints the same table: diff two trees' output to see
// what a tuning change did to the curve.
//
// What it is NOT: tests/strategies.ts + tests/battery.test.ts are the gate (simple strategies must not dominate the Veteran at normal/hard); this is the
// survey across the whole ladder and roster. The bots read the simulation state directly, so they are tighter than a thumb; a human is neither as
// precise nor as bad as `masher`. Read a win rate as "what this strategy can do", never as how the fight feels (phone playtests own that).
import { OPPONENTS, MOVES, canStrike, initialPractice, stepPractice } from '../src/combat.ts';
import { RULES, opponentAt, profileAt } from '../src/moves.ts';
import { mirror, movesOf, timing } from '../src/duel.ts';
import { isHeld } from '../src/roster.ts';

const mk = (z = 0, action = null, guard = false) => ({ move: { x: 0, z, yaw: 0, run: false }, action, guard, lock: true });
const dist = (s) => Math.hypot(s.fighter.x - s.enemy.x, s.fighter.z - s.enemy.z);
const REACH = MOVES.light_right.reach;
const me = (s) => s.duel.fighters[0];
const foe = (s) => s.duel.fighters[1];
const foeMove = (s) => (foe(s).move ? movesOf(foe(s))[foe(s).move] : null);
const untilContact = (s) => timing(foe(s)).windup - foe(s).age;   // ticks until the opponent's blow lands (negative once it is active)
const incoming = (s) => s.threat && dist(s) < 3 && foeMove(s) !== null;

const start = (s) => (s.phase === 'sheathed' ? mk(0, 'light') : null);
const approach = (s) => (dist(s) > REACH - 0.15 ? mk(-1) : null);
const cut = (s, reserve) => approach(s) ?? (canStrike(s) && s.stamina >= reserve ? mk(0, 'light') : mk());
const free = (s) => { const f = foe(s); return dist(s) < REACH && (f.phase === 'hurt' || f.exhausted || (f.phase === 'attack' && f.landed) || (f.phase === 'attack' && f.age > timing(f).windup + timing(f).active + 4)); };
const punish = (s) => (me(s).punish > 0 || me(s).counterWindow > 0) && canStrike(s);
const offense = (s, reserve) => (punish(s) ? mk(0, s.stamina >= 35 ? 'heavy' : 'light') : free(s) && canStrike(s) ? mk(0, 'light') : cut(s, reserve));
const covered = (s) => ({ ...mk(0, null, true), guardDirection: mirror(foeMove(s).direction) });   // the directional guard covers ONE side: the mirror of the blow's
const parry = (s, lead) => {
  const m = foeMove(s);
  if (!m || !incoming(s) || !m.parryable || me(s).parryCooldown !== 0 || !['ready', 'guard'].includes(me(s).phase)) return null;
  const t = untilContact(s);
  return t <= lead && t >= 1 ? { ...mk(0, 'parry', true), guardDirection: mirror(m.direction) } : null;
};
const roll = (s, lead) => (!foeMove(s) || !incoming(s) || s.stamina < RULES.rollCost ? null : untilContact(s) <= lead && untilContact(s) >= RULES.safeStart ? mk(0, 'dodge') : null);

export const BOTS = {
  // does nothing after the draw: what the opponent does to a bystander
  idle: (s) => start(s) ?? mk(),
  // walks in and cuts whenever it can afford to; never defends
  masher: (s) => start(s) ?? cut(s, 25),
  // holds the covering side of the guard against every blow, punishes whiffs and recoveries; never parries or rolls
  blocker: (s) => start(s) ?? (incoming(s) && foeMove(s).parryable !== false ? covered(s) : null) ?? offense(s, 50),
  // parries what is parryable inside the 10-tick window, rolls what is not (heavies, kicks) at the safe ticks, else guards the side; punishes
  skilled: (s) => start(s) ?? parry(s, 5) ?? (foeMove(s) && !foeMove(s).parryable ? roll(s, 14) : null) ?? (incoming(s) ? covered(s) : null) ?? offense(s, 40),
  // rolls every blow at the safe ticks, punishes the recovery
  rollonly: (s) => start(s) ?? roll(s, 14) ?? offense(s, 40),
};

export function fight(bot, id, level, seed, cap = 7200) {
  const profile = profileAt(OPPONENTS[id], level);
  let s = initialPractice(seed, opponentAt(OPPONENTS[id], level));
  let t = 0;
  while (t < cap && s.playerHealth > 0 && s.health > 0) { s = stepPractice(s, bot(s), profile); t++; }
  return { won: s.health <= 0 && s.playerHealth > 0, lost: s.playerHealth <= 0 && s.health > 0, ticks: t, hp: s.playerHealth };
}
const winRate = (bot, id, level, n) => { let w = 0; for (let k = 1; k <= n; k++) if (fight(bot, id, level, k * 104729).won) w++; return w / n; };

const arg = (name, fallback) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback;
const list = (name, fallback) => arg(name, fallback).split(',').filter(Boolean);
const mode = process.argv[2];
const roster = Object.keys(OPPONENTS).filter((id) => process.argv.includes('--include-held') || !isHeld(id));
const n = Number(arg('n', mode === 'curve' ? 60 : 40));
const bots = list('bots', mode === 'curve' ? 'masher,blocker,skilled' : Object.keys(BOTS).join(','));
for (const b of bots) if (!BOTS[b]) { console.error(`unknown bot "${b}" (have ${Object.keys(BOTS).join(', ')})`); process.exit(2); }

if (mode === 'matrix') {
  for (const level of list('levels', '1,18').map(Number)) {
    console.log(`\n=== ladder level ${level} (1 Recruit, 6 easy, 18 normal, 46 Origin) · ${n} fights per cell · win% / mean seconds ===`);
    console.log('opponent'.padEnd(14) + bots.map((b) => b.padStart(14)).join(''));
    for (const id of roster) {
      let row = id.padEnd(14);
      for (const b of bots) { let w = 0, ticks = 0; for (let k = 1; k <= n; k++) { const r = fight(BOTS[b], id, level, k * 7919); if (r.won) w++; ticks += r.ticks; } row += `${Math.round((100 * w) / n)}% ${(ticks / n / 60).toFixed(0)}s`.padStart(14); }
      console.log(row);
    }
  }
} else if (mode === 'curve') {
  const levels = list('levels', '1,6,10,11,12,13,14,16,18,24,32,46').map(Number);
  for (const id of list('opponents', 'veteran,pitborn,executioner,goblin')) {
    if (!OPPONENTS[id]) { console.error(`unknown opponent "${id}" (have ${Object.keys(OPPONENTS).join(', ')})`); process.exit(2); }
    console.log(`\n${id}: win% by ladder level (${n} fights per cell)`);
    console.log('level'.padEnd(8) + bots.map((b) => b.padStart(10)).join(''));
    for (const level of levels) console.log(String(level).padEnd(8) + bots.map((b) => `${Math.round(100 * winRate(BOTS[b], id, level, n))}%`.padStart(10)).join(''));
  }
} else {
  console.error('usage: node scripts/ladder-sweep.mjs matrix|curve [--n=N] [--levels=1,18,46] [--opponents=veteran,...] [--bots=masher,blocker,skilled] [--include-held]');
  process.exit(2);
}
