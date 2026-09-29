// Special Moves prototype numbers (Lead's brief 2026-09-29, Dom's 20:1x rules): the strategy battery (tests/strategies.ts STRATEGIES + the
// tap-attacking first-timer) against every ladder opponent at eight ladder levels, each fight run three ways over the same seeds: special
// OFF, ON with interruptOnHit off, ON with it on (tests/special-proto.ts). CI only (.github/workflows/special-battery.yml): one shard per
// opponent writes JSON, then --merge renders the markdown for the job summary and the PR body.
//   node scripts/special-battery.mjs --opponents goblin,dwarf [--levels 1,6,12,18,30,36,41,46] [--seeds 16] --json out.json
//   node scripts/special-battery.mjs --merge <dir of shard JSON> [--out report.md]
/* global process, console */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { LADDER } from '../src/ladder.ts';
import { OPPONENTS } from '../src/moves.ts';
import { MODES, SPECIAL, cell } from '../tests/special-proto.ts';
import { STRATEGIES, TAP_ATTACK } from '../tests/strategies.ts';

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const FLAG = 3;   // win-rate move, in points, that the brief asks about ("more than a few points")
const [OFF, NOINT, INT] = Object.keys(MODES);

if (arg('merge')) {
  const dir = arg('merge'), shards = readdirSync(dir).filter(f => f.endsWith('.json')).map(f => JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')));
  const meta = shards[0], cells = shards.flatMap(s => s.cells);
  const q = (list, p) => { const s = [...list].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
  const sec = t => (t / 60).toFixed(0), pct = (a, b) => (b ? (100 * a / b).toFixed(0) : '–'), sgn = x => `${x > 0 ? '+' : ''}${x.toFixed(1)}`;
  const merge = list => Object.fromEntries([OFF, NOINT, INT].map(k => [k, list.reduce((s, c) => {
    const m = c.modes[k];
    return { wins: s.wins + m.wins, fights: s.fights + m.fights, ticks: s.ticks.concat(m.ticks), decided: s.decided + m.decided, flipped: s.flipped + m.flipped,
      player: { cast: s.player.cast + m.player.cast, landed: s.player.landed + m.player.landed, cancelled: s.player.cancelled + m.player.cancelled },
      ai: { cast: s.ai.cast + m.ai.cast, landed: s.ai.landed + m.ai.landed, cancelled: s.ai.cancelled + m.ai.cancelled } };
  }, { wins: 0, fights: 0, ticks: [], decided: 0, flipped: 0, player: { cast: 0, landed: 0, cancelled: 0 }, ai: { cast: 0, landed: 0, cancelled: 0 } })]));
  const row = (label, g) => {
    const w = k => 100 * g[k].wins / g[k].fights, per = (k, who) => (g[k][who].landed / g[k].fights).toFixed(2);
    return `| ${label} | ${w(OFF).toFixed(0)} % | ${sgn(w(NOINT) - w(OFF))} / ${sgn(w(INT) - w(OFF))} | ${[OFF, NOINT, INT].map(k => sec(q(g[k].ticks, .5))).join(' / ')} | ${[OFF, NOINT, INT].map(k => sec(q(g[k].ticks, .9))).join(' / ')} | ${pct(g[NOINT].decided, g[NOINT].fights)} / ${pct(g[INT].decided, g[INT].fights)} % | ${per(NOINT, 'ai')} / ${per(INT, 'ai')} | ${per(NOINT, 'player')} / ${per(INT, 'player')} | ${pct(g[INT].ai.cancelled, g[INT].ai.cast)} / ${pct(g[INT].player.cancelled, g[INT].player.cast)} % |`;
  };
  const head = (first) => [`| ${first} | Player win OFF | Win shift, pts (ON int-off / int-on) | Median length, s (OFF / int-off / int-on) | p90 length, s | Decided by a special (int-off / int-on) | AI specials landed per fight | Player specials landed per fight | Cancelled by a hit, int-on (AI / player) |`, '|---|---|---|---|---|---|---|---|---|'];
  const levels = [...new Set(cells.map(c => c.level))].sort((a, b) => a - b), opponents = [...new Set(cells.map(c => c.opponent))];
  const out = [`### Special Moves prototype: strategy battery, special OFF / ON (interrupt off) / ON (interrupt on), paired seeds`, '',
    `Rule (tests/special-proto.ts SPECIAL): wind-up ${meta.rule.windup / 60} s, cooldown ${meta.rule.cooldown / 60} s, first at ${meta.rule.first / 60} s, cast inside ${meta.rule.reach} m, unblockable and undodgeable, ${meta.rule.damage * 100} % of max health (the AI's ${meta.rule.bossDamage * 100} % from level ${meta.rule.bossFrom}, rank 8). ` +
    `Both sides cast whenever it is ready and in reach (upper bound); neither side knows to hit the caster on purpose, so "interrupt on" counts only the hits the ordinary game already throws. ` +
    `${meta.seeds} seeds × ${meta.strategies} strategies = ${meta.seeds * meta.strategies} fights per cell per mode; player on the longsword with the day-one Pommel. ` +
    `"Decided": the killing blow was a special, or a special put the loser behind on health for the rest of the fight. A stall counts as the full 120 s.`, '',
    '**By ladder level (all ten opponents)**', '', ...head('Level')];
  for (const l of levels) out.push(row(`L${l}`, merge(cells.filter(c => c.level === l))));
  out.push(row('**all**', merge(cells)), '', '**By opponent and level**', '', ...head('Opponent · level'));
  const flagged = [];
  for (const o of opponents) for (const l of levels) {
    const g = merge(cells.filter(c => c.opponent === o && c.level === l));
    out.push(row(`${o} L${l}`, g));
    for (const k of [NOINT, INT]) { const d = 100 * (g[k].wins - g[OFF].wins) / g[OFF].fights; if (Math.abs(d) > FLAG) flagged.push(`${o} L${l} ${k} ${sgn(d)}`); }
  }
  out.push('', flagged.length ? `**${flagged.length} cell/mode(s) move the player's win rate by more than ${FLAG} pts:** ${flagged.join('; ')}` : `No cell moves the player's win rate by more than ${FLAG} pts.`, '');
  const md = out.join('\n');
  console.log(md);
  if (process.env.GITHUB_STEP_SUMMARY) writeFileSync(process.env.GITHUB_STEP_SUMMARY, md + '\n', { flag: 'a' });
  if (arg('out')) writeFileSync(arg('out'), md + '\n');
} else {
  const opponents = arg('opponents', LADDER.map(o => o.id).join(',')).split(','), levels = arg('levels', '1,6,12,18,30,36,41,46').split(',').map(Number), seeds = Number(arg('seeds', 16));
  const strategies = { ...STRATEGIES, ...TAP_ATTACK }, cells = [];
  for (const id of opponents) for (const level of levels) {
    const started = Date.now(), modes = cell(level, seeds, OPPONENTS[id], strategies);
    cells.push({ opponent: id, level, modes });
    console.log(`${id.padEnd(12)} L${String(level).padEnd(3)} ${Object.entries(modes).map(([k, m]) => `${k}: ${m.wins}/${m.fights}W ai ${m.ai.landed} pl ${m.player.landed}`).join(' · ')} (${((Date.now() - started) / 1000).toFixed(1)} s)`);
  }
  if (arg('json')) writeFileSync(arg('json'), JSON.stringify({ rule: SPECIAL, seeds, strategies: Object.keys(strategies).length, cells }));
}
