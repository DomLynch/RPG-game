// Special Moves prototype numbers (Lead's brief 2026-09-29, Dom's final rules 20:2x): the strategy battery (tests/strategies.ts STRATEGIES
// + the tap-attacking first-timer) and, reported apart, the one strategy that punishes a visible wind-up, against every ladder opponent at
// eight ladder levels, each fight run with the special OFF and ON over the same seeds (tests/special-battery.ts). CI only
// (.github/workflows/special-battery.yml): one shard per opponent writes JSON, then --merge renders the markdown for the job summary and the PR body.
//   node scripts/special-battery.mjs --opponents goblin,dwarf [--levels 1,6,12,18,30,36,41,46] [--seeds 16] --json out.json
//   node scripts/special-battery.mjs --merge <dir of shard JSON> [--out report.md]
/* global process, console */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { LADDER } from '../src/ladder.ts';
import { OPPONENTS } from '../src/moves.ts';
import { PUNISH_WINDUP, SPECIAL, cell } from '../tests/special-battery.ts';
import { STRATEGIES, TAP_ATTACK } from '../tests/strategies.ts';

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const FLAG = 3;   // win-rate move, in points, that the brief asks about ("more than a few points")
const GROUPS = { battery: { ...STRATEGIES, ...TAP_ATTACK }, punisher: PUNISH_WINDUP };

if (arg('merge')) {
  const dir = arg('merge'), shards = readdirSync(dir).filter(f => f.endsWith('.json')).map(f => JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')));
  const meta = shards[0], cells = shards.flatMap(s => s.cells);
  const q = (list, p) => { const s = [...list].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
  const sec = t => (t / 60).toFixed(0), pct = (a, b) => (b ? (100 * a / b).toFixed(0) : '–'), sgn = x => `${x > 0 ? '+' : ''}${x.toFixed(1)}`;
  const addT = (a, b) => ({ cast: a.cast + b.cast, landed: a.landed + b.landed, fizzled: a.fizzled + b.fizzled, double: a.double + b.double });
  const zero = () => ({ wins: 0, fights: 0, ticks: [], decided: 0, flipped: 0, player: { cast: 0, landed: 0, fizzled: 0, double: 0 }, ai: { cast: 0, landed: 0, fizzled: 0, double: 0 } });
  const merge = list => Object.fromEntries(['off', 'on'].map(k => [k, list.reduce((s, c) => {
    const m = c.modes[k];
    return { wins: s.wins + m.wins, fights: s.fights + m.fights, ticks: s.ticks.concat(m.ticks), decided: s.decided + m.decided, flipped: s.flipped + m.flipped, player: addT(s.player, m.player), ai: addT(s.ai, m.ai) };
  }, zero())]));
  const race = t => `${t.landed - t.double} / ${t.fizzled} / ${t.double}`;
  const row = (label, g) => {
    const w = k => 100 * g[k].wins / g[k].fights, n = g.on.fights;
    return `| ${label} | ${w('off').toFixed(0)} % → ${w('on').toFixed(0)} % | ${sgn(w('on') - w('off'))} | ${sec(q(g.off.ticks, .5))} → ${sec(q(g.on.ticks, .5))} | ${sec(q(g.off.ticks, .9))} → ${sec(q(g.on.ticks, .9))} | ${pct(g.on.decided, n)} % | ${pct(g.on.flipped, n)} % | ${(g.on.ai.landed / n).toFixed(2)} | ${(g.on.player.landed / n).toFixed(2)} | ${race(g.on.ai)} | ${race(g.on.player)} |`;
  };
  const head = first => [`| ${first} | Player win OFF → ON | Shift, pts | Median length, s | p90 length, s | Decided by a special | Outcome flipped | AI specials landed / fight | Player specials landed / fight | AI race: landed / fizzled / double | Player race: landed / fizzled / double |`, '|---|---|---|---|---|---|---|---|---|---|---|'];
  const levels = [...new Set(cells.map(c => c.level))].sort((a, b) => a - b), opponents = [...new Set(cells.map(c => c.opponent))];
  const r = meta.rule, out = [`### Special Moves prototype (final rules): special OFF vs ON, paired seeds`, '',
    `Rule (tests/special-battery.ts SPECIAL): committed wind-up ${r.windup / 60} s (no guard, roll or parry; blows land on the caster normally; nothing interrupts it), cooldown ${r.cooldown / 60} s, first at ${r.first / 60} s, cast inside ${r.reach} m, unblockable and undodgeable, ${r.damage * 100} % of max health (the AI's ${r.bossDamage * 100} % from level ${r.bossFrom}, rank 8). ` +
    `The race: a caster killed during the wind-up fizzles; a release on the tick he falls still lands, and a lethal one is a double kill (Finish.draw, counted as a player loss as the battery does). ` +
    `Both sides cast whenever it is ready and in reach (upper bound). ${meta.seeds} seeds per strategy per cell; the player is on the longsword with the day-one Pommel. ` +
    `"Decided": the killing blow was a special, or a special put the loser behind on health for the rest of the fight. A stall counts as the full 120 s.`, ''];
  const flagged = [];
  for (const [group, title] of [['battery', `the battery (${meta.groups.battery} strategies: the nine scripted + the tap-attacking first-timer)`], ['punisher', 'the wind-up punisher alone (light spam; while the opponent winds a special it sprints in and cuts)']]) {
    const mine = cells.filter(c => c.group === group);
    out.push(`#### ${title}`, '', '**By ladder level (all ten opponents)**', '', ...head('Level'));
    for (const l of levels) out.push(row(`L${l}`, merge(mine.filter(c => c.level === l))));
    out.push(row('**all**', merge(mine)), '', '**By opponent and level**', '', ...head('Opponent · level'));
    for (const o of opponents) for (const l of levels) {
      const g = merge(mine.filter(c => c.opponent === o && c.level === l));
      out.push(row(`${o} L${l}`, g));
      const d = 100 * (g.on.wins - g.off.wins) / g.off.fights;
      if (group === 'battery' && Math.abs(d) > FLAG) flagged.push(`${o} L${l} ${sgn(d)}`);
    }
    out.push('');
  }
  out.push(flagged.length ? `**Battery: ${flagged.length} opponent/level cell(s) move the player's win rate by more than ${FLAG} pts:** ${flagged.join('; ')}` : `Battery: no opponent/level cell moves the player's win rate by more than ${FLAG} pts.`, '');
  const md = out.join('\n');
  console.log(md);
  if (process.env.GITHUB_STEP_SUMMARY) writeFileSync(process.env.GITHUB_STEP_SUMMARY, md + '\n', { flag: 'a' });
  if (arg('out')) writeFileSync(arg('out'), md + '\n');
} else {
  const opponents = arg('opponents', LADDER.map(o => o.id).join(',')).split(','), levels = arg('levels', '1,6,12,18,30,36,41,46').split(',').map(Number), seeds = Number(arg('seeds', 16));
  const cells = [];
  for (const id of opponents) for (const level of levels) for (const [group, strategies] of Object.entries(GROUPS)) {
    const started = Date.now(), modes = cell(level, seeds, OPPONENTS[id], strategies);
    cells.push({ opponent: id, level, group, modes });
    console.log(`${id.padEnd(12)} L${String(level).padEnd(3)} ${group.padEnd(8)} win ${modes.off.wins} → ${modes.on.wins}/${modes.on.fights} ai ${JSON.stringify(modes.on.ai)} pl ${JSON.stringify(modes.on.player)} (${((Date.now() - started) / 1000).toFixed(1)} s)`);
  }
  if (arg('json')) writeFileSync(arg('json'), JSON.stringify({ rule: SPECIAL, seeds, groups: Object.fromEntries(Object.entries(GROUPS).map(([g, s]) => [g, Object.keys(s).length])), cells }));
}
