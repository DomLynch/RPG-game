// Defensive stance trim (Strategy 2026-10-08: Defensive lifts win rate +8-16 pts at L6+; trim it to within +-5 of the no-stance baseline at L6+, Balanced untouched). The SAME scripted players as ladder-sweep.mjs,
// every live opponent at each level, the baseline once and Defensive once per VARIANT of its numbers (src/stance.ts STANCES.defensive is patched in memory; nothing on disk changes). Prints the pooled and per-bot
// mean win % and the delta to baseline, plus the largest single-cell swings, so the choice is one table.
//   node scripts/defensive-trim.mjs [--n=30] [--levels=6,18,30] [--bots=masher,blocker,skilled] [--variants=today,windows,block,damage,all3]
import console from 'node:console';
import process from 'node:process';
import { BOTS, fight } from './ladder-sweep.mjs';
import { OPPONENTS } from '../src/combat.ts';
import { isHeld } from '../src/roster.ts';
import { STANCES } from '../src/stance.ts';
import { setLateNotice } from '../src/play-radius.ts';
import { setStab } from '../src/stab-rule.ts';
setStab(true); setLateNotice(true);
const arg = (name, fallback) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback;
const list = (name, fallback) => arg(name, fallback).split(',').filter(Boolean);
const N = Number(arg('n', 30)), LEVELS = list('levels', '6,18,30').map(Number), BOTLIST = list('bots', 'masher,blocker,skilled');
const TODAY = { ...STANCES.defensive };
const VARIANTS = {
  today: TODAY,
  windows: { ...TODAY, window: 100, counter: 100 },                  // the parry and guard-counter windows +10 % instead of +25 %
  block: { ...TODAY, block: -60 },                                    // blocks cost 6 % less stamina instead of 15 %
  damage: { ...TODAY, damage: -100 },                                 // -10 % damage: a harder trade
  all3: { ...TODAY, window: 100, counter: 100, block: -60, damage: -80 },
  block0: { ...TODAY, block: 0 },                                     // no stamina discount on blocks
  recover0: { ...TODAY, recover: 0 },                                 // posture drains at the normal rate
  b0r100: { ...TODAY, block: 0, recover: 100 },
  b0r0: { ...TODAY, block: 0, recover: 0 },
  b60r0: { ...TODAY, block: -60, recover: 0 },                       // Strategy's first try: a smaller discount, no posture-drain perk
  b30r100: { ...TODAY, block: -30, recover: 100 },
};
const roster = Object.keys(OPPONENTS).filter((id) => !isHeld(id));
const rate = (bot, id, level, stance) => { let w = 0; for (let k = 1; k <= N; k++) if (fight(BOTS[bot], id, level, k * 7919, 7200, stance).won) w++; return (100 * w) / N; };
const base = {};
for (const level of LEVELS) for (const bot of BOTLIST) for (const id of roster) base[`${level}/${bot}/${id}`] = rate(bot, id, level, undefined);
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const pooled = (table, level, bot) => mean(roster.map((id) => table[`${level}/${bot}/${id}`]));
console.log(`n=${N} fights per cell, ${roster.length} opponents, levels ${LEVELS.join(',')}; mean win % (Defensive minus baseline in brackets)`);
console.log(['variant', ...LEVELS.flatMap((l) => BOTLIST.map((b) => `L${l}/${b}`))].map((x) => x.padEnd(13)).join(''));
console.log(['baseline', ...LEVELS.flatMap((l) => BOTLIST.map((b) => pooled(base, l, b).toFixed(1)))].map((x) => String(x).padEnd(13)).join(''));
for (const name of list('variants', Object.keys(VARIANTS).join(','))) {
  STANCES.defensive = VARIANTS[name];
  const cell = {};
  for (const level of LEVELS) for (const bot of BOTLIST) for (const id of roster) cell[`${level}/${bot}/${id}`] = rate(bot, id, level, 'defensive');
  console.log([name, ...LEVELS.flatMap((l) => BOTLIST.map((b) => { const d = pooled(cell, l, b) - pooled(base, l, b); return `${pooled(cell, l, b).toFixed(1)}(${d >= 0 ? '+' : ''}${d.toFixed(1)})`; }))].map((x) => String(x).padEnd(13)).join(''));
}
