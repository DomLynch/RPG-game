// The ladder count on stance picks (Lead's condition for "stances ON for all", 2026-10-08): the SAME scripted players as scripts/ladder-sweep.mjs, every live opponent x every rung, once with no stances and once
// per stance pick (the foe's mood is the seed's draw). A stances fight must not make a rung unwinnable or trivial: for each (opponent, level, bot) the stance cell is compared with the baseline cell.
//   WALL   a stance that takes a cell the baseline can win (>= 10 %) to 0 %      TRIVIAL  a stance that lifts a cell the baseline wins under 90 % to 100 %
// Also prints the mean win % by (level, bot) per stance next to the baseline, and the largest single-cell swings.
//   node scripts/ladder-stance-count.mjs [--n=30] [--levels=1,6,18,30,46] [--bots=masher,blocker,skilled]
import console from 'node:console';
import process from 'node:process';
import { BOTS, fight } from './ladder-sweep.mjs';
import { OPPONENTS } from '../src/combat.ts';
import { isHeld } from '../src/roster.ts';
import { PICKS } from '../src/stance.ts';
import { setLateNotice } from '../src/play-radius.ts';
import { setStab } from '../src/stab-rule.ts';
setStab(true); setLateNotice(true);
const arg = (name, fallback) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback;
const list = (name, fallback) => arg(name, fallback).split(',').filter(Boolean);
const N = Number(arg('n', 30)), LEVELS = list('levels', '1,6,18,30,46').map(Number), BOTLIST = list('bots', 'masher,blocker,skilled');
const roster = Object.keys(OPPONENTS).filter((id) => !isHeld(id));
const rate = (bot, id, level, stance) => { let w = 0; for (let k = 1; k <= N; k++) if (fight(BOTS[bot], id, level, k * 7919, 7200, stance).won) w++; return (100 * w) / N; };
const base = {}, cell = {}, walls = [], trivial = [];
for (const level of LEVELS) for (const bot of BOTLIST) for (const id of roster) base[`${level}/${bot}/${id}`] = rate(bot, id, level, undefined);
for (const pick of PICKS) for (const level of LEVELS) for (const bot of BOTLIST) for (const id of roster) {
  const b = base[`${level}/${bot}/${id}`], r = rate(bot, id, level, pick); cell[`${pick}/${level}/${bot}/${id}`] = r;
  if (b >= 10 && r === 0) walls.push(`${pick} L${level} ${bot} vs ${id}: ${b.toFixed(0)}% -> 0%`);
  if (b < 90 && r === 100) trivial.push(`${pick} L${level} ${bot} vs ${id}: ${b.toFixed(0)}% -> 100%`);
}
const mean = (f) => roster.reduce((a, id) => a + f(id), 0) / roster.length;
console.log(`ladder count on stance picks: ${roster.length} live opponents, ${N} fights per cell, bots ${BOTLIST.join('/')}; mean win % over the opponents (baseline = no stances)`);
console.log(['level', 'bot', 'baseline', ...PICKS].map((x) => String(x).padEnd(12)).join(''));
for (const level of LEVELS) for (const bot of BOTLIST)
  console.log([`L${level}`, bot, mean((id) => base[`${level}/${bot}/${id}`]).toFixed(1), ...PICKS.map((p) => mean((id) => cell[`${p}/${level}/${bot}/${id}`]).toFixed(1))].map((x) => String(x).padEnd(12)).join(''));
const swings = Object.entries(cell).map(([k, r]) => { const [p, l, b, id] = k.split('/'); return { k, d: r - base[`${l}/${b}/${id}`] }; }).sort((a, b) => Math.abs(b.d) - Math.abs(a.d)).slice(0, 8);
console.log('largest single-cell swings vs the baseline:', swings.map((s) => `${s.k} ${s.d > 0 ? '+' : ''}${s.d.toFixed(0)}`).join(' | '));
console.log(`WALLS (${walls.length}):`, walls.slice(0, 20).join(' | ') || 'none');
console.log(`TRIVIAL (${trivial.length}):`, trivial.slice(0, 20).join(' | ') || 'none');
